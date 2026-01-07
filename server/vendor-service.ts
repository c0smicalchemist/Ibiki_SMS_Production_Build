import axios from 'axios';
import { SMSMessage, SMSResult } from '../shared/vendor-config';
import { VendorManager } from './vendor-manager';
import { VendorConfig } from '../shared/vendor-schema';
import { SMSMessageEnhanced, VendorConfiguration } from '../shared/vendor-config-enhanced';

// Type alias for vendor (used by health/status checks)
type SMSVendor = VendorConfig;

export class VendorService {
  private vendorManager: VendorManager;

  constructor() {
    this.vendorManager = VendorManager.getInstance();
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
      
      // Update vendor state before sending
      const state = this.vendorManager.getVendorState(activeVendor.id);
      if (state) {
        state.totalMessages += 1;
      }

      let result: SMSResult;
      
      switch (activeVendor.type) {
        case 'textbelt':
          result = await this.sendViaTextBelt(message, activeVendor.config);
          break;
        case 'extremesms':
          result = await this.sendViaExtremeSMS(message, activeVendor.config);
          break;
        case 'twilio':
          result = await this.sendViaTwilio(message, activeVendor.config);
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
      case 'vonage':
        return await this.sendViaVonage(message, vendor.config);
      case 'custom':
        return await this.sendViaCustom(message, vendor.config);
      default:
        throw new Error(`Unsupported vendor type: ${(vendor as any).type}`);
    }
  }

  private async sendViaTextBelt(message: SMSMessageEnhanced, config: any): Promise<SMSResult> {
    const params = new URLSearchParams({
      phone: message.recipient,
      key: config.apiKey,
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

    // Add webhook configuration if enabled
    if (message.useWebhook && message.webhookUrl) {
      params.append('replyWebhookUrl', message.webhookUrl);
    }
    
    if (message.webhookData) {
      params.append('webhookData', message.webhookData);
    }

    const response = await axios.post(`${config.baseUrl}/text`, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = response.data;
    return {
      success: data.success,
      messageId: data.textId,
      vendorMessageId: data.textId,
      cost: 0,
      vendor: 'textbelt',
    };
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