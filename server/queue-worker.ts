/**
 * SMS Queue Worker
 * 
 * Processes queued SMS messages using the API Key Pool.
 * Features:
 * - Route window awareness (only sends when routes open)
 * - Concurrent processing with controlled parallelism
 * - Priority-based ordering
 * - Automatic retry with exponential backoff
 * - Real-time statistics
 */

import { storage } from './storage';
import { apiKeyPool } from './api-key-pool';
import { SmsQueue } from '../shared/schema';
import { webshareProxyManager } from './webshare-proxy';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

interface WorkerConfig {
  batchSize: number;           // Messages to process per batch
  pollIntervalMs: number;      // How often to poll for new messages
  maxConcurrency: number;      // Max concurrent sends
  pauseWhenClosed: boolean;    // Pause processing when routes closed
}

interface WorkerStats {
  isRunning: boolean;
  isProcessing: boolean;
  routesOpen: boolean;
  messagesSent: number;
  messagesFailed: number;
  currentBatchSize: number;
  throughputPerSec: number;
  lastProcessedAt: Date | null;
  queueDepth: number;
}

class SmsQueueWorker {
  private static instance: SmsQueueWorker;
  private isRunning: boolean = false;
  private isProcessing: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private stats: WorkerStats = {
    isRunning: false,
    isProcessing: false,
    routesOpen: false,
    messagesSent: 0,
    messagesFailed: 0,
    currentBatchSize: 0,
    throughputPerSec: 0,
    lastProcessedAt: null,
    queueDepth: 0
  };
  
  private config: WorkerConfig = {
    batchSize: 100,
    pollIntervalMs: 500, // Poll every 500ms
    maxConcurrency: 10,  // 10 concurrent sends (will be limited by pool rate limits)
    pauseWhenClosed: true
  };

  // Throughput tracking
  private sendTimes: number[] = [];
  private readonly THROUGHPUT_WINDOW = 10000; // 10 seconds

  private constructor() {}

  static getInstance(): SmsQueueWorker {
    if (!SmsQueueWorker.instance) {
      SmsQueueWorker.instance = new SmsQueueWorker();
    }
    return SmsQueueWorker.instance;
  }

  // ============================================================================
  // WORKER LIFECYCLE
  // ============================================================================

  /**
   * Start the queue worker
   */
  async start(config?: Partial<WorkerConfig>): Promise<void> {
    if (this.isRunning) {
      console.log('[QueueWorker] Already running');
      return;
    }

    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Initialize the API key pool
    await apiKeyPool.initialize();

    this.isRunning = true;
    this.stats.isRunning = true;
    console.log('[QueueWorker] Started with config:', this.config);

    // Start polling
    this.pollInterval = setInterval(() => this.processBatch(), this.config.pollIntervalMs);
    
    // Initial process
    await this.processBatch();
  }

  /**
   * Stop the queue worker
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.stats.isRunning = false;
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    
    console.log('[QueueWorker] Stopped');
  }

  /**
   * Pause processing (keeps worker running but doesn't process)
   */
  pause(): void {
    this.isProcessing = false;
    console.log('[QueueWorker] Paused');
  }

  /**
   * Resume processing
   */
  resume(): void {
    console.log('[QueueWorker] Resumed');
  }

  // ============================================================================
  // QUEUE PROCESSING
  // ============================================================================

  /**
   * Process a batch of messages
   */
  private async processBatch(): Promise<void> {
    if (!this.isRunning) return;
    if (this.isProcessing) return; // Already processing

    // Check route window
    const routesOpen = apiKeyPool.isRoutesOpen();
    this.stats.routesOpen = routesOpen;

    if (this.config.pauseWhenClosed && !routesOpen) {
      // Routes closed, don't process
      return;
    }

    try {
      this.isProcessing = true;
      this.stats.isProcessing = true;

      // Get pending messages from queue
      const messages = await storage.getQueuedMessages({
        limit: this.config.batchSize,
        status: 'pending',
        scheduledBefore: new Date()
      });

      if (messages.length === 0) {
        this.isProcessing = false;
        this.stats.isProcessing = false;
        return;
      }

      this.stats.currentBatchSize = messages.length;

      // Process messages with controlled concurrency
      const chunks = this.chunkArray(messages, this.config.maxConcurrency);
      
      for (const chunk of chunks) {
        if (!this.isRunning) break;
        
        await Promise.all(chunk.map(msg => this.processMessage(msg as SmsQueue)));
      }

      // Update queue depth
      this.stats.queueDepth = await storage.getQueueDepth();
      this.stats.lastProcessedAt = new Date();

    } catch (error) {
      console.error('[QueueWorker] Batch processing error:', error);
    } finally {
      this.isProcessing = false;
      this.stats.isProcessing = false;
    }
  }

