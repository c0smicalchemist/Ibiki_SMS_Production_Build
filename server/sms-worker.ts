/**
 * SMS Worker Processor
 * Handles the actual SMS sending logic for queued jobs
 * Integrates with vendor-service.ts for multi-vendor support
 */

import { Job } from 'bullmq';
import { getSMSQueueManager, SMSJobData, SMSJobResult, initializeSMSQueue } from './sms-queue';
import { VendorService } from './vendor-service';
import { storage } from './storage';
import { randomUUID } from 'crypto';

// Singleton vendor service instance for the worker
const vendorService = new VendorService();

/**
 * Process a single SMS job from the queue
 */
async function processSMSJob(job: Job<SMSJobData, SMSJobResult>): Promise<SMSJobResult> {
  const { userId, recipient, message, senderId, vendor, vendorConfig, clientRate, vendorCost, metadata } = job.data;
  const startTime = Date.now();

  try {
    // Send via the vendor service
    const vendorResult = await vendorService.sendSMS({
      recipient: recipient,
      message,
      sender: senderId || vendorConfig.sender,
    });

    // Log the message
    const messageLog = {
      id: randomUUID(),
      userId,
      messageId: job.data.jobId,
      vendorMessageId: vendorResult.messageId || null,
      recipient,
      message: message.substring(0, 500), // Truncate for storage
      senderId: senderId || null,
      vendor,
      status: vendorResult.success ? 'sent' : 'failed',
      creditsCharged: clientRate.toString(),
      vendorCost: vendorCost.toString(),
      errorMessage: vendorResult.error || null,
      createdAt: new Date(),
    };

    // Queue for batch write instead of immediate write
    const queueManager = getSMSQueueManager();
    queueManager.addPendingWrite('message_log', messageLog);

    // Update credits (also batch this)
    if (vendorResult.success) {
      queueManager.addPendingWrite('credit_update', {
        userId,
        amount: clientRate,
        type: 'debit',
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[SMSWorker] Job ${job.id} completed in ${duration}ms - ${vendorResult.success ? 'SUCCESS' : 'FAILED'}`);

    return {
      success: vendorResult.success,
      messageId: job.data.jobId,
      vendorMessageId: vendorResult.messageId,
      error: vendorResult.error,
      vendor,
      cost: clientRate,
      timestamp: new Date(),
    };
  } catch (error: any) {
    console.error(`[SMSWorker] Job ${job.id} error:`, error.message);
    
    return {
      success: false,
      messageId: job.data.jobId,
      error: error.message || 'Unknown error',
      vendor,
      cost: 0,
      timestamp: new Date(),
    };
  }
}

/**
 * Start the SMS worker
 * Call this from server startup
 */
export async function startSMSWorker() {
  console.log('[SMSWorker] Starting SMS queue worker...');
  
  const queueManager = await initializeSMSQueue();
  queueManager.startWorker(processSMSJob);
  
  console.log('[SMSWorker] Worker started and ready to process jobs');
  return queueManager;
}

/**
 * Queue a single SMS for async processing
 */
export async function queueSMS(params: {
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
  priority?: number;
  scheduledAt?: Date;
}): Promise<{ jobId: string; queued: boolean }> {
  const queueManager = getSMSQueueManager();
  
  const jobId = randomUUID();
  const jobData: SMSJobData = {
    jobId,
    userId: params.userId,
    recipient: params.recipient,
    message: params.message,
    senderId: params.senderId,
    vendor: params.vendor,
    vendorConfig: params.vendorConfig,
    clientRate: params.clientRate,
    vendorCost: params.vendorCost,
    priority: params.priority || 5,
    scheduledAt: params.scheduledAt?.getTime(),
  };

  await queueManager.addJob(jobData);
  
  return { jobId, queued: true };
}

/**
 * Queue multiple SMS messages for bulk sending
 */
export async function queueBulkSMS(messages: Array<{
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
}>): Promise<{ jobIds: string[]; totalQueued: number }> {
  const queueManager = getSMSQueueManager();
  
  const jobs: SMSJobData[] = messages.map(msg => ({
    jobId: randomUUID(),
    userId: msg.userId,
    recipient: msg.recipient,
    message: msg.message,
    senderId: msg.senderId,
    vendor: msg.vendor,
    vendorConfig: msg.vendorConfig,
    clientRate: msg.clientRate,
    vendorCost: msg.vendorCost,
    priority: 5,
  }));

  await queueManager.addBulkJobs(jobs);
  
  return {
    jobIds: jobs.map(j => j.jobId),
    totalQueued: jobs.length,
  };
}

/**
 * Get SMS job status
 */
export async function getSMSJobStatus(jobId: string) {
  const queueManager = getSMSQueueManager();
  return queueManager.getJobStatus(jobId);
}

/**
 * Get queue statistics
 */
export async function getSMSQueueStats() {
  const queueManager = getSMSQueueManager();
  return queueManager.getStats();
}

/**
 * Pause SMS processing (for maintenance)
 */
export async function pauseSMSQueue() {
  const queueManager = getSMSQueueManager();
  await queueManager.pause();
}

/**
 * Resume SMS processing
 */
export async function resumeSMSQueue() {
  const queueManager = getSMSQueueManager();
  await queueManager.resume();
}
