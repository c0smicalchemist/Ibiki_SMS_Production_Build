import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SMSMessage, SMSResult } from '../shared/vendor-config';
import { VendorManager } from './vendor-manager';
import { VendorConfig } from '../shared/vendor-schema';
import { SMSMessageEnhanced, VendorConfiguration } from '../shared/vendor-config-enhanced';
import { webshareProxyManager } from './webshare-proxy';
import { storage } from './storage';
import { numberPoolManager } from './number-pool-manager';

// Static US Proxy agent for TextBelt (fallback if Webshare not configured)
const TEXTBELT_PROXY_URL = process.env.TEXTBELT_PROXY_URL;
const staticProxyAgent = TEXTBELT_PROXY_URL ? new HttpsProxyAgent(TEXTBELT_PROXY_URL) : null;
if (staticProxyAgent) {
  console.log('[VendorService] Static TextBelt US proxy configured:', TEXTBELT_PROXY_URL?.replace(/\/\/.*@/, '//*****@'));
}

// Initialize Webshare proxy manager
webshareProxyManager.initialize().catch(err => {
  console.error('[VendorService] Webshare proxy init error:', err);
});

// ============================================================
// SMART KEY ROTATION SYSTEM - Anti-abuse protection
// ============================================================
interface KeyUsageStats {
  lastUsed: number;        // Timestamp of last use
  usageCount: number;      // Total uses in current window
  hourlyCount: number;     // Uses in current hour
  dailyCount: number;      // Uses in current day
  hourResetAt: number;     // When to reset hourly count
  dayResetAt: number;      // When to reset daily count
  consecutiveErrors: number; // Consecutive failures
  cooldownUntil: number;   // Don't use until this time
}

// In-memory tracking for key usage (persists across requests, resets on restart)
const keyUsageMap = new Map<string, KeyUsageStats>();
let lastKeyIndex = 0; // For round-robin rotation

// Configuration for anti-abuse - SCALED FOR 200k/day with 20+5 keys
// Strategy: 20 active keys + 5 backup keys
// Each key handles ~10k/day = 417/hour = 7/min = 0.12/sec (6% of 2/sec limit)
const KEY_ROTATION_CONFIG = {
  MIN_DELAY_BETWEEN_SAME_KEY_MS: 500,      // 500ms = 2/sec max per key (TextBelt rate limit)
  MAX_HOURLY_PER_KEY: 2500,                // 2500/hour allows bursts while staying safe
  MAX_DAILY_PER_KEY: 15000,                // 15k/day headroom (normal target: 10k)
  ERROR_COOLDOWN_MS: 30000,                // 30 sec cooldown after error (faster recovery)
  MAX_CONSECUTIVE_ERRORS: 3,               // After 3 errors, longer cooldown
  EXTENDED_COOLDOWN_MS: 300000,            // 5 minute extended cooldown for problem keys
  MIN_QUOTA_THRESHOLD: 50,                 // Don't use keys with less than 50 credits (buffer)
};

function getKeyStats(keyId: string): KeyUsageStats {
  const now = Date.now();
  let stats = keyUsageMap.get(keyId);
  
  if (!stats) {
    stats = {
      lastUsed: 0,
      usageCount: 0,
      hourlyCount: 0,
      dailyCount: 0,
      hourResetAt: now + 3600000,  // 1 hour from now
      dayResetAt: now + 86400000,  // 24 hours from now
      consecutiveErrors: 0,
      cooldownUntil: 0,
    };
    keyUsageMap.set(keyId, stats);
  }
  
  // Reset hourly counter if needed
  if (now >= stats.hourResetAt) {
    stats.hourlyCount = 0;
    stats.hourResetAt = now + 3600000;
  }
  
  // Reset daily counter if needed
  if (now >= stats.dayResetAt) {
    stats.dailyCount = 0;
    stats.dayResetAt = now + 86400000;
  }
  
  return stats;
}

