import axios from 'axios';
import { SMSVendor, SMSMessage, SMSResult, VENDORS } from '../shared/vendor-config';

export class VendorService {
  private activeVendor: SMSVendor = VENDORS.TEXTBELT; // TextBelt as primary

  setActiveVendor(vendorId: string): void {
    const vendor = Object.values(VENDORS).find(v => v.id === vendorId);
    if (vendor) {
      this.activeVendor = vendor;
    }
  }

  getActiveVendor(): SMSVendor {
    return this.activeVendor;
  }

  getAvailableVendors(): SMSVendor[] {
    return Object.values(VENDORS);
  }

  async sendSMS(message: SMSMessage): Promise<SMSResult> {
    try {
      switch (this.activeVendor.type) {
        case 'textbelt':
          return await this.sendViaTextBelt(message);
        case 'extremesms':
          return await this.sendViaExtremeSMS(message);
        default:
          throw new Error(`Unsupported vendor: ${this.activeVendor.type}`);
      }
    } catch (error) {
      // Fallback to ExtremeSMS if TextBelt fails
      if (this.activeVendor.type === 'textbelt' && VENDORS.EXTREMESMS.config.apiKey) {
        console.log('TextBelt failed, falling back to ExtremeSMS');
        return await this.sendViaExtremeSMS(message);
      }
      throw error;
    }
  }

  private async sendViaTextBelt(message: SMSMessage): Promise<SMSResult> {
    const payload = {
      phone: message.recipient,
      message: message.message,
      key: this.activeVendor.config.apiKey,
    };

    const response = await axios.post(`${this.activeVendor.config.baseUrl}/text`, payload);
    const data = response.data;

    return {
      success: data.success,
      messageId: data.textId,
      vendorMessageId: data.textId,
      cost: 0.01, // TextBelt standard rate
      vendor: 'textbelt',
      error: data.error
    };
  }

  private async sendViaExtremeSMS(message: SMSMessage): Promise<SMSResult> {
    const payload = {
      to: message.recipient,
      message: message.message,
      sender: message.sender || this.activeVendor.config.senderId,
    };

    const response = await axios.post(
      `${this.activeVendor.config.baseUrl}/api/sms/send`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${this.activeVendor.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = response.data;

    return {
      success: data.success,
      messageId: data.messageId,
      vendorMessageId: data.messageId,
      cost: data.cost || 0.01,
      vendor: 'extremesms',
      error: data.error
    };
  }

  async checkVendorHealth(vendor: SMSVendor): Promise<{ healthy: boolean; reason?: string }> {
    try {
      if (vendor.type === 'textbelt') {
        const response = await axios.get(`${vendor.config.baseUrl}/quota/${vendor.config.apiKey}`);
        return { healthy: response.data.success !== false };
      }
      
      if (vendor.type === 'extremesms') {
        const response = await axios.get(`${vendor.config.baseUrl}/api/account/balance`, {
          headers: { 'Authorization': `Bearer ${vendor.config.apiKey}` }
        });
        return { healthy: response.status === 200 };
      }

      return { healthy: false, reason: 'Unknown vendor type' };
    } catch (error) {
      return { healthy: false, reason: error.message };
    }
  }
}