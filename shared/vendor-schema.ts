import { z } from 'zod';

// Base vendor configuration schema
export const BaseVendorConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['textbelt', 'extremesms', 'twilio', 'vonage', 'custom']),
  enabled: z.boolean().default(true),
  priority: z.number().min(1).max(100).default(50),
  timeout: z.number().min(1000).max(60000).default(10000),
  retryAttempts: z.number().min(0).max(5).default(3),
  retryDelay: z.number().min(100).max(10000).default(1000),
});

// Vendor-specific configuration schemas
export const TextBeltConfigSchema = BaseVendorConfigSchema.extend({
  type: z.literal('textbelt'),
  config: z.object({
    apiKey: z.string(),
    baseUrl: z.string().url('Invalid URL format').default('https://textbelt.com'),
    maxRecipients: z.number().min(1).max(1000).default(1),
    rateLimit: z.number().min(1).max(1000).default(75), // requests per day
  }),
});

export const ExtremeSMSConfigSchema = BaseVendorConfigSchema.extend({
  type: z.literal('extremesms'),
  config: z.object({
    apiKey: z.string(),
    baseUrl: z.string().url('Invalid URL format').default('https://extremesms.net'),
    senderId: z.string().optional(),
    route: z.enum(['1', '2', '3', '4', '5']).default('4'),
    unicode: z.boolean().default(false),
    flash: z.boolean().default(false),
  }),
});

export const TwilioConfigSchema = BaseVendorConfigSchema.extend({
  type: z.literal('twilio'),
  config: z.object({
    accountSid: z.string(),
    authToken: z.string(),
    fromNumber: z.string(),
    baseUrl: z.string().url('Invalid URL format').default('https://api.twilio.com/2010-04-01'),
  }),
});

export const VonageConfigSchema = BaseVendorConfigSchema.extend({
  type: z.literal('vonage'),
  config: z.object({
    apiKey: z.string(),
    apiSecret: z.string(),
    from: z.string(),
    baseUrl: z.string().url('Invalid URL format').default('https://rest.nexmo.com'),
  }),
});

export const CustomVendorConfigSchema = BaseVendorConfigSchema.extend({
  type: z.literal('custom'),
  config: z.object({
    baseUrl: z.string().url('Invalid URL format'),
    headers: z.record(z.string()).optional(),
    authType: z.enum(['apikey', 'bearer', 'basic', 'none']).default('none'),
    authConfig: z.record(z.string()).optional(),
    requestFormat: z.enum(['json', 'form', 'xml']).default('json'),
    responseFormat: z.enum(['json', 'xml', 'text']).default('json'),
    successPath: z.string().default('success'),
    messageIdPath: z.string().default('messageId'),
    errorPath: z.string().default('error'),
  }),
});

// Union type for all vendor configurations
export const VendorConfigSchema = z.discriminatedUnion('type', [
  TextBeltConfigSchema,
  ExtremeSMSConfigSchema,
  TwilioConfigSchema,
  VonageConfigSchema,
  CustomVendorConfigSchema,
]);

// Vendor state management
export const VendorStateSchema = z.object({
  vendorId: z.string(),
  status: z.enum(['active', 'inactive', 'error', 'maintenance']),
  lastHealthCheck: z.coerce.date().optional(),
  lastError: z.string().optional(),
  consecutiveFailures: z.number().min(0).default(0),
  totalMessages: z.number().min(0).default(0),
  successfulMessages: z.number().min(0).default(0),
  failedMessages: z.number().min(0).default(0),
  averageResponseTime: z.number().min(0).default(0),
  creditsRemaining: z.number().optional(),
  rateLimitRemaining: z.number().optional(),
});

// Vendor switching configuration
export const VendorSwitchingConfigSchema = z.object({
  strategy: z.enum(['manual', 'round_robin', 'priority', 'health_based', 'cost_based']).default('manual'),
  fallbackEnabled: z.boolean().default(true),
  healthCheckInterval: z.number().min(1000).max(3600000).default(30000),
  failureThreshold: z.number().min(1).max(10).default(3),
  recoveryTime: z.number().min(1000).max(3600000).default(300000),
  costOptimization: z.boolean().default(false),
  regionBased: z.boolean().default(false),
});

// Main vendor management configuration
export const VendorManagementConfigSchema = z.object({
  activeVendorId: z.string(),
  vendors: z.array(VendorConfigSchema),
  switchingConfig: VendorSwitchingConfigSchema,
  vendorStates: z.record(z.string(), VendorStateSchema),
  createdAt: z.coerce.date().default(() => new Date()),
  updatedAt: z.coerce.date().default(() => new Date()),
});

// Types
export type BaseVendorConfig = z.infer<typeof BaseVendorConfigSchema>;
export type TextBeltConfig = z.infer<typeof TextBeltConfigSchema>;
export type ExtremeSMSConfig = z.infer<typeof ExtremeSMSConfigSchema>;
export type TwilioConfig = z.infer<typeof TwilioConfigSchema>;
export type VonageConfig = z.infer<typeof VonageConfigSchema>;
export type CustomVendorConfig = z.infer<typeof CustomVendorConfigSchema>;
export type VendorConfig = z.infer<typeof VendorConfigSchema>;
export type VendorState = z.infer<typeof VendorStateSchema>;
export type VendorSwitchingConfig = z.infer<typeof VendorSwitchingConfigSchema>;
export type VendorManagementConfig = z.infer<typeof VendorManagementConfigSchema>;

// Validation utilities
export const validateVendorConfig = (config: unknown): VendorConfig => {
  return VendorConfigSchema.parse(config);
};

export const validateVendorManagementConfig = (config: unknown): VendorManagementConfig => {
  return VendorManagementConfigSchema.parse(config);
};

// Default configurations
export const DEFAULT_VENDOR_CONFIGS = {
  textbelt: {
    id: 'textbelt',
    name: 'TextBelt',
    type: 'textbelt' as const,
    enabled: true,
    priority: 1,
    config: {
      apiKey: process.env.TEXTBELT_API_KEY || '',
      baseUrl: 'https://textbelt.com',
      maxRecipients: 1,
      rateLimit: 75,
    },
  },
  extremesms: {
    id: 'extremesms',
    name: 'ExtremeSMS',
    type: 'extremesms' as const,
    enabled: true,
    priority: 2,
    config: {
      apiKey: process.env.EXTREMESMS_API_KEY || '',
      baseUrl: 'https://extremesms.net',
      senderId: process.env.EXTREMESMS_SENDER_ID || '',
      route: '4',
      unicode: false,
      flash: false,
    },
  },
} as const;