function isKeyAvailable(keyId: string, quotaRemaining?: number): { available: boolean; reason?: string } {
  const now = Date.now();
  const stats = getKeyStats(keyId);
  
  // Check cooldown
  if (stats.cooldownUntil > now) {
    const waitSecs = Math.ceil((stats.cooldownUntil - now) / 1000);
    return { available: false, reason: `cooldown (${waitSecs}s remaining)` };
  }
  
  // Check minimum delay between uses
  const timeSinceLastUse = now - stats.lastUsed;
  if (timeSinceLastUse < KEY_ROTATION_CONFIG.MIN_DELAY_BETWEEN_SAME_KEY_MS) {
    return { available: false, reason: `too soon (${KEY_ROTATION_CONFIG.MIN_DELAY_BETWEEN_SAME_KEY_MS - timeSinceLastUse}ms)` };
  }
  
  // Check hourly limit
  if (stats.hourlyCount >= KEY_ROTATION_CONFIG.MAX_HOURLY_PER_KEY) {
    return { available: false, reason: `hourly limit reached (${stats.hourlyCount}/${KEY_ROTATION_CONFIG.MAX_HOURLY_PER_KEY})` };
  }
  
  // Check daily limit
  if (stats.dailyCount >= KEY_ROTATION_CONFIG.MAX_DAILY_PER_KEY) {
    return { available: false, reason: `daily limit reached (${stats.dailyCount}/${KEY_ROTATION_CONFIG.MAX_DAILY_PER_KEY})` };
  }
  
  // Check quota if provided
  if (quotaRemaining !== undefined && quotaRemaining < KEY_ROTATION_CONFIG.MIN_QUOTA_THRESHOLD) {
    return { available: false, reason: `low quota (${quotaRemaining} remaining)` };
  }
  
  return { available: true };
}

function recordKeyUsage(keyId: string, success: boolean): void {
  const stats = getKeyStats(keyId);
  const now = Date.now();
  
  stats.lastUsed = now;
  stats.usageCount++;
  stats.hourlyCount++;
  stats.dailyCount++;
  
  if (success) {
    stats.consecutiveErrors = 0;
  } else {
    stats.consecutiveErrors++;
    // Apply cooldown based on error count
    if (stats.consecutiveErrors >= KEY_ROTATION_CONFIG.MAX_CONSECUTIVE_ERRORS) {
      stats.cooldownUntil = now + KEY_ROTATION_CONFIG.EXTENDED_COOLDOWN_MS;
      console.warn(`[KeyRotation] Key ${keyId.slice(0, 8)}... extended cooldown (${stats.consecutiveErrors} errors)`);
    } else {
      stats.cooldownUntil = now + KEY_ROTATION_CONFIG.ERROR_COOLDOWN_MS;
    }
  }
}

