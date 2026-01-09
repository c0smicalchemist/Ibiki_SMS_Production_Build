import { Router } from 'express';
import { VendorManager } from '../vendor-manager';
import { webshareProxyManager } from '../webshare-proxy';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
const vendorManager = VendorManager.getInstance();

// Balance cache to speed up vendor balance requests
const balanceCache: {
  value: number | null;
  vendor: string;
  vendorName: string;
  timestamp: number;
} = { value: null, vendor: '', vendorName: '', timestamp: 0 };
const BALANCE_CACHE_TTL = 30000; // 30 seconds cache

// Validation schemas
const SwitchVendorSchema = z.object({
  vendorId: z.string(),
});

const UpdateVendorSchema = z.object({
  vendor: z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['textbelt', 'extremesms', 'twilio', 'vonage', 'custom']),
    enabled: z.boolean(),
    priority: z.number().min(1).max(100),
    timeout: z.number().min(1000).max(60000),
    retryAttempts: z.number().min(0).max(5),
    retryDelay: z.number().min(100).max(10000),
    config: z.record(z.any()),
  }),
});

const UpdateSwitchingConfigSchema = z.object({
  switchingConfig: z.object({
    strategy: z.enum(['manual', 'round_robin', 'priority', 'health_based', 'cost_based']).optional(),
    fallbackEnabled: z.boolean().optional(),
    healthCheckInterval: z.number().min(1000).max(3600000).optional(),
    failureThreshold: z.number().min(1).max(10).optional(),
    recoveryTime: z.number().min(1000).max(3600000).optional(),
    costOptimization: z.boolean().optional(),
    regionBased: z.boolean().optional(),
  }),
});

// Get vendor configuration
router.get('/api/admin/sms-vendors', authenticateToken, async (req, res) => {
  try {
    const config = vendorManager.getConfig();
    res.json({
      success: true,
      activeVendor: config.activeVendorId,
      vendors: config.vendors.map(v => {
        const state = config.vendorStates[v.id];
        return {
          ...v,
          isActive: v.id === config.activeVendorId,
          health: {
            healthy: state?.status === 'active' || !state,
            reason: state?.status === 'error' ? 'Health check failed' : undefined,
          },
          quota: 0, // Will be populated by quota check
        };
      }),
      switchingConfig: config.switchingConfig,
      vendorStates: config.vendorStates,
    });
  } catch (error) {
    console.error('Error getting vendor configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get vendor configuration',
    });
  }
});

// Get specific vendor
router.get('/api/admin/sms-vendors/:vendorId', authenticateToken, async (req, res) => {
  try {
    const { vendorId } = req.params;
    const vendor = vendorManager.getVendor(vendorId);
    
    if (!vendor) {
      return res.status(404).json({
        success: false,
        error: 'Vendor not found',
      });
    }

    const state = vendorManager.getVendorState(vendorId);
    const stats = vendorManager.getVendorStats(vendorId);

    res.json({
      success: true,
      data: {
        vendor,
        state,
        stats,
      },
    });
  } catch (error) {
    console.error('Error getting vendor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get vendor',
    });
  }
});

// Switch active vendor
router.post('/api/admin/sms-vendors/switch', authenticateToken, async (req, res) => {
  try {
    const validation = SwitchVendorSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.errors,
      });
    }

    const { vendorId } = validation.data;
    await vendorManager.switchVendor(vendorId);

    res.json({
      success: true,
      message: `Switched to vendor: ${vendorId}`,
    });
  } catch (error) {
    console.error('Error switching vendor:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to switch vendor',
    });
  }
});

// Update vendor configuration (API Key, etc)
router.post('/api/admin/sms-vendors/:vendorId/config', authenticateToken, async (req, res) => {
  try {
    const { vendorId } = req.params;
    const config = req.body;
    
    const vendor = vendorManager.getVendor(vendorId);
    if (!vendor) {
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    }

    // Merge existing config with new config
    const updatedVendor = {
      ...vendor,
      config: {
        ...vendor.config,
        ...config
      }
    };

    await vendorManager.upsertVendor(updatedVendor);

    res.json({
      success: true,
      message: 'Vendor configuration updated',
      vendor: updatedVendor
    });
  } catch (error) {
    console.error('Error updating vendor config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update vendor configuration',
    });
  }
});

// Add or update vendor
router.post('/api/admin/sms-vendors', authenticateToken, async (req, res) => {
  try {
    const validation = UpdateVendorSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.errors,
      });
    }

    const { vendor } = validation.data;
    await vendorManager.upsertVendor(vendor);

    res.json({
      success: true,
      message: 'Vendor configuration updated',
    });
  } catch (error) {
    console.error('Error updating vendor:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update vendor',
    });
  }
});

