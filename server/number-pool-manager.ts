// ============================================
// NUMBER POOL MANAGEMENT FOR MULTI-ACCOUNT ANVEO
// Handles number rotation, sticky routing, and warming
// ============================================

import { getDbPool } from './storage';

interface NumberPoolEntry {
  id: number;
  phone_number: string;
  vendor_account_id: number;
  worker_url: string;
  status: string;
  daily_limit: number;
  sent_today: number;
  complaints: number;
  error_count_today: number;
  success_count_today: number;
  last_used_at: Date | null;
  warming_day: number;
}

interface NumberAssignment {
  user_id: string;
  recipient_phone: string;
  assigned_number: string;
}

export class NumberPoolManager {
  
  /**
   * Select best number for sending SMS
   * Implements sticky routing (same user+recipient always uses same number)
   */
  async selectNumber(userId: string, recipientPhone: string): Promise<{ number: string; worker_url: string } | null> {
    try {
      const pool = getDbPool();
      if (!pool) {
        console.error('[NumberPool] Database not available');
        return null;
      }

      // Validate user exists to prevent FK constraint violations
      const userCheck = await pool.query('SELECT 1 FROM users WHERE id = $1', [userId]);
      const userExists = !!(userCheck && Array.isArray((userCheck as any).rows) && (userCheck as any).rows.length > 0);
      if (!userExists) {
        console.warn(`[NumberPool] Invalid user_id ${userId}, skipping sticky routing`);
      }

      // Use a transaction + SELECT ... FOR UPDATE SKIP LOCKED to atomically claim a number
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // 1. Check sticky assignment and lock that number row (only if user exists)
        let existing: any = null;
        if (userExists) {
          existing = await client.query<NumberAssignment>(`
            SELECT na.assigned_number, an.worker_url, an.id
            FROM number_assignments na
            JOIN anveo_numbers an ON an.phone_number = na.assigned_number
            WHERE na.user_id = $1 AND na.recipient_phone = $2
            AND an.status IN ('active', 'warming')
            AND an.sent_today < an.daily_limit
            LIMIT 1
            FOR UPDATE
          `, [userId, recipientPhone]);
        }

        if (existing && Array.isArray((existing as any).rows) && (existing as any).rows.length > 0) {
          const assigned = existing.rows[0] as any;
          console.log(`[NumberPool] Using sticky routing: ${assigned.assigned_number} for ${userId} → ${recipientPhone}`);

          // Atomically increment usage for the assigned number
          await client.query(`
            UPDATE anveo_numbers
            SET sent_today = sent_today + 1, last_used_at = NOW()
            WHERE phone_number = $1
          `, [assigned.assigned_number]);

          // Update assignment usage
          await client.query(`
            UPDATE number_assignments
            SET last_used_at = NOW(), message_count = message_count + 1
            WHERE user_id = $1 AND recipient_phone = $2
          `, [userId, recipientPhone]);

          await client.query('COMMIT');
          return {
            number: assigned.assigned_number,
            worker_url: assigned.worker_url || ''
          };
        }

        // 2. No sticky assignment - atomically select least-used available number
        const selectRes = await client.query<NumberPoolEntry>(`
          SELECT id, phone_number, worker_url, sent_today, daily_limit
          FROM anveo_numbers
          WHERE status IN ('active', 'warming')
            AND sent_today < daily_limit
          ORDER BY sent_today ASC, complaints ASC, last_used_at ASC NULLS FIRST
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        `);

        if (!selectRes || !Array.isArray((selectRes as any).rows) || (selectRes as any).rows.length === 0) {
          await client.query('ROLLBACK');
          console.error('[NumberPool] No available numbers! Query returned no rows or invalid result object.', { selectRes });
          return null;
        }

        const selected = selectRes.rows[0] as any;
        console.log(`[NumberPool] Selected new number: ${selected.phone_number} (sent today: ${selected.sent_today}/${selected.daily_limit})`);

        // Create or update assignment (sticky) - only if user exists
        if (userExists) {
          await client.query(`
            INSERT INTO number_assignments (user_id, recipient_phone, assigned_number, last_used_at, message_count)
            VALUES ($1, $2, $3, NOW(), 1)
            ON CONFLICT (user_id, recipient_phone) DO UPDATE
            SET last_used_at = NOW(), message_count = number_assignments.message_count + 1
          `, [userId, recipientPhone, selected.phone_number]);
        }

        // Atomically increment usage for the selected number
        await client.query(`
          UPDATE anveo_numbers
          SET sent_today = sent_today + 1, last_used_at = NOW()
          WHERE id = $1
        `, [selected.id]);

        await client.query('COMMIT');

        return {
          number: selected.phone_number,
          worker_url: selected.worker_url || ''
        };
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }

    } catch (error: any) {
      console.error('[NumberPool] Error selecting number:', error?.message || error);
      
      // If table doesn't exist, return a default number for development
      if (error?.message?.includes('relation "anveo_numbers" does not exist')) {
        console.warn('[NumberPool] anveo_numbers table missing, using default number for development');
        return {
          number: '+1234567890',
          worker_url: 'https://sms-proxy-1.c0smicalch3mist.workers.dev/webhook'
        };
      }
      
      return null;
    }
  }

  /**
   * Increment sent_today counter and update last_used_at
   */
  private async incrementNumberUsage(phoneNumber: string): Promise<void> {
    const pool = getDbPool();
    if (!pool) return;
    await pool.query(`
      UPDATE anveo_numbers
      SET 
        sent_today = sent_today + 1,
        last_used_at = NOW()
      WHERE phone_number = $1
    `, [phoneNumber]);
  }

  /**
   * Update assignment usage tracking
   */
  private async updateAssignmentUsage(userId: string, recipientPhone: string): Promise<void> {
    const pool = getDbPool();
    if (!pool) return;
    await pool.query(`
      UPDATE number_assignments
      SET 
        last_used_at = NOW(),
        message_count = message_count + 1
      WHERE user_id = $1 AND recipient_phone = $2
    `, [userId, recipientPhone]);
  }

  /**
   * Log routing decision for debugging/analytics
   */
  async logRouting(messageId: number, userId: string, phoneNumber: string, vendorAccountId: number, decision: string, success: boolean, error?: string): Promise<void> {
    try {
      const pool = getDbPool();
      if (!pool) return;
      await pool.query(`
        INSERT INTO message_routing_log 
        (message_id, user_id, vendor_account_id, phone_number, routing_decision, success, error_message, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [messageId, userId, vendorAccountId, phoneNumber, decision, success, error || null]);
    } catch (e) {
      console.error('[NumberPool] Failed to log routing:', e);
    }
  }

  /**
   * Check if recipient has opted out
   */
  async isOptedOut(phoneNumber: string): Promise<boolean> {
    const pool = getDbPool();
    if (!pool) return false;
    const result = await pool.query(`
      SELECT 1 FROM opt_out_registry WHERE phone_number = $1
    `, [phoneNumber]);
    return result.rows.length > 0;
  }

  /**
   * Record opt-out request
   */
  async recordOptOut(phoneNumber: string, source: string = 'sms_reply'): Promise<void> {
    const pool = getDbPool();
    if (!pool) return;
    await pool.query(`
      INSERT INTO opt_out_registry (phone_number, opted_out_at, source)
      VALUES ($1, NOW(), $2)
      ON CONFLICT (phone_number) DO NOTHING
    `, [phoneNumber, source]);
    console.log(`[NumberPool] Opted out: ${phoneNumber} via ${source}`);
  }

  /**
   * Get number pool stats for monitoring
   */
  async getPoolStats(): Promise<any> {
    const pool = getDbPool();
    if (!pool) return {};
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_numbers,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN status = 'warming' THEN 1 ELSE 0 END) as warming_count,
        SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended_count,
        SUM(sent_today) as total_sent_today,
        SUM(daily_limit) as total_capacity,
        AVG(sent_today::numeric / NULLIF(daily_limit, 0) * 100) as avg_usage_percent
      FROM anveo_numbers
    `);
    return stats.rows[0] || {};
  }

  /**
   * Reset daily counters (run at midnight)
   */
  async resetDailyCounters(): Promise<void> {
    const pool = getDbPool();
    if (!pool) return;
    await pool.query(`SELECT reset_daily_counters()`);
    console.log('[NumberPool] Daily counters reset completed');
  }
}

// Singleton instance
export const numberPoolManager = new NumberPoolManager();