async function selectBestKey(pool: any[]): Promise<{ key: any; keyId: string } | null> {
  if (!pool || pool.length === 0) return null;
  
  // Sort by priority (lower = higher priority)
  const sortedPool = [...pool].sort((a, b) => (a.priority || 0) - (b.priority || 0));
  
  // First pass: Try round-robin among available keys
  const startIndex = lastKeyIndex % sortedPool.length;
  
  for (let i = 0; i < sortedPool.length; i++) {
    const index = (startIndex + i) % sortedPool.length;
    const key = sortedPool[index];
    const keyId = key.id || key.api_key?.slice(0, 16) || `key-${index}`;
    const apiKey = key.api_key || key.apiKey || key.key;
    
    if (!apiKey) continue;
    
    const { available, reason } = isKeyAvailable(keyId, key.quota_limit);
    
    if (available) {
      lastKeyIndex = index + 1; // Move to next key for next request
      console.log(`[KeyRotation] Selected key ${index + 1}/${sortedPool.length}: ${keyId.slice(0, 8)}... (round-robin)`);
      return { key, keyId };
    } else {
      console.log(`[KeyRotation] Skipped key ${keyId.slice(0, 8)}...: ${reason}`);
    }
  }
  
  // Second pass: Find key with shortest wait time
  let bestKey: any = null;
  let bestKeyId: string = '';
  let shortestWait = Infinity;
  
  for (const key of sortedPool) {
    const keyId = key.id || key.api_key?.slice(0, 16) || 'unknown';
    const stats = getKeyStats(keyId);
    const now = Date.now();
    
    // Calculate wait time
    let waitTime = 0;
    if (stats.cooldownUntil > now) {
      waitTime = stats.cooldownUntil - now;
    } else {
      const timeSinceLastUse = now - stats.lastUsed;
      if (timeSinceLastUse < KEY_ROTATION_CONFIG.MIN_DELAY_BETWEEN_SAME_KEY_MS) {
        waitTime = KEY_ROTATION_CONFIG.MIN_DELAY_BETWEEN_SAME_KEY_MS - timeSinceLastUse;
      }
    }
    
    // Skip keys that hit hourly/daily limits
    if (stats.hourlyCount >= KEY_ROTATION_CONFIG.MAX_HOURLY_PER_KEY ||
        stats.dailyCount >= KEY_ROTATION_CONFIG.MAX_DAILY_PER_KEY) {
      continue;
    }
    
    if (waitTime < shortestWait) {
      shortestWait = waitTime;
      bestKey = key;
      bestKeyId = keyId;
    }
  }
  
  if (bestKey && shortestWait > 0) {
    console.log(`[KeyRotation] All keys busy, waiting ${shortestWait}ms for key ${bestKeyId.slice(0, 8)}...`);
    await new Promise(resolve => setTimeout(resolve, shortestWait));
    return { key: bestKey, keyId: bestKeyId };
  }
  
  if (bestKey) {
    return { key: bestKey, keyId: bestKeyId };
  }
  
  console.warn('[KeyRotation] No available keys in pool!');
  return null;
}

// Type alias for vendor (used by health/status checks)
type SMSVendor = VendorConfig;

export class VendorService {
  private vendorManager: VendorManager;

  constructor() {
    this.vendorManager = VendorManager.getInstance();
  }

  /**
   * Get a random webhook URL from configured proxy domains
   * Supports multiple webhook domains for rotation to avoid bans
   */
  private async getRandomWebhookUrl(): Promise<string> {
    try {
      // Check for multiple webhook proxy domains (comma-separated)
      const dbConfig = await storage.getSystemConfig('webhook_proxy_domains');
      let webhookUrls: string[] = [];
      
      if (dbConfig?.value && dbConfig.value.trim()) {
        // Parse comma-separated domains
        webhookUrls = dbConfig.value
          .split(',')
          .map(url => url.trim())
          .filter(url => url.length > 0);
      }
      
      // Fallback to single webhook_public_url if webhook_proxy_domains not set
      if (webhookUrls.length === 0) {
        const singleConfig = await storage.getSystemConfig('webhook_public_url');
        if (singleConfig?.value && singleConfig.value.trim()) {
          webhookUrls.push(singleConfig.value.trim());
        }
      }
      
      // Fallback to env var if no DB config
      if (webhookUrls.length === 0) {
        const envUrl = process.env.SERVER_PUBLIC_URL || 'https://ibiki.run.place';
        webhookUrls.push(envUrl);
      }
      
      // Randomize selection to distribute across domains
      const randomIndex = Math.floor(Math.random() * webhookUrls.length);
      const selectedUrl = webhookUrls[randomIndex];
      
      // Return full webhook endpoint URL
      return `${selectedUrl}/api/webhook/textbelt`;
    } catch (e) {
      console.warn('[WebhookProxy] Failed to get webhook domains, using default:', e);
      const fallbackUrl = process.env.SERVER_PUBLIC_URL || 'https://ibiki.run.place';
      return `${fallbackUrl}/api/webhook/textbelt`;
    }
  }

  setActiveVendor(vendorId: string): void {
    // This method is now handled by VendorManager
    // Kept for backward compatibility
  }

  getActiveVendor(): VendorConfig {
    return this.vendorManager.getActiveVendor();
  }

  getAvailableVendors(): VendorConfig[] {
    return this.vendorManager.getAllVendors();
  }

