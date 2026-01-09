import { z } from "zod";

/**
 * Standard API Response Schemas for type safety
 */

// Base response schema
const baseResponseSchema = z.object({
  success: z.boolean().default(true),
});

const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.record(z.string()).optional(),
});

// Auth responses
export const loginResponseSchema = baseResponseSchema.extend({
  token: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
    role: z.enum(["admin", "supervisor", "client"]),
  }),
});

export const signupResponseSchema = baseResponseSchema.extend({
  message: z.string(),
  userId: z.string(),
});

// SMS API responses
export const sendSingleResponseSchema = baseResponseSchema.extend({
  success: z.literal(true),
  message: z.string(),
  messageId: z.string(),
  cost: z.number(),
  newBalance: z.number(),
});

export const sendBulkResponseSchema = baseResponseSchema.extend({
  success: z.literal(true),
  message: z.string(),
  successCount: z.number(),
  failureCount: z.number(),
  messages: z.array(
    z.object({
      recipient: z.string(),
      messageId: z.string().optional(),
      status: z.string(),
    })
  ),
  totalCost: z.number(),
  newBalance: z.number(),
});

// Profile response
export const profileResponseSchema = baseResponseSchema.extend({
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
    role: z.enum(["admin", "supervisor", "client"]),
  }),
  profile: z.object({
    credits: z.number(),
    rateLimitPerMinute: z.number(),
    apiKeys: z.array(
      z.object({
        id: z.string(),
        keyPrefix: z.string(),
        keySuffix: z.string(),
        createdAt: z.string().datetime(),
        lastUsedAt: z.string().datetime().nullable(),
      })
    ),
  }),
});

// Balance response
export const balanceResponseSchema = baseResponseSchema.extend({
  balance: z.number(),
  currency: z.string(),
  rateLimitPerMinute: z.number(),
});

// Message status response
export const messageStatusResponseSchema = baseResponseSchema.extend({
  messageId: z.string(),
  status: z.enum(["pending", "sent", "delivered", "failed"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  cost: z.number(),
});

// List responses with pagination
export const paginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) => {
  return baseResponseSchema.extend({
    items: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    pages: z.number(),
  });
};

// Health check response
export const healthCheckResponseSchema = z.object({
  status: z.enum(["alive", "ready", "not_ready"]),
  timestamp: z.string().datetime(),
  database: z.enum(["connected", "disconnected", "no_response"]).optional(),
});

// Export types from schemas
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type SignupResponse = z.infer<typeof signupResponseSchema>;
export type SendSingleResponse = z.infer<typeof sendSingleResponseSchema>;
export type SendBulkResponse = z.infer<typeof sendBulkResponseSchema>;
export type ProfileResponse = z.infer<typeof profileResponseSchema>;
export type BalanceResponse = z.infer<typeof balanceResponseSchema>;
export type MessageStatusResponse = z.infer<typeof messageStatusResponseSchema>;
export type HealthCheckResponse = z.infer<typeof healthCheckResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
