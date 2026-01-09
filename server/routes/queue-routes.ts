/**
 * SMS Queue API Routes
 * Provides endpoints for queue monitoring and management
 */

import { Router, Request, Response } from 'express';
import { getSMSQueueStats, pauseSMSQueue, resumeSMSQueue, getSMSJobStatus } from '../sms-worker';
import { getSMSQueueManager } from '../sms-queue';

const router = Router();

/**
 * GET /api/admin/queue/stats
 * Get queue statistics and throughput metrics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getSMSQueueStats();
    res.json({
      success: true,
      stats,
      capacity: {
        current: stats.throughput.perDay,
        target: 250000,
        percentage: Math.round((stats.throughput.perDay / 250000) * 100),
      },
    });
  } catch (error: any) {
    console.error('[QueueRoutes] Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get queue stats',
    });
  }
});

/**
 * GET /api/admin/queue/job/:jobId
 * Get status of a specific job
 */
router.get('/job/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const status = await getSMSJobStatus(jobId);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }
    
    res.json({
      success: true,
      job: status,
    });
  } catch (error: any) {
    console.error('[QueueRoutes] Error getting job status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get job status',
    });
  }
});

/**
 * POST /api/admin/queue/pause
 * Pause queue processing (for maintenance)
 */
router.post('/pause', async (req: Request, res: Response) => {
  try {
    await pauseSMSQueue();
    res.json({
      success: true,
      message: 'Queue paused successfully',
    });
  } catch (error: any) {
    console.error('[QueueRoutes] Error pausing queue:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to pause queue',
    });
  }
});

/**
 * POST /api/admin/queue/resume
 * Resume queue processing
 */
router.post('/resume', async (req: Request, res: Response) => {
  try {
    await resumeSMSQueue();
    res.json({
      success: true,
      message: 'Queue resumed successfully',
    });
  } catch (error: any) {
    console.error('[QueueRoutes] Error resuming queue:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to resume queue',
    });
  }
});

/**
 * POST /api/admin/queue/clear
 * Clear all pending jobs from the queue
 */
router.post('/clear', async (req: Request, res: Response) => {
  try {
    const queueManager = getSMSQueueManager();
    await queueManager.clear();
    res.json({
      success: true,
      message: 'Queue cleared successfully',
    });
  } catch (error: any) {
    console.error('[QueueRoutes] Error clearing queue:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to clear queue',
    });
  }
});

/**
 * GET /api/admin/queue/health
 * Check queue and Redis health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const stats = await getSMSQueueStats();
    
    res.json({
      success: true,
      health: {
        redis: 'connected',
        worker: stats.worker.running ? 'running' : 'stopped',
        queue: {
          active: stats.queue.active,
          waiting: stats.queue.waiting,
          delayed: stats.queue.delayed,
        },
      },
      throughput: stats.throughput,
    });
  } catch (error: any) {
    console.error('[QueueRoutes] Health check failed:', error);
    res.status(500).json({
      success: false,
      health: {
        redis: 'disconnected',
        worker: 'unknown',
        error: error.message,
      },
    });
  }
});

export default router;