  async sendSMS(message: SMSMessage): Promise<SMSResult> {
    try {
      const activeVendor = this.vendorManager.getActiveVendor();
      console.log('[VendorService] sendSMS called, active vendor:', activeVendor.id, activeVendor.type);
      
      // Update vendor state before sending
      const state = this.vendorManager.getVendorState(activeVendor.id);
      if (state) {
        state.totalMessages += 1;
      }

      let result: SMSResult;
      
      switch (activeVendor.type) {
        case 'textbelt':
          console.log('[VendorService] Sending via TextBelt...');
          result = await this.sendViaTextBelt(message, activeVendor.config);
          console.log('[VendorService] TextBelt result:', JSON.stringify(result));
          break;
        case 'extremesms':
          result = await this.sendViaExtremeSMS(message, activeVendor.config);
          break;
        case 'twilio':
          result = await this.sendViaTwilio(message, activeVendor.config);
          break;
        case 'anveo':
          result = await this.sendViaAnveo(message, activeVendor.config);
          break;
        case 'vonage':
          result = await this.sendViaVonage(message, activeVendor.config);
          break;
        case 'custom':
          result = await this.sendViaCustom(message, activeVendor.config);
          break;
        default:
          throw new Error(`Unsupported vendor type: ${(activeVendor as any).type}`);
      }

      // Update vendor state after successful send
      if (state && result.success) {
        state.successfulMessages += 1;
      } else if (state) {
        state.failedMessages += 1;
      }

      return result;
    } catch (error) {
      // Handle fallback logic based on vendor manager configuration
      const config = this.vendorManager.getConfig();
      if (config.switchingConfig.fallbackEnabled) {
        const fallbackVendor = await this.findFallbackVendor();
        if (fallbackVendor) {
          console.log(`Falling back to vendor: ${fallbackVendor.id}`);
          return await this.sendViaVendor(message, fallbackVendor);
        }
      }
      
      throw error;
    }
  }

  private async findFallbackVendor(): Promise<VendorConfig | null> {
    const vendors = this.vendorManager.getAllVendors();
    const activeVendor = this.vendorManager.getActiveVendor();
    
    // Find enabled vendors sorted by priority
    const fallbackVendors = vendors
      .filter(v => v.id !== activeVendor.id && v.enabled)
      .sort((a, b) => a.priority - b.priority);
    
    // Check health of fallback vendors
    for (const vendor of fallbackVendors) {
      const state = this.vendorManager.getVendorState(vendor.id);
      if (!state || state.status === 'active') {
        return vendor;
      }
    }
    
    return null;
  }

  private async sendViaVendor(message: SMSMessage, vendor: VendorConfig): Promise<SMSResult> {
    switch (vendor.type) {
      case 'textbelt':
        return await this.sendViaTextBelt(message, vendor.config);
      case 'extremesms':
        return await this.sendViaExtremeSMS(message, vendor.config);
      case 'twilio':
        return await this.sendViaTwilio(message, vendor.config);
      case 'anveo':
        return await this.sendViaAnveo(message, vendor.config);
      case 'vonage':
        return await this.sendViaVonage(message, vendor.config);
      case 'custom':
        return await this.sendViaCustom(message, vendor.config);
      default:
        throw new Error(`Unsupported vendor type: ${(vendor as any).type}`);
    }
  }

