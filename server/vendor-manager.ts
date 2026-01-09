import { HttpsProxyAgent } from 'https-proxy-agent';
import { storage } from './storage';
import { 
  VendorManagementConfig, 
  VendorConfig, 
  VendorState,
  DEFAULT_VENDOR_CONFIGS,
  validateVendorManagementConfig,
  validateVendorConfig
} from '../shared/vendor-schema';
import { webshareProxyManager } from './webshare-proxy';

// Static US Proxy agent for TextBelt (fallback if Webshare not configured)
const TEXTBELT_PROXY_URL = process.env.TEXTBELT_PROXY_URL;
const staticProxyAgent = TEXTBELT_PROXY_URL ? new HttpsProxyAgent(TEXTBELT_PROXY_URL) : null;

export class VendorManager {
  private static instance: VendorManager;
  private config: VendorManagementConfig | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
  }

  public static getInstance(): VendorManager {
    if (!VendorManager.instance) {
      VendorManager.instance = new VendorManager();
    }
    return VendorManager.instance;
  }

  /**
   * Initialize vendor configuration from database
   */
  private initPromise: Promise<void> | null = null;

  public async initialize(): Promise<void> {
    if (this.config) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const configData = await storage.getSystemConfig('vendor_management');
      
      if (configData?.value) {
        try {
          const parsed = JSON.parse(configData.value);
          this.config = validateVendorManagementConfig(parsed);
        } catch (e) {
          console.warn('⚠️ Invalid vendor config in DB, falling back to defaults:', e);
          // Fallback to defaults below
        }
      }
      
      if (!this.config) {
        // Initialize with default configuration
        this.config = {
          activeVendorId: 'textbelt',
          vendors: Object.values(DEFAULT_VENDOR_CONFIGS),
          switchingConfig: {
            strategy: 'manual',
            fallbackEnabled: true,
            healthCheckInterval: 30000,
            failureThreshold: 3,
            recoveryTime: 300000,
            costOptimization: false,
            regionBased: false,
          },
          vendorStates: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        await this.saveConfig();
      }

      // Initialize vendor states
      await this.initializeVendorStates();
      
      // Start health checks if enabled
      if (this.config.switchingConfig.healthCheckInterval > 0) {
        this.startHealthChecks();
      }
    } catch (error) {
      console.error('Failed to initialize vendor manager:', error);
      this.initPromise = null;
      throw error;
    }
    })();
    return this.initPromise;
  }

  /**
   * Get current vendor configuration
   */
  public getConfig(): VendorManagementConfig {
    if (!this.config) {
      // Auto-initialize attempt (sync check of async state)
      if (!this.initPromise) {
        this.initialize().catch(err => console.error('Lazy initialization failed:', err));
      }
      throw new Error('Vendor manager not initialized (initialization in progress...)');
    }
    return this.config;
  }

  /**
   * Get active vendor configuration
   */
  public getActiveVendor(): VendorConfig {
    if (!this.config) {
      throw new Error('Vendor manager not initialized');
    }
    
    const vendor = this.config.vendors.find(v => v.id === this.config!.activeVendorId);
    if (!vendor) {
      throw new Error(`Active vendor ${this.config.activeVendorId} not found`);
    }
    
    return vendor;
  }

  /**
   * Get vendor by ID
   */
  public getVendor(vendorId: string): VendorConfig | undefined {
    if (!this.config) {
      throw new Error('Vendor manager not initialized');
    }
    
    return this.config.vendors.find(v => v.id === vendorId);
  }

  /**
   * Get all vendors
   */
  public getAllVendors(): VendorConfig[] {
    if (!this.config) {
      throw new Error('Vendor manager not initialized');
    }
    
    return this.config.vendors;
  }

  /**
   * Get vendor state
   */
  public getVendorState(vendorId: string): VendorState | undefined {
    if (!this.config) {
      throw new Error('Vendor manager not initialized');
    }
    
    return this.config.vendorStates[vendorId];
  }

  /**
   * Switch active vendor
   */
  public async switchVendor(vendorId: string): Promise<void> {
    if (!this.config) {
      throw new Error('Vendor manager not initialized');
    }

    const vendor = this.config.vendors.find(v => v.id === vendorId);
    if (!vendor) {
      throw new Error(`Vendor ${vendorId} not found`);
    }

    if (!vendor.enabled) {
      throw new Error(`Vendor ${vendorId} is disabled`);
    }

    const currentState = this.config.vendorStates[vendorId];
    if (currentState?.status === 'error') {
      console.warn(`Force switching to vendor ${vendorId} despite error state`);
    }

    this.config.activeVendorId = vendorId;
    this.config.updatedAt = new Date();
    
    await this.saveConfig();
    
    console.log(`Switched active vendor to: ${vendorId}`);
  }

  /**
   * Add or update vendor configuration
   */
  public async upsertVendor(vendor: VendorConfig): Promise<void> {
    if (!this.config) {
      throw new Error('Vendor manager not initialized');
    }

    // Validate vendor configuration
    const validatedVendor = validateVendorConfig(vendor);

    const existingIndex = this.config.vendors.findIndex(v => v.id === validatedVendor.id);
    
    if (existingIndex >= 0) {
      this.config.vendors[existingIndex] = validatedVendor;
    } else {
      this.config.vendors.push(validatedVendor);
    }

    this.config.updatedAt = new Date();
    await this.saveConfig();
    
    // Initialize vendor state for new vendors
    if (!this.config.vendorStates[validatedVendor.id]) {
      this.config.vendorStates[validatedVendor.id] = {
        vendorId: validatedVendor.id,
        status: 'inactive',
        consecutiveFailures: 0,
        totalMessages: 0,
        successfulMessages: 0,
        failedMessages: 0,
        averageResponseTime: 0,
      };
    }
  }

  /**
   * Remove vendor configuration
   */
  public async removeVendor(vendorId: string): Promise<void> {
    if (!this.config) {
      throw new Error('Vendor manager not initialized');
    }

    if (this.config.activeVendorId === vendorId) {
      throw new Error('Cannot remove active vendor');
    }

    this.config.vendors = this.config.vendors.filter(v => v.id !== vendorId);
    delete this.config.vendorStates[vendorId];
    
    this.config.updatedAt = new Date();
    await this.saveConfig();
  }

  /**
   * Update switching configuration
   */
  public async updateSwitchingConfig(switchingConfig: Partial<VendorManagementConfig['switchingConfig']>): Promise<void> {
    if (!this.config) {
      throw new Error('Vendor manager not initialized');
    }

    this.config.switchingConfig = { ...this.config.switchingConfig, ...switchingConfig };
    this.config.updatedAt = new Date();
    
    await this.saveConfig();
    
    // Restart health checks if interval changed
    if (switchingConfig.healthCheckInterval !== undefined) {
      this.restartHealthChecks();
    }
  }

  /**
   * Validate vendor configuration
   */
  public async validateVendor(vendorId: string): Promise<{ valid: boolean; errors: string[] }> {
    const vendor = this.getVendor(vendorId);
    if (!vendor) {
      return { valid: false, errors: ['Vendor not found'] };
    }

    const errors: string[] = [];

    // Type-specific validation
    switch (vendor.type) {
      case 'textbelt':
        if (!vendor.config.apiKey) errors.push('TextBelt API key is required');
        break;
      case 'extremesms':
        if (!vendor.config.apiKey) errors.push('ExtremeSMS API key is required');
        break;
      case 'twilio':
        if (!vendor.config.accountSid) errors.push('Twilio Account SID is required');
        if (!vendor.config.authToken) errors.push('Twilio Auth Token is required');
        if (!vendor.config.fromNumber) errors.push('Twilio From number is required');
        break;
      case 'vonage':
        if (!vendor.config.apiKey) errors.push('Vonage API key is required');
        if (!vendor.config.apiSecret) errors.push('Vonage API secret is required');
        if (!vendor.config.from) errors.push('Vonage From number/name is required');
        break;
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Health check for a specific vendor
   */
  public async healthCheck(vendorId: string): Promise<boolean> {
    try {
      const vendor = this.getVendor(vendorId);
      if (!vendor || !vendor.enabled) {
        return false;
      }

      // Vendor-specific health checks
      let isHealthy = false;
      
      switch (vendor.type) {
        case 'textbelt':
          isHealthy = await this.checkTextBeltHealth(vendor.config);
          break;
        case 'extremesms':
          isHealthy = await this.checkExtremeSMSHealth(vendor.config);
          break;
        case 'twilio':
          isHealthy = await this.checkTwilioHealth(vendor.config);
          break;
        case 'vonage':
          isHealthy = await this.checkVonageHealth(vendor.config);
          break;
        default:
          isHealthy = true; // Assume custom vendors are healthy
      }

      // Update vendor state
      if (this.config) {
        const state = this.config.vendorStates[vendorId] || {
          vendorId,
          status: 'inactive',
          consecutiveFailures: 0,
          totalMessages: 0,
          successfulMessages: 0,
          failedMessages: 0,
          averageResponseTime: 0,
        };

        state.lastHealthCheck = new Date();
        state.status = isHealthy ? 'active' : 'error';
        
        if (!isHealthy) {
          state.consecutiveFailures += 1;
        } else {
          state.consecutiveFailures = 0;
        }

        this.config.vendorStates[vendorId] = state;
      }

      return isHealthy;
    } catch (error) {
      console.error(`Health check failed for vendor ${vendorId}:`, error);
      return false;
    }
  }

  /**
   * Get vendor statistics
   */
  public getVendorStats(vendorId: string) {
    const state = this.getVendorState(vendorId);
    if (!state) return null;

    return {
      ...state,
      successRate: state.totalMessages > 0 ? (state.successfulMessages / state.totalMessages) * 100 : 0,
      failureRate: state.totalMessages > 0 ? (state.failedMessages / state.totalMessages) * 100 : 0,
    };
  }

  /**
   * Save configuration to database
   */
  private async saveConfig(): Promise<void> {
    if (!this.config) return;

    await storage.setSystemConfig('vendor_management', JSON.stringify(this.config));
  }

  /**
   * Initialize vendor states
   */
  private async initializeVendorStates(): Promise<void> {
    if (!this.config) return;

    for (const vendor of this.config.vendors) {
      if (!this.config.vendorStates[vendor.id]) {
        this.config.vendorStates[vendor.id] = {
          vendorId: vendor.id,
          status: vendor.enabled ? 'active' : 'inactive',
          consecutiveFailures: 0,
          totalMessages: 0,
          successfulMessages: 0,
          failedMessages: 0,
          averageResponseTime: 0,
        };
      }
    }

    await this.saveConfig();
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (!this.config) return;

    const interval = this.config.switchingConfig.healthCheckInterval;
    if (interval > 0) {
      this.healthCheckInterval = setInterval(async () => {
        for (const vendor of this.config!.vendors) {
          if (vendor.enabled) {
            await this.healthCheck(vendor.id);
          }
        }
      }, interval);
    }
  }

  /**
   * Restart health checks
   */
  private restartHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    this.startHealthChecks();
  }

  /**
   * Get balance for a specific vendor
   */
  public async getBalance(vendorId: string): Promise<number | null> {
    const vendor = this.getVendor(vendorId);
    if (!vendor) return null;

    try {
      switch (vendor.type) {
        case 'textbelt':
          return await this.getTextBeltBalance(vendor.config);
        case 'extremesms':
          return await this.getExtremeSMSBalance(vendor.config);
        case 'twilio':
          return await this.getTwilioBalance(vendor.config);
        case 'vonage':
          return await this.getVonageBalance(vendor.config);
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  public async getActiveVendorBalance(): Promise<{ balance: number; vendor: string; success: boolean }> {
    const activeVendor = this.getActiveVendor();
    
    // Check balance for active vendor
    const balance = await this.getBalance(activeVendor.id);
    
    return {
      balance: balance ?? 0,
      vendor: activeVendor.id,
      success: balance !== null
    };
  }

  private async getTextBeltBalance(config: any): Promise<number | null> {
    try {
      const response = await fetch(`${config.baseUrl}/quota/${config.apiKey}`);
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
    } catch { return null; }
  }

  private async getExtremeSMSBalance(config: any): Promise<number | null> {
    try {
      const response = await fetch(`${config.baseUrl}/api/balance?key=${config.apiKey}`);
      const data = await response.json();
      return typeof data.balance !== 'undefined' ? parseFloat(data.balance) : null;
    } catch { return null; }
  }

  private async getTwilioBalance(config: any): Promise<number | null> {
    try {
      const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Balance.json`, {
        headers: { 'Authorization': `Basic ${auth}` }
      });
      const data = await response.json();
      return data.balance ? parseFloat(data.balance) : null;
    } catch { return null; }
  }

  private async getVonageBalance(config: any): Promise<number | null> {
    try {
      const response = await fetch(`https://rest.nexmo.com/account/get-balance?api_key=${config.apiKey}&api_secret=${config.apiSecret}`);
      const data = await response.json();
      return data.value ? parseFloat(data.value) : null;
    } catch { return null; }
  }

  /**
   * Vendor-specific health check implementations
   */
  private async checkTextBeltHealth(config: any): Promise<boolean> {
    try {
      const url = `${config.baseUrl}/quota/${config.apiKey}`;
      console.log('[TextBelt Health] Checking:', url.replace(config.apiKey, '***'));
      
      // Try Webshare rotating proxy first, then fall back to static proxy
      const fetchOptions: RequestInit = {};
      if (webshareProxyManager.isEnabled()) {
        const proxyAgent = await webshareProxyManager.getProxyAgent();
        if (proxyAgent) {
          (fetchOptions as any).agent = proxyAgent;
          console.log('[TextBelt Health] Using Webshare rotating proxy');
        }
      } else if (staticProxyAgent) {
        (fetchOptions as any).agent = staticProxyAgent;
        console.log('[TextBelt Health] Using static US proxy');
      }
      
      const response = await fetch(url, fetchOptions);
      console.log('[TextBelt Health] Response status:', response.status, response.ok);
      if (!response.ok) return false;
      const data = await response.json().catch(() => null);
      console.log('[TextBelt Health] Response data:', JSON.stringify(data));
      
      // Cache the balance from health check
      if (data && typeof data.quotaRemaining === 'number') {
        this.cachedBalance = { value: data.quotaRemaining, timestamp: Date.now() };
      }
      
      return !!data && data.success !== false;
    } catch (err) {
      console.error('[TextBelt Health] Error:', err);
      return false;
    }
  }
  
  // Cached balance from health checks
  private cachedBalance: { value: number; timestamp: number } = { value: 0, timestamp: 0 };
  
  public getCachedBalance(): { value: number; timestamp: number } {
    return this.cachedBalance;
  }

  private async checkExtremeSMSHealth(config: any): Promise<boolean> {
    try {
      const response = await fetch(`${config.baseUrl}/api/balance?key=${config.apiKey}`);
      const data = await response.json();
      return typeof data.balance !== 'undefined';
    } catch {
      return false;
    }
  }

  private async checkTwilioHealth(config: any): Promise<boolean> {
    try {
      const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}.json`, {
        headers: {
          'Authorization': `Basic ${auth}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async checkVonageHealth(config: any): Promise<boolean> {
    try {
      const params = new URLSearchParams({
        api_key: config.apiKey,
        api_secret: config.apiSecret,
      });

      const response = await fetch(`https://rest.nexmo.com/account/get-balance?${params}`);
      return response.ok;
    } catch {
      return false;
    }
  }
}