// Remove vendor
router.delete('/api/admin/sms-vendors/:vendorId', authenticateToken, async (req, res) => {
  try {
    const { vendorId } = req.params;
    await vendorManager.removeVendor(vendorId);

    res.json({
      success: true,
      message: 'Vendor removed',
    });
  } catch (error) {
    console.error('Error removing vendor:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove vendor',
    });
  }
});

// Update switching configuration
router.put('/api/admin/sms-vendors/switching-config', authenticateToken, async (req, res) => {
  try {
    const validation = UpdateSwitchingConfigSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.errors,
      });
    }

    const { switchingConfig } = validation.data;
    await vendorManager.updateSwitchingConfig(switchingConfig);

    res.json({
      success: true,
      message: 'Switching configuration updated',
    });
  } catch (error) {
    console.error('Error updating switching config:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update switching configuration',
    });
  }
});

// Validate vendor configuration
router.post('/api/admin/sms-vendors/:vendorId/validate', authenticateToken, async (req, res) => {
  try {
    const { vendorId } = req.params;
    const validation = await vendorManager.validateVendor(vendorId);

    res.json({
      success: true,
      data: validation,
    });
  } catch (error) {
    console.error('Error validating vendor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate vendor',
    });
  }
});

// Health check for vendor
router.post('/api/admin/sms-vendors/:vendorId/test', authenticateToken, async (req, res) => {
  try {
    const { vendorId } = req.params;
    const isHealthy = await vendorManager.healthCheck(vendorId);

    res.json({
      success: true,
      message: isHealthy ? 'Vendor is healthy' : 'Vendor is unhealthy',
      data: {
        vendorId,
        healthy: isHealthy,
      },
    });
  } catch (error) {
    console.error('Error performing health check:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform health check',
    });
  }
});

// Get vendor statistics
router.get('/api/admin/sms-vendors/:vendorId/stats', authenticateToken, async (req, res) => {
  try {
    const { vendorId } = req.params;
    const stats = vendorManager.getVendorStats(vendorId);

    if (!stats) {
      return res.status(404).json({
        success: false,
        error: 'Vendor not found',
      });
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error getting vendor stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get vendor statistics',
    });
  }
});

// Get vendor balance (vendor-specific)
router.get('/api/admin/sms-vendors/:vendorId/balance', authenticateToken, async (req, res) => {
  try {
    const { vendorId } = req.params;
    const vendor = vendorManager.getVendor(vendorId);
    
    if (!vendor) {
      return res.status(404).json({
        success: false,
        error: 'Vendor not found',
      });
    }

    let balance = null;
    
    // Vendor-specific balance checking
    switch (vendor.type) {
      case 'textbelt':
        balance = await getTextBeltBalance(vendor.config.apiKey);
        break;
      case 'extremesms':
        balance = await getExtremeSMSBalance(vendor.config.apiKey);
        break;
      case 'twilio':
        balance = await getTwilioBalance(vendor.config.accountSid, vendor.config.authToken);
        break;
      case 'vonage':
        balance = await getVonageBalance(vendor.config.apiKey, vendor.config.apiSecret);
        break;
      default:
        balance = null;
    }

    res.json({
      success: true,
      data: {
        vendorId,
        balance,
      },
    });
  } catch (error) {
    console.error('Error getting vendor balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get vendor balance',
    });
  }
});