  private async sendViaTextBelt(message: SMSMessageEnhanced, config: any): Promise<SMSResult> {
    console.log('[TextBelt Send] Starting send to:', message.recipient);
    
    // Use smart key rotation from pool for anti-abuse protection
    let apiKey = config.apiKey;
    let selectedKeyId: string = 'config-default';
    
    try {
      // Always try to use key pool for better distribution
      const pool = await storage.getActiveApiKeys('textbelt');
      if (Array.isArray(pool) && pool.length > 0) {
        const selection = await selectBestKey(pool);
        if (selection) {
          apiKey = selection.key.api_key || selection.key.apiKey || selection.key.key || apiKey;
          selectedKeyId = selection.keyId;
          console.log('[TextBelt Send] Smart rotation selected key:', selectedKeyId.slice(0, 8) + '...');
        } else {
          console.warn('[TextBelt Send] No available keys from smart rotation, using fallback');
        }
      } else if (config.useKeyPool) {
        console.warn('[TextBelt Send] Key pool enabled but empty, using config.apiKey');
      }
    } catch (e: any) {
      console.warn('[TextBelt Send] Key selection error, falling back to config.apiKey:', e?.message || e);
    }

    const maskedKey = apiKey ? (apiKey.substring(0, 8) + '...') : 'no-key';
    console.log('[TextBelt Send] API Key (masked):', maskedKey);

    const params = new URLSearchParams({
      phone: message.recipient,
      key: apiKey,
    });

    // Build message with sender name and opt-out if enabled
    let finalMessage = message.message;
    
    if (message.useSenderName && message.senderName) {
      finalMessage = `${finalMessage} - ${message.senderName}`;
    }
    
    if (message.useOptOut && message.optOutMessage) {
      finalMessage = `${finalMessage} ${message.optOutMessage}`;
    }
    
    params.append('message', finalMessage);

    // ALWAYS add webhook for reply routing (TextBelt requires this per-send)
    // Use randomized webhook proxy domain rotation to avoid bans
    const replyWebhookUrl = await this.getRandomWebhookUrl();
    params.append('replyWebhookUrl', replyWebhookUrl);
    console.log('[TextBelt Send] Reply webhook URL (randomized):', replyWebhookUrl);
    
    // Include userId and other custom data in webhookData for routing replies
    // TextBelt limits webhookData to 100 characters, so we keep it minimal
    const webhookDataObj: Record<string, string> = {};
    if (message.customData?.userId) {
      webhookDataObj.userId = message.customData.userId;
    }
    if (message.webhookData) {
      try {
        const parsed = typeof message.webhookData === 'string' ? JSON.parse(message.webhookData) : message.webhookData;
        Object.assign(webhookDataObj, parsed);
      } catch {
        // If it's not JSON, store as-is
        webhookDataObj.data = message.webhookData;
      }
    }
    if (Object.keys(webhookDataObj).length > 0) {
      params.append('webhookData', JSON.stringify(webhookDataObj));
      console.log('[TextBelt Send] Webhook data being sent:', JSON.stringify(webhookDataObj));
    }

    try {
      const axiosConfig: any = {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      };
      
      // Try Webshare rotating proxy first, then fall back to static proxy
      if (webshareProxyManager.isEnabled()) {
        const proxyAgent = await webshareProxyManager.getProxyAgent();
        if (proxyAgent) {
          axiosConfig.httpsAgent = proxyAgent;
          console.log('[TextBelt Send] Using Webshare rotating proxy');
        }
      } else if (staticProxyAgent) {
        axiosConfig.httpsAgent = staticProxyAgent;
        console.log('[TextBelt Send] Using static US proxy');
      }
      
      const response = await axios.post(`${config.baseUrl}/text`, params, axiosConfig);

      const data = response.data;
      console.log('[TextBelt Send] Response:', JSON.stringify(data));
      
      // Record usage for smart key rotation (success tracking)
      recordKeyUsage(selectedKeyId, data.success === true);
      
      // Map TextBelt response to proper status values per documentation:
      // DELIVERED, SENT, SENDING, FAILED, UNKNOWN
      // TextBelt returns success: true when queued/sent, so initial status is SENDING
      let initialStatus = 'SENDING';
      if (!data.success) {
        initialStatus = 'FAILED';
      }
      return {
        success: data.success,
        messageId: data.textId,
        vendorMessageId: data.textId,
        status: initialStatus,
        cost: 0,
        vendor: 'textbelt',
        error: data.error || undefined,
      };
    } catch (error: any) {
      console.error('[TextBelt Send] Error:', error.response?.data || error.message);
      
      // Record failure for smart key rotation (error tracking)
      recordKeyUsage(selectedKeyId, false);
      
      return {
        success: false,
        cost: 0,
        vendor: 'textbelt',
        error: error.response?.data?.error || error.message,
      };
    }
  }

