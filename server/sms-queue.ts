/**
 * SMS Queue System using BullMQ
 * Handles high-volume SMS sending with:
 * - Async job processing
 * - Automatic retries with exponential backoff
 * - Rate limiting per vendor
 * - Batch database writes
 * - Real-time job status tracking
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

// Redis connection configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Parse Redis URL for ioredis
function getRedisConnection(): Redis {
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
  });
}

// Queue configuration
const QUEUE_NAME = 'sms-queue';

// Job types
export interface SMSJobData {
  jobId: string;
  userId: string;
  recipient: string;
  message: string;
  senderId?: string;
  vendor: string;
  vendorConfig: {
    apiKey?: string;
    baseUrl?: string;
    sender?: string;
  };
  clientRate: number;
  vendorCost: number;
  priority?: number; // 1-10, higher = more priority
  scheduledAt?: number; // Unix timestamp for scheduled sends
  metadata?: Record<string, any>;
}

export interface SMSJobResult {
  success: boolean;
  messageId?: string;
  vendorMessageId?: string;
  error?: string;
  vendor: string;
  cost: number;
  timestamp: Date;
}

// Batch write buffer for database operations
interface PendingDBWrite {
  type: 'message_log' | 'credit_update';
  data: any;
  timestamp: number;
}

class SMSQueueManager {
  private queue: Queue<SMSJobData, SMSJobResult>;
  private worker: Worker<SMSJobData, SMSJobResult> | null = null;
  private queueEvents: QueueEvents;
  private redisConnection: Redis;
  private pendingWrites: PendingDBWrite[] = [];
  private batchWriteInterval: NodeJS.Timeout | null = null;
  private isWorkerRunning = false;

  // Statistics
  private stats = {
    totalQueued: 0,
    totalProcessed: 0,
    totalFailed: 0,
    processingRate: 0,
    lastMinuteProcessed: 0,
  };

  constructor() {
    this.redisConnection = getRedisConnection();
    
    this.queue = new Queue<SMSJobData, SMSJobResult>(QUEUE_NAME, {
      connection: this.redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000, // 1s, 2s, 4s
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 10000, // Keep max 10k completed jobs
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
        },
      },
    });

    this.queueEvents = new QueueEvents(QUEUE_NAME, {
      connection: getRedisConnection(),
    });

    // Start batch write interval (every 500ms)
    this.startBatchWriteInterval();
    
    console.log('[SMSQueue] Queue manager initialized');
  }

  /**
   * Add a single SMS job to the queue
   */
  async addJob(data: SMSJobData): Promise<Job<SMSJobData, SMSJobResult>> {
    const job = await this.queue.add('send-sms', data, {
      priority: data.priority || 5,
      delay: data.scheduledAt ? Math.max(0, data.scheduledAt - Date.now()) : 0,
      jobId: data.jobId, // Use provided jobId for deduplication
    });

    this.stats.totalQueued++;
    console.log(`[SMSQueue] Job ${data.jobId} added to queue for ${data.recipient}`);
    
    return job;
  }

  /**
   * Add multiple SMS jobs in bulk (for bulk send operations)
   */
  async addBulkJobs(jobs: SMSJobData[]): Promise<Job<SMSJobData, SMSJobResult>[]> {
    const bulkData = jobs.map(data => ({
      name: 'send-sms',
      data,
      opts: {
        priority: data.priority || 5,
        delay: data.scheduledAt ? Math.max(0, data.scheduledAt - Date.now()) : 0,
        jobId: data.jobId,
      },
    }));

    const addedJobs = await this.queue.addBulk(bulkData);
    this.stats.totalQueued += jobs.length;
    
    console.log(`[SMSQueue] ${jobs.length} bulk jobs added to queue`);
    return addedJobs;
  }

  /**
   * Start the worker to process SMS jobs
   * @param processor - Function that actually sends the SMS
   */
  startWorker(processor: (job: Job<SMSJobData, SMSJobResult>) => Promise<SMSJobResult>) {
    if (this.isWorkerRunning) {
      console.log('[SMSQueue] Worker already running');
      return;
    }

    // Configure worker with concurrency based on resources
    // 2 CPU cores * 25 concurrent jobs = 50 parallel SMS sends
    const concurrency = parseInt(process.env.SMS_WORKER_CONCURRENCY || '50', 10);

    this.worker = new Worker<SMSJobData, SMSJobResult>(
      QUEUE_NAME,
      async (job) => {
        console.log(`[SMSQueue] Processing job ${job.id} for ${job.data.recipient}`);
        
        try {
          const result = await processor(job);
          
          if (result.success) {
            this.stats.totalProcessed++;
            this.stats.lastMinuteProcessed++;
          } else {
            this.stats.totalFailed++;
          }
          
          return result;
        } catch (error: any) {
          this.stats.totalFailed++;
          throw error;
        }
      },
      {
        connection: getRedisConnection(),
        concurrency,
        // Rate limiting: max 200 jobs per second (adjust based on vendor limits)
        limiter: {
          max: parseInt(process.env.SMS_RATE_LIMIT || '200', 10),
          duration: 1000,
        },
      }
    );

    // Worker event handlers
    this.worker.on('completed', (job, result) => {
      console.log(`[SMSQueue] Job ${job.id} completed: ${result.messageId || 'success'}`);
    });

    this.worker.on('failed', (job, error) => {
      console.error(`[SMSQueue] Job ${job?.id} failed:`, error.message);
    });

    this.worker.on('error', (error) => {
      console.error('[SMSQueue] Worker error:', error);
    });

    this.isWorkerRunning = true;
    console.log(`[SMSQueue] Worker started with concurrency=${concurrency}`);
  }

  /**
   * Stop the worker gracefully
   */
  async stopWorker() {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      this.isWorkerRunning = false;
      console.log('[SMSQueue] Worker stopped');
    }
  }

  /**
   * Get queue statistics
   */
  async getStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return {
      ...this.stats,
      queue: {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + delayed,
      },
      throughput: {
        perSecond: Math.round(this.stats.lastMinuteProcessed / 60),
        perMinute: this.stats.lastMinuteProcessed,
        perHour: this.stats.lastMinuteProcessed * 60,
        perDay: this.stats.lastMinuteProcessed * 60 * 24,
      },
      worker: {
        running: this.isWorkerRunning,
        concurrency: process.env.SMS_WORKER_CONCURRENCY || '50',
        rateLimit: process.env.SMS_RATE_LIMIT || '200',
      },
    };
  }

  /**
   * Get job status by ID
   */
  async getJobStatus(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    return {
      id: job.id,
      state,
      data: job.data,
      result: job.returnvalue,
      progress: job.progress,
      attempts: job.attemptsMade,
      failedReason: job.failedReason,
      createdAt: new Date(job.timestamp),
      processedAt: job.processedOn ? new Date(job.processedOn) : null,
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
    };
  }

  /**
   * Pause the queue (for maintenance)
   */
  async pause() {
    await this.queue.pause();
    console.log('[SMSQueue] Queue paused');
  }

  /**
   * Resume the queue
   */
  async resume() {
    await this.queue.resume();
    console.log('[SMSQueue] Queue resumed');
  }

  /**
   * Clear all jobs from the queue
   */
  async clear() {
    await this.queue.drain();
    console.log('[SMSQueue] Queue cleared');
  }

  /**
   * Buffer database writes for batch processing
   */
  addPendingWrite(type: 'message_log' | 'credit_update', data: any) {
    this.pendingWrites.push({
      type,
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Process pending database writes in batches
   */
  private startBatchWriteInterval() {
    // Flush every 500ms or when buffer reaches 100 items
    this.batchWriteInterval = setInterval(async () => {
      if (this.pendingWrites.length === 0) return;

      const writes = this.pendingWrites.splice(0, 100);
      
      // Group by type
      const messageLogs = writes.filter(w => w.type === 'message_log').map(w => w.data);
      const creditUpdates = writes.filter(w => w.type === 'credit_update').map(w => w.data);

      // Batch insert message logs (implement in storage.ts)
      if (messageLogs.length > 0) {
        console.log(`[SMSQueue] Batch writing ${messageLogs.length} message logs`);
        // await storage.batchCreateMessageLogs(messageLogs);
      }

      // Batch credit updates (implement in storage.ts)
      if (creditUpdates.length > 0) {
        console.log(`[SMSQueue] Batch updating ${creditUpdates.length} credit records`);
        // await storage.batchUpdateCredits(creditUpdates);
      }
    }, 500);
  }

  /**
   * Cleanup resources
   */
  async shutdown() {
    if (this.batchWriteInterval) {
      clearInterval(this.batchWriteInterval);
    }
    
    await this.stopWorker();
    await this.queue.close();
    await this.queueEvents.close();
    await this.redisConnection.quit();
    
    console.log('[SMSQueue] Shutdown complete');
  }

  /**
   * Reset per-minute stats (call this every minute)
   */
  resetMinuteStats() {
    this.stats.processingRate = this.stats.lastMinuteProcessed;
    this.stats.lastMinuteProcessed = 0;
  }
}

// Singleton instance
let queueManager: SMSQueueManager | null = null;

export function getSMSQueueManager(): SMSQueueManager {
  if (!queueManager) {
    queueManager = new SMSQueueManager();
  }
  return queueManager;
}

export async function initializeSMSQueue(): Promise<SMSQueueManager> {
  const manager = getSMSQueueManager();
  
  // Reset stats every minute
  setInterval(() => {
    manager.resetMinuteStats();
  }, 60000);
  
  return manager;
}

export { SMSQueueManager };
