// Minimal vendor configuration for rapid implementation
export interface SMSVendor {
  id: string;
  name: string;
  type: 'extremesms' | 'textbelt';
  config: {
    apiKey: string;
    baseUrl: string;
    senderId?: string;
  };
}

export interface SMSMessage {
  recipient: string;
  message: string;
  sender?: string;
  userId?: string;  // Required for sticky routing - ensures same number for conversation threads
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  vendorMessageId?: string;
  status?: string;
  cost?: number;
  error?: string;
  vendor: string;
}

export const VENDORS = {
  TEXTBELT: {
    id: 'textbelt',
    name: 'TextBelt',
    type: 'textbelt' as const,
    config: {
      baseUrl: 'https://textbelt.com',
      apiKey: process.env.TEXTBELT_API_KEY || 'textbelt',
    }
  },
  EXTREMESMS: {
    id: 'extremesms',
    name: 'ExtremeSMS',
    type: 'extremesms' as const,
    config: {
      baseUrl: 'https://extremesms.net',
      apiKey: process.env.EXTREMESMS_API_KEY || '',
      senderId: process.env.EXTREMESMS_SENDER_ID,
    }
  }
};