// Get active vendor balance (admin/supervisor/client)
router.get('/api/admin/vendor-balance', authenticateToken, async (req: any, res) => {
  console.log('💰 GET /api/admin/vendor-balance called by', req.user?.userId);
  try {
    const isAdmin = req.user?.role === 'admin';
    
    // Check module-level cache first (30 second TTL)
    const now = Date.now();
    if (balanceCache.timestamp > 0 && (now - balanceCache.timestamp) < BALANCE_CACHE_TTL && balanceCache.vendor) {
      console.log('💰 Returning cached balance:', balanceCache.value);
      return res.json({
        success: true,
        balance: balanceCache.value || 0,
        vendor: isAdmin ? balanceCache.vendor : 'ibiki',
        vendorName: isAdmin ? balanceCache.vendorName : 'Ibiki'
      });
    }
    
    // Check VendorManager's cached balance from health checks (updated every 30s)
    const vmCache = vendorManager.getCachedBalance();
    if (vmCache.timestamp > 0 && (now - vmCache.timestamp) < 60000) {
      let config;
      try { config = vendorManager.getConfig(); } catch { config = null; }
      const vendor = config ? vendorManager.getVendor(config.activeVendorId) : null;
      
      // Update module cache
      balanceCache.value = vmCache.value;
      balanceCache.vendor = vendor?.id || 'textbelt';
      balanceCache.vendorName = vendor?.name || 'TextBelt';
      balanceCache.timestamp = now;
      
      console.log('💰 Returning VendorManager cached balance:', vmCache.value);
      return res.json({
        success: true,
        balance: vmCache.value,
        vendor: isAdmin ? (vendor?.id || 'textbelt') : 'ibiki',
        vendorName: isAdmin ? (vendor?.name || 'TextBelt') : 'Ibiki'
      });
    }
    
    let config;
    try {
      config = vendorManager.getConfig();
    } catch (e) {
      console.warn('VendorManager not initialized, returning default state');
      return res.json({ success: true, balance: 0, vendor: isAdmin ? 'none' : 'ibiki', vendorName: isAdmin ? 'Not Initialized' : 'Ibiki' });
    }

    const activeVendorId = config.activeVendorId;
    console.log('💰 Active vendor:', activeVendorId);
    const vendor = vendorManager.getVendor(activeVendorId);

    if (!vendor) {
      console.log('💰 Active vendor not found in config');
      return res.json({ success: true, balance: 0, vendor: isAdmin ? (activeVendorId || 'textbelt') : 'ibiki', vendorName: isAdmin ? 'Unknown' : 'Ibiki' });
    }

    let balance: number | null = null;
    console.log('💰 Fetching balance for type:', vendor.type);

    switch (vendor.type) {
      case 'textbelt':
        balance = await getTextBeltBalance(vendor.config.apiKey);
        break;
      case 'extremesms':
        balance = await getExtremeSMSBalance(vendor.config.apiKey);
        break;
      case 'twilio':
        balance = await getTwilioBalance(vendor.config.accountSid, vendor.config.authToken);
        break;
      case 'vonage':
        balance = await getVonageBalance(vendor.config.apiKey, vendor.config.apiSecret);    
        break;
    }
    console.log('💰 Balance result:', balance);

    // Update cache
    balanceCache.value = balance;
    balanceCache.vendor = vendor.id;
    balanceCache.vendorName = vendor.name;
    balanceCache.timestamp = now;

    res.json({
      success: true,
      balance: balance || 0,
      vendor: isAdmin ? vendor.id : 'ibiki',
      vendorName: isAdmin ? vendor.name : 'Ibiki'
    });
  } catch (error) {
    console.error('Error getting active vendor balance:', error);
    res.status(500).json({ success: false, error: 'Failed to get vendor balance' });        
  }
});

// Admin SMS Quota (for API Testing page)
router.get('/api/admin/sms-quota', authenticateToken, async (req, res) => {
  try {
    const config = vendorManager.getConfig();
    const quotas = await Promise.all(
      config.vendors.map(async (v) => {
        const name = (v as any).name || v.id;
        if (!v.enabled) {
          return {
            vendor: v.id,
            name,
            quota: { success: false, remaining: 0, error: 'disabled' },
          };
        }

        const remaining = await vendorManager.getBalance(v.id);
        return {
          vendor: v.id,
          name,
          quota:
            typeof remaining === 'number'
              ? { success: true, remaining }
              : { success: false, remaining: 0, error: 'unavailable' },
        };
      })
    );

    res.json({ success: true, quotas });
  } catch (error) {
    console.error('Error getting sms quotas:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch quotas' });
  }
});