  private async sendViaExtremeSMS(message: SMSMessage, config: any): Promise<SMSResult> {
    const params = new URLSearchParams({
      key: config.apiKey,
      route: config.route || '4',
      number: message.recipient,
      message: message.message,
    });

    if (config.senderId) {
      params.append('senderid', config.senderId);
    }

    if (config.unicode) {
      params.append('unicode', '1');
    }

    if (config.flash) {
      params.append('flash', '1');
    }

    const response = await axios.post(`${config.baseUrl}/api/sms/send?${params}`);
    const data = response.data;

    return {
      success: data.status === 'success',
      messageId: data.message_id,
      vendorMessageId: data.message_id,
      cost: data.cost ? parseFloat(data.cost) : 0,
      vendor: 'extremesms',
    };
  }

  private async sendViaAnveo(message: SMSMessage, config: any): Promise<SMSResult> {
    // Track which key was selected for usage recording
    let selectedKeyId: string = 'anveo-default';
    let selectedNumber: string = '';
    let workerUrl: string = '';
    
    try {
      // === STEP 1: NUMBER POOL SELECTION (NEW) ===
      // Check if recipient opted out
      if (await numberPoolManager.isOptedOut(message.recipient)) {
        console.warn(`[Anveo] Recipient ${message.recipient} has opted out - blocking send`);
        return {
          success: false,
          status: 'BLOCKED',
          vendor: 'anveo',
          cost: 0,
          error: 'Recipient has opted out'
        };
      }

      // Select number from pool (sticky routing for conversation continuity)
      const userId = (message as any).userId || 'system';
      const numberSelection = await numberPoolManager.selectNumber(userId, message.recipient);
      
      if (!numberSelection) {
        console.error('[Anveo] No available numbers in pool! All at daily limit.');
        return {
          success: false,
          status: 'FAILED',
          vendor: 'anveo',
          cost: 0,
          error: 'No available numbers - all at daily limit'
        };
      }

      selectedNumber = numberSelection.number;
      workerUrl = numberSelection.worker_url;
      console.log(`[Anveo] Selected from pool: ${selectedNumber}, worker: ${workerUrl}`);

      // === STEP 2: API KEY SELECTION (EXISTING LOGIC) ===
      // Support pool of Anveo keys stored in vendor_api_key_pool with SMART ROTATION
      let apiKey = config.apiKey || config.api_key || '';
      let fromNumber = selectedNumber; // USE THE POOL NUMBER, not config

      // Try to get key from pool with smart anti-abuse rotation
      try {
        const poolKeys = await storage.getActiveApiKeys('anveo');
        if (Array.isArray(poolKeys) && poolKeys.length > 0) {
          console.log(`[Anveo] Found ${poolKeys.length} keys in pool, using smart rotation...`);
          
          // Use smart key selection (same as TextBelt)
          const selected = await selectBestKey(poolKeys);
          
          if (selected) {
            const { key: selectedKey, keyId } = selected;
            selectedKeyId = keyId;
            apiKey = selectedKey.api_key || selectedKey.apiKey || apiKey;
            // DO NOT override fromNumber from key - use pool selection
            console.log(`[Anveo] Smart rotation selected key: ${selectedKeyId.slice(0, 8)}...`);
          } else {
            console.warn('[Anveo] Smart rotation returned no key, using config fallback');
          }
        }
      } catch (e: any) {
        console.warn('[Anveo] Failed to select from key pool, falling back to config:', e?.message || e);
      }

      if (!apiKey) {
        throw new Error('Anveo API key not configured. Add keys to vendor_api_key_pool with vendor="anveo"');
      }

      if (!fromNumber) {
        throw new Error('No from_number selected from pool - this should not happen');
      }

      const params: any = {
        apikey: apiKey,
        action: 'sms',
        destination: message.recipient,
        message: message.message,
      };

      if (fromNumber) params.from = fromNumber;

      console.log(`[Anveo Send] Sending to ${message.recipient} from ${fromNumber || 'default'}`);
      
      // Anveo supports GET and POST; use GET for simplicity
      const response = await axios.get('https://www.anveo.com/api/v1.asp', { params, timeout: 15000 });
      const text = String(response.data || '');
      console.log(`[Anveo Send] Raw response: ${text}`);
      
      // Parse result string: result=AAAA^error=BBBB^parts=N^fee=ZZZ^smsid=YYYY
      const parts = text.split('^');
      const map: Record<string, string> = {};
      for (const p of parts) {
        const kv = p.split('=');
        if (kv.length >= 2) map[kv[0]] = kv.slice(1).join('=');
      }

      const success = (map['result'] || '').toLowerCase() === 'success';
      const fee = map['fee'] ? parseFloat(map['fee']) : 0;
      const smsid = map['smsid'] || undefined;
      
      // Record usage for smart key rotation
      recordKeyUsage(selectedKeyId, success);

      return {
        success,
        messageId: smsid,
        vendorMessageId: smsid,
        status: success ? 'SENT' : 'FAILED',
        cost: fee || 0,
        vendor: 'anveo',
        error: map['error'] || undefined,
      };
    } catch (error: any) {
      console.error('[Anveo Send] Error sending to', message.recipient, error?.response?.data || error?.message || error);
      
      // Record failure for smart key rotation
      recordKeyUsage(selectedKeyId, false);
      
      return {
        success: false,
        status: 'FAILED',
        vendor: 'anveo',
        cost: 0,
        error: error?.response?.data || error?.message || String(error),
      };
    }
  }

