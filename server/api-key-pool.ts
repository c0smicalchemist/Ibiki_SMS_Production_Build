/**
 * API Key Pool Manager
 * 
 * Manages multiple vendor API keys for high-throughput SMS sending.
 * Features:
 * - Round-robin with weighted distribution
 * - Per-key rate limiting (respects TextBelt 2 SMS/sec limit)
 * - Automatic failover on errors
 * - Route window awareness
 * - Quota tracking and alerts
 */

import { storage } from './storage';
import { VendorApiKeyPool } from '../shared/schema';

// Rate limiter state per API key
interface KeyRateLimiter {
  keyId: string;
  lastSendTime: number;
  sendCount: number; // Sends in current second
  rateLimit: number; // SMS per second
}

// Pool statistics
interface PoolStats {
  totalKeys: number;
  activeKeys: number;
  totalQuota: number;
  usedQuota: number;
  currentThroughput: number; // SMS/sec capacity
  isRouteWindowOpen: boolean;
  routeWindowRemaining: number; // seconds until close
  estimatedCapacity: number; // SMS we can send in remaining window
}

class ApiKeyPoolManager {
  private static instance: ApiKeyPoolManager;
  private rateLimiters: Map<string, KeyRateLimiter> = new Map();
  private keyQueue: string[] = []; // Round-robin queue of key IDs
  private lastKeyIndex: number = 0;
  private initialized: boolean = false;
  private poolCache: VendorApiKeyPool[] = [];
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 30000; // 30 seconds

  private constructor() {}

  static getInstance(): ApiKeyPoolManager {
    if (!ApiKeyPoolManager.instance) {
      ApiKeyPoolManager.instance = new ApiKeyPoolManager();
    }
    return ApiKeyPoolManager.instance;
  }

  // ============================================================================
  // ROUTE WINDOW HELPERS
  // ============================================================================

