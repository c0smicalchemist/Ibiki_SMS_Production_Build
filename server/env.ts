import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

// Load environment variables immediately
const envFile = process.env.NODE_ENV?.trim() === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: envFile });
// Fallback to .env
dotenv.config();

console.log('🔧 Environment loaded from', envFile);

/**
 * Environment validation schema
 * Ensures all required variables are set and have correct types
 */
const envSchema = z.object({
  // Critical: Required in all environments
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL URL"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters").optional(),
  WEBHOOK_SECRET: z.string().min(32, "WEBHOOK_SECRET must be at least 32 characters"),

  // Admin configuration
  SUPER_ADMIN_EMAIL: z.string().email().optional(),

  // Server config
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  PORT: z.coerce.number().int().positive().default(5000),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Optional: Email service
  RESEND_API_KEY: z.string().optional(),

  // Optional: SMS vendor keys (can be configured via system config)
  EXTREMESMS_API_KEY: z.string().optional(),
  TEXTBELT_API_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  VONAGE_API_KEY: z.string().optional(),
  VONAGE_API_SECRET: z.string().optional(),
});

type Environment = z.infer<typeof envSchema>;

/**
 * Validate and parse environment variables with strict production checks
 */
function validateEnv(): Environment {
  // Trim NODE_ENV to handle Windows set command issues
  if (process.env.NODE_ENV) {
    process.env.NODE_ENV = process.env.NODE_ENV.trim();
  }
  
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Environment validation failed:");
    result.error.errors.forEach((error) => {
      const path = error.path.join(".");
      console.error(`  ${path}: ${error.message}`);
    });
    process.exit(1);
  }

  // Additional validation for production
  if (result.data.NODE_ENV === "production") {
    const errors: string[] = [];

    // SESSION_SECRET and JWT_SECRET must be different
    if (result.data.SESSION_SECRET === result.data.JWT_SECRET) {
      errors.push("SESSION_SECRET and JWT_SECRET must be different in production");
    }

    // WEBHOOK_SECRET must not be default value
    if (result.data.WEBHOOK_SECRET.includes("CHANGE_THIS") || result.data.WEBHOOK_SECRET === "CHANGE_THIS_TO_A_RANDOM_SECRET_STRING_BEFORE_DEPLOYMENT") {
      errors.push("WEBHOOK_SECRET contains placeholder value - must be changed in production");
    }

    // SESSION_SECRET must not be default value
    if (result.data.SESSION_SECRET.includes("CHANGE_THIS") || result.data.SESSION_SECRET === "CHANGE_THIS_TO_A_RANDOM_SECRET_STRING_BEFORE_DEPLOYMENT") {
      errors.push("SESSION_SECRET contains placeholder value - must be changed in production");
    }

    if (errors.length > 0) {
      console.error("❌ Production environment validation failed:");
      errors.forEach((error) => {
        console.error(`  - ${error}`);
      });
      process.exit(1);
    }

    // Warn if optional email service is not configured
    if (!result.data.RESEND_API_KEY) {
      console.warn("⚠️  RESEND_API_KEY not set - password reset emails will not work");
    }
  }

  // Log successful validation
  console.log("✅ Environment variables validated");
  if (result.data.NODE_ENV === "production") {
    console.log(`   NODE_ENV: ${result.data.NODE_ENV}`);
    console.log(`   PORT: ${result.data.PORT}`);
    try {
      const dbUrl = new URL(result.data.DATABASE_URL);
      console.log(`   DATABASE: ${dbUrl.hostname}/${dbUrl.pathname.slice(1)}`);
    } catch (e) {
      console.log("   DATABASE: configured");
    }
  }

  return result.data;
}

// Validate on import and export for type safety
export const env = validateEnv();
export type AppEnv = typeof env;