  private async sendViaTwilio(message: SMSMessage, config: any): Promise<SMSResult> {
    const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
    
    const payload = new URLSearchParams({
      To: message.recipient,
      From: config.fromNumber,
      Body: message.message,
    });

    const response = await axios.post(
      `${config.baseUrl}/Accounts/${config.accountSid}/Messages.json`,
      payload,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const data = response.data;
    return {
      success: true,
      messageId: data.sid,
      vendorMessageId: data.sid,
      cost: data.price ? parseFloat(data.price) : 0,
      vendor: 'twilio',
    };
  }

  private async sendViaVonage(message: SMSMessage, config: any): Promise<SMSResult> {
    const payload = new URLSearchParams({
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      to: message.recipient,
      from: config.from,
      text: message.message,
    });

    const response = await axios.post(`${config.baseUrl}/sms/json`, payload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = response.data;
    const messageData = data.messages[0];
    
    return {
      success: messageData.status === '0',
      messageId: messageData.messageId,
      vendorMessageId: messageData.messageId,
      cost: messageData['message-price'] ? parseFloat(messageData['message-price']) : 0,
      vendor: 'vonage',
    };
  }

  private async sendViaCustom(message: SMSMessage, config: any): Promise<SMSResult> {
    const headers = {
      'Content-Type': config.requestFormat === 'json' ? 'application/json' : 'application/x-www-form-urlencoded',
      ...config.headers,
    };

    // Add authentication headers
    switch (config.authType) {
      case 'apikey':
        if (config.authConfig?.apiKey) {
          headers['X-API-Key'] = config.authConfig.apiKey;
        }
        break;
      case 'bearer':
        if (config.authConfig?.token) {
          headers['Authorization'] = `Bearer ${config.authConfig.token}`;
        }
        break;
      case 'basic':
        if (config.authConfig?.username && config.authConfig?.password) {
          const auth = Buffer.from(`${config.authConfig.username}:${config.authConfig.password}`).toString('base64');
          headers['Authorization'] = `Basic ${auth}`;
        }
        break;
    }

    let payload: any;
    if (config.requestFormat === 'json') {
      payload = {
        to: message.recipient,
        message: message.message,
        ...config.authConfig,
      };
    } else {
      payload = new URLSearchParams({
        to: message.recipient,
        message: message.message,
        ...config.authConfig,
      });
    }

    const response = await axios.post(config.baseUrl, payload, { headers });
    
    // Parse response based on format
    let data = response.data;
    if (config.responseFormat === 'json') {
      return {
        success: this.getNestedValue(data, config.successPath) === true,
        messageId: this.getNestedValue(data, config.messageIdPath),
        vendorMessageId: this.getNestedValue(data, config.messageIdPath),
        cost: 0,
        vendor: 'custom',
        error: this.getNestedValue(data, config.errorPath),
      };
    } else {
      return {
        success: true,
        messageId: data,
        vendorMessageId: data,
        cost: 0,
        vendor: 'custom',
      };
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

async checkVendorHealth(vendor: SMSVendor): Promise<{ healthy: boolean; reason?: string; quota?: number }> {
    try {
      if (vendor.type === 'textbelt') {
        const response = await axios.get(`${vendor.config.baseUrl}/quota/${vendor.config.apiKey}`);
        return { 
          healthy: response.data.success !== false && response.data.quotaRemaining > 0,
          quota: response.data.quotaRemaining,
          reason: response.data.quotaRemaining === 0 ? 'No quota remaining' : undefined
        };
      }
      
      if (vendor.type === 'extremesms') {
        const response = await axios.get(`${vendor.config.baseUrl}/api/account/balance`, {
          headers: { 'Authorization': `Bearer ${vendor.config.apiKey}` }
        });
        return { 
          healthy: response.status === 200,
          quota: response.data.balance || 0
        };
      }

      return { healthy: false, reason: 'Unknown vendor type' };
    } catch (error: any) {
      return { healthy: false, reason: error?.message || String(error) };
    }
  }

  async getDeliveryStatus(vendor: SMSVendor, messageId: string): Promise<{ status: string; delivered: boolean; error?: string }> {
    try {
      if (vendor.type === 'textbelt') {
        const response = await axios.get(`${vendor.config.baseUrl}/status/${messageId}`);
        const status = response.data.status || 'UNKNOWN';
        return {
          status,
          delivered: status === 'DELIVERED',
          error: status === 'FAILED' ? 'Delivery failed' : undefined
        };
      }

      if (vendor.type === 'extremesms') {
        const response = await axios.get(`${vendor.config.baseUrl}/api/sms/status/${messageId}`, {
          headers: { 'Authorization': `Bearer ${vendor.config.apiKey}` }
        });
        return {
          status: response.data.status || 'UNKNOWN',
          delivered: response.data.status === 'delivered',
          error: response.data.error
        };
      }

      return { status: 'UNKNOWN', delivered: false, error: 'Unknown vendor type' };
    } catch (error: any) {
      return { status: 'ERROR', delivered: false, error: error?.message || String(error) };
    }
  }

  async getQuota(vendor: SMSVendor): Promise<{ remaining: number; total?: number; success: boolean }> {
    try {
      if (vendor.type === 'textbelt') {
        const response = await axios.get(`${vendor.config.baseUrl}/quota/${vendor.config.apiKey}`);
        return {
          remaining: response.data.quotaRemaining || 0,
          total: 1000, // TextBelt free tier
          success: response.data.success
        };
      }

      if (vendor.type === 'extremesms') {
        const response = await axios.get(`${vendor.config.baseUrl}/api/account/balance`, {
          headers: { 'Authorization': `Bearer ${vendor.config.apiKey}` }
        });
        return {
          remaining: response.data.balance || 0,
          total: response.data.totalBalance,
          success: true
        };
      }

      return { remaining: 0, success: false };
    } catch (error) {
      return { remaining: 0, success: false };
    }
  }

  async getActiveVendorBalance(): Promise<{ balance: number; vendor: string; success: boolean }> {
    const activeVendor = this.getActiveVendor();
    
    if (activeVendor.id === 'textbelt') {
      // TextBelt free tier - always show 1000 credits for demo
      return {
        balance: 1000,
        vendor: 'textbelt',
        success: true
      };
    }
    
    if (activeVendor.id === 'extremesms') {
      const quota = await this.getQuota(activeVendor);
      return {
        balance: quota.remaining,
        vendor: 'extremesms',
        success: quota.success
      };
    }
    
    return { balance: 0, vendor: activeVendor.id, success: false };
  }
}