  /**
   * Get current hour in a timezone
   */
  private getHourInZone(tz: string): { hour: number; minute: number; second: number } {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
      });
      const parts = formatter.formatToParts(new Date());
      const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
      const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
      const second = parseInt(parts.find(p => p.type === 'second')?.value || '0');
      return { hour, minute, second };
    } catch {
      return { hour: 0, minute: 0, second: 0 };
    }
  }

  /**
   * Check if routes are currently open
   * Routes open: 08:00 PST (8AM)
   * Routes close: 21:00 EST (9PM)
   */
  isRoutesOpen(): boolean {
    const pst = this.getHourInZone('America/Los_Angeles');
    const est = this.getHourInZone('America/New_York');
    const afterPst8 = pst.hour >= 8;
    const beforeEst21 = est.hour < 21;
    return afterPst8 && beforeEst21;
  }

  /**
   * Get seconds remaining in route window
   * Returns 0 if routes are closed
   */
  getRouteWindowRemaining(): number {
    if (!this.isRoutesOpen()) return 0;

    const est = this.getHourInZone('America/New_York');
    const closeHour = 21; // 9 PM EST
    
    // Calculate seconds until close
    const currentSeconds = est.hour * 3600 + est.minute * 60 + est.second;
    const closeSeconds = closeHour * 3600;
    
    if (currentSeconds >= closeSeconds) return 0;
    return closeSeconds - currentSeconds;
  }

  /**
   * Get seconds until routes open
   * Returns 0 if routes are already open
   */
  getSecondsUntilOpen(): number {
    if (this.isRoutesOpen()) return 0;

    const pst = this.getHourInZone('America/Los_Angeles');
    const openHour = 8; // 8 AM PST
    
    const currentSeconds = pst.hour * 3600 + pst.minute * 60 + pst.second;
    const openSeconds = openHour * 3600;
    
    if (currentSeconds >= openSeconds) {
      // Already past 8 AM PST, so routes should be open (or we're past EST close)
      return 0;
    }
    return openSeconds - currentSeconds;
  }

  // ============================================================================
  // POOL MANAGEMENT
  // ============================================================================

  /**
   * Initialize the pool - load keys from database
   */
  async initialize(): Promise<void> {
    try {
      await this.refreshPool();
      this.initialized = true;
      console.log(`[ApiKeyPool] Initialized with ${this.poolCache.length} keys`);
    } catch (error) {
      console.error('[ApiKeyPool] Initialization error:', error);
    }
  }

  /**
   * Refresh pool from database
   */
  async refreshPool(): Promise<void> {
    try {
      const keys = await storage.getActiveApiKeys('textbelt');
      this.poolCache = keys;
      this.cacheExpiry = Date.now() + this.CACHE_TTL;
      
      // Rebuild key queue with weighted distribution
      this.rebuildKeyQueue();
      
      // Initialize rate limiters for new keys
      for (const key of keys) {
        if (!this.rateLimiters.has(key.id)) {
          this.rateLimiters.set(key.id, {
            keyId: key.id,
            lastSendTime: 0,
            sendCount: 0,
            rateLimit: parseFloat(key.rateLimit?.toString() || '2')
          });
        }
      }
      
      // Clean up limiters for removed keys
      for (const [keyId] of this.rateLimiters) {
        if (!keys.find(k => k.id === keyId)) {
          this.rateLimiters.delete(keyId);
        }
      }
    } catch (error) {
      console.error('[ApiKeyPool] Refresh error:', error);
    }
  }

  /**
   * Rebuild the weighted round-robin queue
   */
  private rebuildKeyQueue(): void {
    this.keyQueue = [];
    
    // Sort by priority (lower = higher priority)
    const sortedKeys = [...this.poolCache]
      .filter(k => k.isActive)
      .sort((a, b) => a.priority - b.priority);
    
    // Add keys to queue based on weight (weight 100 = 10 entries, weight 50 = 5 entries)
    for (const key of sortedKeys) {
      const entries = Math.max(1, Math.round(key.weight / 10));
      for (let i = 0; i < entries; i++) {
        this.keyQueue.push(key.id);
      }
    }
    
    // Shuffle to distribute evenly
    for (let i = this.keyQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.keyQueue[i], this.keyQueue[j]] = [this.keyQueue[j], this.keyQueue[i]];
    }
    
    this.lastKeyIndex = 0;
  }

  /**
   * Get pool statistics
   */
  async getPoolStats(): Promise<PoolStats> {
    await this.ensureFreshPool();
    
    const activeKeys = this.poolCache.filter(k => k.isActive);
    const totalQuota = activeKeys.reduce((sum, k) => sum + (k.quotaLimit || 0), 0);
    const usedQuota = activeKeys.reduce((sum, k) => sum + (k.quotaUsed || 0), 0);
    const throughput = activeKeys.reduce((sum, k) => sum + parseFloat(k.rateLimit?.toString() || '2'), 0);
    
    const isOpen = this.isRoutesOpen();
    const remaining = this.getRouteWindowRemaining();
    const estimatedCapacity = isOpen ? Math.floor(throughput * remaining) : 0;
    
    return {
      totalKeys: this.poolCache.length,
      activeKeys: activeKeys.length,
      totalQuota,
      usedQuota,
      currentThroughput: throughput,
      isRouteWindowOpen: isOpen,
      routeWindowRemaining: remaining,
      estimatedCapacity
    };
  }

  // ============================================================================
  // KEY SELECTION
  // ============================================================================

  /**
   * Ensure we have fresh pool data
   */
  private async ensureFreshPool(): Promise<void> {
    if (Date.now() > this.cacheExpiry || !this.initialized) {
      await this.refreshPool();
    }
  }

  /**
   * Get the next available API key respecting rate limits
   * Returns null if no keys are available (rate limited or routes closed)
   */
  async getNextAvailableKey(options: { 
    respectRouteWindow?: boolean;
    preferredVendor?: string;
  } = {}): Promise<{ key: VendorApiKeyPool; apiKey: string } | null> {
    const { respectRouteWindow = true, preferredVendor = 'textbelt' } = options;

    // Check route window if required
    if (respectRouteWindow && !this.isRoutesOpen()) {
      console.log('[ApiKeyPool] Routes closed, no keys available');
      return null;
    }

    await this.ensureFreshPool();

    if (this.keyQueue.length === 0) {
      console.log('[ApiKeyPool] No keys in pool');
      return null;
    }

    const now = Date.now();
    const triedKeys = new Set<string>();
    
    // Try to find an available key
    while (triedKeys.size < this.keyQueue.length) {
      // Get next key in round-robin
      const keyId = this.keyQueue[this.lastKeyIndex];
      this.lastKeyIndex = (this.lastKeyIndex + 1) % this.keyQueue.length;
      
      if (triedKeys.has(keyId)) continue;
      triedKeys.add(keyId);
      
      const key = this.poolCache.find(k => k.id === keyId);
      if (!key || !key.isActive) continue;
      
      // Check quota
      if (key.quotaLimit && key.quotaLimit > 0 && key.quotaUsed >= key.quotaLimit) {
        console.log(`[ApiKeyPool] Key ${key.name} quota exhausted`);
        continue;
      }
      
      // Check rate limit
      const limiter = this.rateLimiters.get(keyId);
      if (limiter) {
        const timeSinceLastSend = now - limiter.lastSendTime;
        
        // Reset counter if more than 1 second has passed
        if (timeSinceLastSend >= 1000) {
          limiter.sendCount = 0;
        }
        
        // Check if we're at the rate limit
        if (limiter.sendCount >= limiter.rateLimit) {
          // This key is rate limited, try next
          continue;
        }
      }
      
      // Check for recent errors (backoff)
      if (key.consecutiveErrors >= 3) {
        const lastErrorTime = key.lastErrorAt?.getTime() || 0;
        const backoffMs = Math.min(60000, Math.pow(2, key.consecutiveErrors) * 1000);
        if (now - lastErrorTime < backoffMs) {
          console.log(`[ApiKeyPool] Key ${key.name} in backoff`);
          continue;
        }
      }
      
      return { key, apiKey: key.apiKey };
    }
    
    // All keys are rate limited or unavailable
    console.log('[ApiKeyPool] All keys rate limited or unavailable');
    return null;
  }

  /**
   * Record a successful send
   */
  async recordSuccess(keyId: string): Promise<void> {
    const limiter = this.rateLimiters.get(keyId);
    if (limiter) {
      const now = Date.now();
      if (now - limiter.lastSendTime >= 1000) {
        limiter.sendCount = 1;
      } else {
        limiter.sendCount++;
      }
      limiter.lastSendTime = now;
    }
    
    // Update database stats
    try {
      await storage.recordApiKeySuccess(keyId);
    } catch (error) {
      console.error('[ApiKeyPool] Failed to record success:', error);
    }
  }

  /**
   * Record a failed send
   */
  async recordFailure(keyId: string, error: string): Promise<void> {
    try {
      await storage.recordApiKeyFailure(keyId, error);
      
      // Trigger pool refresh to get updated error count
      this.cacheExpiry = 0;
    } catch (err) {
      console.error('[ApiKeyPool] Failed to record failure:', err);
    }
  }

  // ============================================================================
  // ADMIN MANAGEMENT
  // ============================================================================

  /**
   * Add a new API key to the pool
   */
  async addKey(params: {
    vendor: string;
    name: string;
    apiKey: string;
    priority?: number;
    weight?: number;
    quotaLimit?: number;
    rateLimit?: number;
  }): Promise<VendorApiKeyPool> {
    const key = await storage.addApiKeyToPool({
      vendor: params.vendor,
      name: params.name,
      apiKey: params.apiKey,
      priority: params.priority ?? 0,
      weight: params.weight ?? 100,
      quotaLimit: params.quotaLimit ?? 0,
      rateLimit: (params.rateLimit ?? 2).toString(),
      isActive: true
    });
    
    await this.refreshPool();
    return key;
  }

  /**
   * Update an API key in the pool
   */
  async updateKey(keyId: string, params: Partial<{
    name: string;
    apiKey: string;
    isActive: boolean;
    priority: number;
    weight: number;
    quotaLimit: number;
    rateLimit: number;
  }>): Promise<void> {
    await storage.updateApiKeyInPool(keyId, params);
    await this.refreshPool();
  }

  /**
   * Remove an API key from the pool
   */
  async removeKey(keyId: string): Promise<void> {
    await storage.removeApiKeyFromPool(keyId);
    await this.refreshPool();
  }

  /**
   * Get all keys in the pool (for admin UI)
   */
  async getAllKeys(): Promise<VendorApiKeyPool[]> {
    return storage.getAllApiKeysInPool();
  }

  /**
   * Reset daily quotas (call at midnight or when quota resets)
   */
  async resetDailyQuotas(): Promise<void> {
    await storage.resetApiKeyQuotas();
    await this.refreshPool();
  }

  /**
   * Test a specific API key
   */
  async testKey(keyId: string): Promise<{ success: boolean; quota?: number; error?: string }> {
    const key = this.poolCache.find(k => k.id === keyId);
    if (!key) {
      return { success: false, error: 'Key not found' };
    }
    
    try {
      const axios = (await import('axios')).default;
      const response = await axios.get(`https://textbelt.com/quota/${key.apiKey}`, {
        timeout: 10000
      });
      
      if (response.data.success !== false) {
        return { 
          success: true, 
          quota: response.data.quotaRemaining 
        };
      }
      return { success: false, error: 'Invalid API key' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export const apiKeyPool = ApiKeyPoolManager.getInstance();