// Diagnostics
router.get('/api/vendors/diagnostics', authenticateToken, async (req, res) => {
  try {
    const config = vendorManager.getConfig();
    const activeVendorId = config.activeVendorId;
    const state = vendorManager.getVendorState(activeVendorId);
    
    res.json({
      success: true,
      data: {
        activeVendor: activeVendorId,
        status: state?.status || 'unknown',
        lastHealthCheck: state?.lastHealthCheck,
        switchingConfig: config.switchingConfig,
        serverTime: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Diagnostics failed' });
  }
});

// Helper functions for vendor-specific balance checking
async function getTextBeltBalance(apiKey: string): Promise<number | null> {
  try {
    const response = await fetch(`https://textbelt.com/quota/${apiKey}`);
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.success === false) return null;
    const remaining =
      typeof data.quotaRemaining === 'number'
        ? data.quotaRemaining
        : typeof data.quota === 'number'
          ? data.quota
          : typeof data.remaining === 'number'
            ? data.remaining
            : null;
    return typeof remaining === 'number' ? remaining : null;
  } catch {
    return null;
  }
}

async function getExtremeSMSBalance(apiKey: string): Promise<number | null> {
  try {
    const response = await fetch(`https://extremesms.net/api/balance?key=${apiKey}`);
    const data = await response.json();
    return data.balance || null;
  } catch {
    return null;
  }
}

async function getTwilioBalance(accountSid: string, authToken: string): Promise<number | null> {
  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Balance.json`, {
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });
    const data = await response.json();
    return data.balance ? parseFloat(data.balance) : null;
  } catch {
    return null;
  }
}

async function getVonageBalance(apiKey: string, apiSecret: string): Promise<number | null> {
  try {
    const response = await fetch(`https://rest.nexmo.com/account/get-balance?api_key=${apiKey}&api_secret=${apiSecret}`);
    const data = await response.json();
    return data.value ? parseFloat(data.value) : null;
  } catch {
    return null;
  }
}

// ============================================
// PROXY MANAGEMENT ROUTES
// ============================================

// Get proxy status for admin dashboard
router.get('/api/admin/proxy-status', authenticateToken, async (req: any, res) => {
  try {
    // Only admins can view proxy status
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const webshareStatus = webshareProxyManager.getStatus();
    const staticStatus = (await import('../webshare-proxy')).webshareProxyManager.constructor.getStaticProxyStatus 
      ? { enabled: !!process.env.TEXTBELT_PROXY_URL, url: process.env.TEXTBELT_PROXY_URL?.replace(/\/\/.*@/, '//*****@') || null }
      : { enabled: false, url: null };

    res.json({
      webshare: webshareStatus,
      static: staticStatus,
      activeSource: webshareStatus.enabled ? 'webshare' : (staticStatus.enabled ? 'static' : 'none'),
      lastUpdated: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[ProxyStatus] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to get proxy status' });
  }
});

// Force refresh proxies from Webshare
router.post('/api/admin/proxy-refresh', authenticateToken, async (req: any, res) => {
  try {
    // Only admins can refresh proxies
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!webshareProxyManager.isEnabled()) {
      return res.status(400).json({ error: 'Webshare API key not configured' });
    }

    await webshareProxyManager.forceRefresh();
    const status = webshareProxyManager.getStatus();

    res.json({
      success: true,
      message: `Refreshed ${status.proxyCount} proxies from Webshare`,
      proxies: status.proxies
    });
  } catch (error: any) {
    console.error('[ProxyRefresh] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to refresh proxies' });
  }
});

// Test a specific proxy
router.post('/api/admin/proxy-test', authenticateToken, async (req: any, res) => {
  try {
    // Only admins can test proxies
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { HttpsProxyAgent } = await import('https-proxy-agent');
    const status = webshareProxyManager.getStatus();
    
    if (status.proxies.length === 0) {
      return res.status(400).json({ error: 'No proxies available' });
    }

    // Test the currently active proxy
    const activeProxy = status.proxies.find(p => p.isActive) || status.proxies[0];
    const proxyUrl = `http://${process.env.WEBSHARE_API_KEY ? 'test' : ''}@${activeProxy.address}:${activeProxy.port}`;
    
    // Get full proxy from webshare
    const proxyAgent = await webshareProxyManager.getProxyAgent();
    
    if (!proxyAgent) {
      return res.status(400).json({ error: 'Could not create proxy agent' });
    }

    // Test by checking IP via httpbin
    const testStart = Date.now();
    try {
      const testResponse = await fetch('https://httpbin.org/ip', {
        agent: proxyAgent as any,
        signal: AbortSignal.timeout(10000)
      } as any);
      
      const testData = await testResponse.json();
      const testDuration = Date.now() - testStart;
      
      res.json({
        success: true,
        proxy: {
          address: activeProxy.address,
          port: activeProxy.port,
          city: activeProxy.city,
          country: activeProxy.country
        },
        test: {
          externalIp: testData.origin,
          latencyMs: testDuration,
          timestamp: new Date().toISOString()
        }
      });
    } catch (testError: any) {
      res.json({
        success: false,
        proxy: {
          address: activeProxy.address,
          port: activeProxy.port,
          city: activeProxy.city,
          country: activeProxy.country
        },
        error: testError.message || 'Proxy test failed'
      });
    }
  } catch (error: any) {
    console.error('[ProxyTest] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to test proxy' });
  }
});

export default router;