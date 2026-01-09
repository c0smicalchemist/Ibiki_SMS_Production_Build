// Enhanced vendor configuration with sender identification, opt-out, and webhook support

export interface VendorConfiguration {
  id: string;
  name: string;
  type: 'textbelt' | 'extremesms' | 'twilio' | 'vonage' | 'custom';
  config: {
    apiKey: string;
    baseUrl: string;
    senderId?: string;
    senderName?: string;
    optOutMessage?: string;
    webhookUrl?: string;
    webhookData?: string;
    useWebhook?: boolean;
    useSenderName?: boolean;
    useOptOut?: boolean;
  };
  settings: {
    enabled: boolean;
    priority: number;
    healthCheckEnabled: boolean;
    maxRetries: number;
    timeout: number;
  };
  metadata: {
    description: string;
    documentationUrl: string;
    supportUrl: string;
    pricingUrl: string;
    features: string[];
  };
}

export interface SMSMessageEnhanced {
  recipient: string;
  message: string;
  sender?: string;
  senderName?: string;
  optOutMessage?: string;
  webhookUrl?: string;
  webhookData?: string;
  useWebhook?: boolean;
  useSenderName?: boolean;
  useOptOut?: boolean;
  customData?: Record<string, any>;
}

export interface VendorTestResult {
  success: boolean;
  vendor: string;
  message?: string;
  error?: string;
  responseTime?: number;
  balance?: number;
  quota?: number;
  timestamp: string;
}

export interface WebhookConfiguration {
  url: string;
  data?: string;
  enabled: boolean;
  verifySignature: boolean;
  secret?: string;
  headers?: Record<string, string>;
}

export const VENDOR_FEATURES = {
  TEXTBELT: {
    id: 'textbelt',
    name: 'TextBelt',
    type: 'textbelt' as const,
    features: ['free_tier', 'us_only', 'webhook_replies', 'sender_name', 'opt_out'],
    limits: { daily: 1000, per_message: 1 },
    pricing: { per_message: 0.00 },
    documentationUrl: 'https://textbelt.com/faq',
    supportUrl: 'https://textbelt.com/contact',
    pricingUrl: 'https://textbelt.com/pricing'
  },
  EXTREMESMS: {
    id: 'extremesms',
    name: 'ExtremeSMS',
    type: 'extremesms' as const,
    features: ['global', 'bulk_sms', 'sender_id', 'delivery_reports', 'webhook_replies'],
    limits: { daily: 10000, per_message: 1 },
    pricing: { per_message: 0.0075 },
    documentationUrl: 'https://extremesms.net/docs',
    supportUrl: 'https://extremesms.net/support',
    pricingUrl: 'https://extremesms.net/pricing'
  }
};

export const DEFAULT_VENDOR_CONFIG: Record<string, VendorConfiguration> = {
  textbelt: {
    id: 'textbelt',
    name: 'TextBelt',
    type: 'textbelt',
    config: {
      apiKey: process.env.TEXTBELT_API_KEY || 'textbelt',
      baseUrl: 'https://textbelt.com',
      senderName: process.env.TEXTBELT_SENDER_NAME || '',
      optOutMessage: process.env.TEXTBELT_OPT_OUT_MESSAGE || 'Reply STOP to unsubscribe',
      webhookUrl: process.env.TEXTBELT_WEBHOOK_URL || '',
      webhookData: process.env.TEXTBELT_WEBHOOK_DATA || '',
      useWebhook: false,
      useSenderName: false,
      useOptOut: true
    },
    settings: {
      enabled: true,
      priority: 1,
      healthCheckEnabled: true,
      maxRetries: 3,
      timeout: 30000
    },
    metadata: {
      description: 'Free SMS service with 1000 daily messages',
      documentationUrl: 'https://textbelt.com/faq',
      supportUrl: 'https://textbelt.com/contact',
      pricingUrl: 'https://textbelt.com/pricing',
      features: ['free_tier', 'us_only', 'webhook_replies', 'sender_name', 'opt_out']
    }
  },
  extremesms: {
    id: 'extremesms',
    name: 'ExtremeSMS',
    type: 'extremesms',
    config: {
      apiKey: process.env.EXTREMESMS_API_KEY || '',
      baseUrl: 'https://extremesms.net',
      senderId: process.env.EXTREMESMS_SENDER_ID || '',
      senderName: process.env.EXTREMESMS_SENDER_NAME || '',
      optOutMessage: process.env.EXTREMESMS_OPT_OUT_MESSAGE || 'Reply STOP to unsubscribe',
      webhookUrl: process.env.EXTREMESMS_WEBHOOK_URL || '',
      webhookData: process.env.EXTREMESMS_WEBHOOK_DATA || '',
      useWebhook: false,
      useSenderName: false,
      useOptOut: true
    },
    settings: {
      enabled: true,
      priority: 2,
      healthCheckEnabled: true,
      maxRetries: 3,
      timeout: 30000
    },
    metadata: {
      description: 'Premium SMS service with global coverage',
      documentationUrl: 'https://extremesms.net/docs',
      supportUrl: 'https://extremesms.net/support',
      pricingUrl: 'https://extremesms.net/pricing',
      features: ['global', 'bulk_sms', 'sender_id', 'delivery_reports', 'webhook_replies']
    }
  }
};