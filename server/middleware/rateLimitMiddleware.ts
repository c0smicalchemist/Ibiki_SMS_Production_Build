import rateLimit from "express-rate-limit";
import { env } from "../env";

/**
 * Rate limiters for different endpoints
 * Prevents brute force attacks and DoS
 */

/**
 * Authentication rate limiter: 5 attempts per 15 minutes
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs
  message: "Too many authentication attempts, please try again later",
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting in development
    return env.NODE_ENV === "development";
  },
  keyGenerator: (req) => {
    // Rate limit by IP address
    return (req.ip || req.socket.remoteAddress || "unknown") as string;
  },
});

/**
 * API key rate limiter: 100 requests per minute per key
 * This is for the public API endpoint /api/v2/sms/*
 */
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: "Too many API requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return env.NODE_ENV === "development";
  },
  keyGenerator: (req) => {
    // Rate limit by API key (from Authorization header)
    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const apiKey = authHeader.substring(7);
      return `api_key_${apiKey.substring(0, 8)}`;
    }
    // Fallback to IP if no API key
    return (req.ip || req.socket.remoteAddress || "unknown") as string;
  },
});

/**
 * Webhook rate limiter: 50 requests per minute per IP
 * ExtremeSMS webhooks should be sent from their IPs
 */
export const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50, // 50 requests per minute
  message: "Webhook endpoint rate limited",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return env.NODE_ENV === "development";
  },
  keyGenerator: (req) => {
    // Rate limit by source IP
    return (req.ip || req.socket.remoteAddress || "unknown") as string;
  },
});

/**
 * General API rate limiter: 1000 requests per minute per user
 * For authenticated dashboard endpoints
 */
export const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per minute
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return env.NODE_ENV === "development";
  },
  keyGenerator: (req) => {
    // For authenticated requests, use user ID from token
    const authHeader = req.headers["authorization"];
    if (authHeader && (req as any).user?.userId) {
      return `user_${(req as any).user.userId}`;
    }
    // Fallback to IP
    return (req.ip || req.socket.remoteAddress || "unknown") as string;
  },
});