  /**
   * Process a single message
   */
  private async processMessage(message: SmsQueue): Promise<void> {
    try {
      // Mark as processing
      await storage.updateQueueMessageStatus(message.id, 'processing');

      // Get an available API key
      const keyResult = await apiKeyPool.getNextAvailableKey({
        respectRouteWindow: message.routeWindowOnly
      });

      if (!keyResult) {
        // No keys available (rate limited or routes closed)
        // Put back in queue for retry
        await storage.updateQueueMessageStatus(message.id, 'pending', {
          lastError: 'No API keys available',
          attempts: message.attempts + 1
        });
        return;
      }

      const { key, apiKey } = keyResult;

      // Send via TextBelt
      const result = await this.sendViaTextBelt(message, apiKey);

      if (result.success) {
        // Success!
        await apiKeyPool.recordSuccess(key.id);
        await storage.updateQueueMessageStatus(message.id, 'sent', {
          vendorMessageId: result.messageId,
          vendorStatus: 'sent',
          apiKeyId: key.id,
          processedAt: new Date()
        });
        this.stats.messagesSent++;
        this.recordSendTime();
        
        // Create message log for billing/tracking
        await this.createMessageLog(message, result, key.id);

      } else {
        // Failed
        await apiKeyPool.recordFailure(key.id, result.error || 'Unknown error');
        
        const attempts = message.attempts + 1;
        const status = attempts >= message.maxAttempts ? 'failed' : 'pending';
        
        await storage.updateQueueMessageStatus(message.id, status, {
          lastError: result.error,
          attempts,
          lastAttemptAt: new Date()
        });
        
        if (status === 'failed') {
          this.stats.messagesFailed++;
        }
      }

    } catch (error: any) {
      console.error('[QueueWorker] Message processing error:', error);
      await storage.updateQueueMessageStatus(message.id, 'pending', {
        lastError: error.message,
        attempts: message.attempts + 1
      });
    }
  }

  /**
   * Send SMS via TextBelt
   */
  private async sendViaTextBelt(message: SmsQueue, apiKey: string): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      // Get proxy agent
      const proxyUrl = await webshareProxyManager.getProxyUrl();
      const httpsAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

      const response = await axios.post('https://textbelt.com/text', {
        phone: message.recipient,
        message: message.message,
        key: apiKey
      }, {
        httpsAgent,
        timeout: 30000
      });

      if (response.data.success) {
        return {
          success: true,
          messageId: response.data.textId?.toString()
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'TextBelt rejected message'
        };
      }

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Network error'
      };
    }
  }

  /**
   * Create message log for billing/tracking
   */
  private async createMessageLog(message: SmsQueue, result: any, apiKeyId: string): Promise<void> {
    try {
      await storage.createMessageLog({
        userId: message.userId,
        messageId: result.messageId || `queue-${message.id}`,
        vendor: 'textbelt',
        endpoint: 'queue-worker',
        recipient: message.recipient,
        recipients: null,
        senderPhoneNumber: null,
        status: 'sent',
        costPerMessage: message.costPerMessage?.toString() || '0.0100',
        chargePerMessage: message.chargePerMessage?.toString() || '0.0150',
        totalCost: message.costPerMessage?.toString() || '0.0100',
        totalCharge: message.chargePerMessage?.toString() || '0.0150',
        messageCount: 1,
        requestPayload: JSON.stringify({ recipient: message.recipient, message: message.message }),
        responsePayload: JSON.stringify(result)
      });
    } catch (error) {
      console.error('[QueueWorker] Failed to create message log:', error);
    }
  }

  // ============================================================================
  // QUEUE MANAGEMENT
  // ============================================================================

  /**
   * Add messages to the queue (for bulk sends)
   */
  async queueMessages(params: {
    userId: string;
    messages: Array<{ recipient: string; message: string }>;
    priority?: number;
    routeWindowOnly?: boolean;
    metadata?: any;
  }): Promise<{ queued: number; queueIds: string[] }> {
    const { userId, messages, priority = 50, routeWindowOnly = true, metadata } = params;
    
    const queueIds: string[] = [];
    
    // Get pricing info
    const pricing = await storage.getSystemConfig('default_client_rate');
    const cost = await storage.getSystemConfig('default_extreme_cost');
    const chargePerMessage = pricing?.value || '0.0150';
    const costPerMessage = cost?.value || '0.0100';

    // Batch insert for efficiency
    for (const msg of messages) {
      const id = await storage.addToSmsQueue({
        userId,
        recipient: msg.recipient,
        message: msg.message,
        priority,
        routeWindowOnly,
        costPerMessage,
        chargePerMessage,
        metadata,
        status: 'pending'
      });
      queueIds.push(id);
    }

    // Update queue depth stat
    this.stats.queueDepth = await storage.getQueueDepth();

    return { queued: queueIds.length, queueIds };
  }

  /**
   * Cancel queued messages
   */
  async cancelMessages(messageIds: string[]): Promise<number> {
    return storage.cancelQueuedMessages(messageIds);
  }

  /**
   * Cancel all pending messages for a user
   */
  async cancelUserMessages(userId: string): Promise<number> {
    return storage.cancelUserQueuedMessages(userId);
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  /**
   * Record send time for throughput calculation
   */
  private recordSendTime(): void {
    const now = Date.now();
    this.sendTimes.push(now);
    
    // Clean old entries
    const cutoff = now - this.THROUGHPUT_WINDOW;
    this.sendTimes = this.sendTimes.filter(t => t >= cutoff);
    
    // Calculate throughput
    const windowSeconds = this.THROUGHPUT_WINDOW / 1000;
    this.stats.throughputPerSec = this.sendTimes.length / windowSeconds;
  }

  /**
   * Get worker statistics
   */
  getStats(): WorkerStats {
    return { ...this.stats };
  }

  /**
   * Get detailed queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    byPriority: Record<string, number>;
  }> {
    return storage.getQueueStatistics();
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// Export singleton instance
export const queueWorker = SmsQueueWorker.getInstance();
