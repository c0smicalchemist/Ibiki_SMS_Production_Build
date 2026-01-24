import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean, index, jsonb, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table - both clients and admin
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(), // bcrypt hashed
  name: text("name").notNull(),
  company: text("company"),
  role: text("role").notNull().default("client"), // "admin" | "supervisor" | "client"
  groupId: text("group_id"),
  isActive: boolean("is_active").notNull().default(true),
  resetToken: text("reset_token"), // Password reset token
  resetTokenExpiry: timestamp("reset_token_expiry"), // Token expiration time
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  emailIdx: index("email_idx").on(table.email),
  resetTokenIdx: index("reset_token_idx").on(table.resetToken),
  groupIdIdx: index("user_group_id_idx").on(table.groupId),
}));

// Client API keys
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  keyHash: text("key_hash").notNull().unique(), // SHA-256 hash of the key
  keyPrefix: text("key_prefix").notNull(), // First 8 chars for display (e.g., "ibk_live_")
  keySuffix: text("key_suffix").notNull(), // Last 4 chars for display
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
}, (table) => ({
  userIdIdx: index("user_id_idx").on(table.userId),
  keyHashIdx: index("key_hash_idx").on(table.keyHash),
}));

// Client profiles with credit balance
export const clientProfiles = pgTable("client_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  credits: decimal("credits", { precision: 10, scale: 2 }).notNull().default("0.00"), // Legacy - prefer vendor-specific columns
  creditsTextbelt: decimal("credits_textbelt", { precision: 10, scale: 2 }).notNull().default("0.00"),
  creditsExtremesms: decimal("credits_extremesms", { precision: 10, scale: 2 }).notNull().default("0.00"),
  creditsAnveo: decimal("credits_anveo", { precision: 10, scale: 2 }).notNull().default("0.00"),
  currency: text("currency").notNull().default("USD"),
  customMarkup: decimal("custom_markup", { precision: 10, scale: 4 }), // Optional custom markup for this client
  assignedPhoneNumbers: text("assigned_phone_numbers").array(), // Array of phone numbers assigned to this client for routing incoming SMS
  rateLimitPerMinute: integer("rate_limit_per_minute").notNull().default(200), // Max messages per minute
  businessName: text("business_name"),
  deliveryMode: text("delivery_mode").default("poll"),
  webhookUrl: text("webhook_url"),
  webhookSecret: text("webhook_secret"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// System configuration
export const systemConfig = pgTable("system_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Vendor configuration
export const vendorConfigs = pgTable("vendor_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(), // 'textbelt', 'extremesms', etc.
  isActive: boolean("is_active").notNull().default(true),
  config: jsonb("config").notNull(), // JSON object with vendor-specific settings
  priority: integer("priority").notNull().default(0), // Lower = higher priority
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  nameIdx: index("vendor_name_idx").on(table.name),
  activeIdx: index("vendor_active_idx").on(table.isActive),
}));

// Message logs for tracking and billing
export const messageLogs = pgTable("message_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  messageId: text("message_id").notNull(), // Internal message ID
  vendorMessageId: varchar("vendor_message_id", { length: 255 }), // Vendor's message ID (e.g., TextBelt textId) - used for webhook reply matching
  vendor: text("vendor").notNull().default('extremesms'), // 'textbelt' or 'extremesms'
  endpoint: text("endpoint").notNull(), // Which endpoint was called
  recipient: text("recipient"),
  recipients: text("recipients").array(), // For bulk messages
  senderPhoneNumber: text("sender_phone_number"), // Phone number used to SEND this message (for 2-way SMS routing)
  status: text("status").notNull(), // queued, sent, delivered, failed
  costPerMessage: decimal("cost_per_message", { precision: 10, scale: 4 }).notNull(), // What vendor charged
  chargePerMessage: decimal("charge_per_message", { precision: 10, scale: 4 }).notNull(), // What we charged the client
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull(),
  totalCharge: decimal("total_charge", { precision: 10, scale: 2 }).notNull(),
  messageCount: integer("message_count").notNull().default(1),
  requestPayload: text("request_payload"), // JSON string
  responsePayload: text("response_payload"), // JSON string
  isExample: boolean("is_example").notNull().default(false), // Mark as example data for UI preview
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("message_user_id_idx").on(table.userId),
  createdAtIdx: index("message_created_at_idx").on(table.createdAt),
  messageIdIdx: index("message_id_idx").on(table.messageId),
  senderPhoneIdx: index("message_sender_phone_idx").on(table.senderPhoneNumber),
  isExampleIdx: index("message_is_example_idx").on(table.isExample),
}));

// Credit transactions for audit trail
export const creditTransactions = pgTable("credit_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  type: text("type").notNull(), // "credit", "debit", "adjustment"
  description: text("description").notNull(),
  balanceBefore: decimal("balance_before", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(),
  messageLogId: varchar("message_log_id").references(() => messageLogs.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("transaction_user_id_idx").on(table.userId),
  createdAtIdx: index("transaction_created_at_idx").on(table.createdAt),
}));

// Incoming SMS messages from ExtremeSMS webhook
export const incomingMessages = pgTable("incoming_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // Assigned client, null if unassigned
  from: text("from").notNull(), // Sender phone number
  firstname: text("firstname"),
  lastname: text("lastname"),
  business: text("business"),
  message: text("message").notNull(),
  status: text("status").notNull(), // "received" or "blocked"
  matchedBlockWord: text("matched_block_word"),
  receiver: text("receiver").notNull(), // Your phone number that received the SMS
  usedmodem: text("usedmodem"),
  port: text("port"),
  extPayload: jsonb("ext_payload"),
  timestamp: timestamp("timestamp").notNull(), // From ExtremeSMS
  messageId: text("message_id").notNull(), // ExtremeSMS message ID
  isRead: boolean("is_read").notNull().default(false), // Track if message has been read
  isExample: boolean("is_example").notNull().default(false), // Mark as example data for UI preview
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("incoming_user_id_idx").on(table.userId),
  receiverIdx: index("incoming_receiver_idx").on(table.receiver),
  timestampIdx: index("incoming_timestamp_idx").on(table.timestamp),
  messageIdIdx: index("incoming_message_id_idx").on(table.messageId),
  fromIdx: index("incoming_from_idx").on(table.from),
  isExampleIdx: index("incoming_is_example_idx").on(table.isExample),
}));

// Client contacts for routing (stores contact phone → client_id mapping)
export const clientContacts = pgTable("client_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  phoneNumber: text("phone_number").notNull(), // Customer phone number
  firstname: text("firstname"),
  lastname: text("lastname"),
  business: text("business"), // Should contain client_id for routing
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("contact_user_id_idx").on(table.userId),
  phoneIdx: index("contact_phone_idx").on(table.phoneNumber),
  businessIdx: index("contact_business_idx").on(table.business),
  phoneUserIdx: index("contact_phone_user_idx").on(table.phoneNumber, table.userId),
}));

// Contact groups for organizing contacts (address book feature)
export const contactGroups = pgTable("contact_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  businessUnitPrefix: text("business_unit_prefix"), // Prefix for CSV export (e.g., "IBS", "SALES")
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("group_user_id_idx").on(table.userId),
}));

// Contacts (address book feature)
export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  groupId: varchar("group_id").references(() => contactGroups.id, { onDelete: "set null" }),
  phoneNumber: text("phone_number").notNull(),
  name: text("name"),
  email: text("email"),
  notes: text("notes"),
  syncedToExtremeSMS: boolean("synced_to_extremesms").notNull().default(false), // Track if exported to ExtremeSMS
  lastExportedAt: timestamp("last_exported_at"), // When this contact was last exported
  isExample: boolean("is_example").notNull().default(false), // Mark as example data for UI preview
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("contacts_user_id_idx").on(table.userId),
  groupIdIdx: index("contacts_group_id_idx").on(table.groupId),
  phoneIdx: index("contacts_phone_idx").on(table.phoneNumber),
  syncedIdx: index("contacts_synced_idx").on(table.syncedToExtremeSMS),
  isExampleIdx: index("contacts_is_example_idx").on(table.isExample),
}));

// Zod schemas and types
export const insertUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  name: z.string().min(1),
  company: z.string().optional(),
  role: z.string().optional(),
  groupId: z.string().optional(),
  isActive: z.boolean().optional(),
  resetToken: z.string().optional(),
  resetTokenExpiry: z.date().optional(),
});

export const insertApiKeySchema = z.object({
  userId: z.string(),
  keyHash: z.string(),
  keyPrefix: z.string(),
  keySuffix: z.string(),
  isActive: z.boolean().optional(),
});

export const insertClientProfileSchema = z.object({
  userId: z.string(),
  credits: z.string().optional(),
  creditsTextbelt: z.string().optional(),
  creditsExtremesms: z.string().optional(),
  creditsAnveo: z.string().optional(),
  currency: z.string().optional(),
  customMarkup: z.string().optional(),
  assignedPhoneNumbers: z.array(z.string()).optional(),
  rateLimitPerMinute: z.number().optional(),
  businessName: z.string().optional(),
  deliveryMode: z.string().optional(),
  webhookUrl: z.string().optional(),
  webhookSecret: z.string().optional(),
});

export const insertSystemConfigSchema = z.object({
  key: z.string(),
  value: z.string(),
});

export const insertMessageLogSchema = z.object({
  userId: z.string(),
  messageId: z.string(),
  vendorMessageId: z.string().optional(),
  vendor: z.string().optional(),
  endpoint: z.string(),
  recipient: z.string().optional(),
  recipients: z.array(z.string()).optional(),
  senderPhoneNumber: z.string().optional(),
  status: z.string(),
  costPerMessage: z.string(),
  chargePerMessage: z.string(),
  totalCost: z.string(),
  totalCharge: z.string(),
  messageCount: z.number().optional(),
  requestPayload: z.string().optional(),
  responsePayload: z.string().optional(),
  isExample: z.boolean().optional(),
});

export const insertCreditTransactionSchema = z.object({
  userId: z.string(),
  amount: z.string(),
  type: z.string(),
  description: z.string(),
  balanceBefore: z.string(),
  balanceAfter: z.string(),
  messageLogId: z.string().optional(),
});

export const insertIncomingMessageSchema = z.object({
  userId: z.string().optional(),
  from: z.string(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  business: z.string().optional(),
  message: z.string(),
  status: z.string(),
  matchedBlockWord: z.string().optional(),
  receiver: z.string(),
  usedmodem: z.string().optional(),
  port: z.string().optional(),
  extPayload: z.any().optional(),
  timestamp: z.date(),
  messageId: z.string(),
  isRead: z.boolean().optional(),
  isExample: z.boolean().optional(),
  isDeleted: z.boolean().optional(),
});

export const insertClientContactSchema = z.object({
  userId: z.string(),
  phoneNumber: z.string(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  business: z.string().optional(),
});

export const insertContactGroupSchema = z.object({
  userId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  businessUnitPrefix: z.string().optional(),
});


export const insertContactSchema = z.object({
  userId: z.string(),
  groupId: z.string().optional(),
  phoneNumber: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
  notes: z.string().optional(),
  syncedToExtremeSMS: z.boolean().optional(),
  lastExportedAt: z.date().optional(),
  isExample: z.boolean().optional(),
});


export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;

export type ClientProfile = typeof clientProfiles.$inferSelect;
export type InsertClientProfile = z.infer<typeof insertClientProfileSchema>;

export type SystemConfig = typeof systemConfig.$inferSelect;
export type InsertSystemConfig = z.infer<typeof insertSystemConfigSchema>;

export type MessageLog = typeof messageLogs.$inferSelect;
export type InsertMessageLog = z.infer<typeof insertMessageLogSchema>;

export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;

export type IncomingMessage = typeof incomingMessages.$inferSelect;
export type InsertIncomingMessage = z.infer<typeof insertIncomingMessageSchema>;

export type ClientContact = typeof clientContacts.$inferSelect;
export type InsertClientContact = z.infer<typeof insertClientContactSchema>;

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

export type ContactGroup = typeof contactGroups.$inferSelect;
export type InsertContactGroup = z.infer<typeof insertContactGroupSchema>;

// Supervisor action logs
export const actionLogs = pgTable("action_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorUserId: varchar("actor_user_id").notNull().references(() => users.id),
  actorRole: text("actor_role").notNull(),
  targetUserId: varchar("target_user_id").references(() => users.id),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  actorIdx: index("action_actor_idx").on(table.actorUserId),
  createdIdx: index("action_created_idx").on(table.createdAt),
}));
export type ActionLog = typeof actionLogs.$inferSelect;
export type InsertActionLog = typeof actionLogs.$inferSelect;

// ============================================================================
// API KEY POOL - For scaling SMS throughput with multiple vendor API keys
// ============================================================================

// Vendor API Key Pool - stores multiple API keys for load balancing
export const vendorApiKeyPool = pgTable("vendor_api_key_pool", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendor: text("vendor").notNull(), // 'textbelt', 'extremesms', etc.
  name: text("name").notNull(), // Friendly name like "TextBelt Key 1"
  apiKey: text("api_key").notNull(), // The actual API key (encrypted recommended)
  isActive: boolean("is_active").notNull().default(true),
  priority: integer("priority").notNull().default(0), // Lower = higher priority
  weight: integer("weight").notNull().default(100), // For weighted distribution (0-100)
  quotaLimit: integer("quota_limit").default(0), // Total quota purchased (0 = unlimited)
  quotaUsed: integer("quota_used").notNull().default(0), // Quota used today
  quotaResetAt: timestamp("quota_reset_at"), // When quota resets
  rateLimit: decimal("rate_limit", { precision: 5, scale: 2 }).notNull().default("2.00"), // SMS per second limit
  lastUsedAt: timestamp("last_used_at"),
  lastErrorAt: timestamp("last_error_at"),
  lastError: text("last_error"),
  consecutiveErrors: integer("consecutive_errors").notNull().default(0),
  totalSent: integer("total_sent").notNull().default(0), // Lifetime messages sent
  totalFailed: integer("total_failed").notNull().default(0), // Lifetime failures
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  vendorIdx: index("vkp_vendor_idx").on(table.vendor),
  activeIdx: index("vkp_active_idx").on(table.isActive),
  priorityIdx: index("vkp_priority_idx").on(table.priority),
}));

export const insertVendorApiKeyPoolSchema = createInsertSchema(vendorApiKeyPool);
export type VendorApiKeyPool = typeof vendorApiKeyPool.$inferSelect;
export type InsertVendorApiKeyPool = z.infer<typeof insertVendorApiKeyPoolSchema>;

// SMS Queue - for queuing bulk messages during route windows
export const smsQueue = pgTable("sms_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  recipient: text("recipient").notNull(), // E.164 formatted phone number
  message: text("message").notNull(),
  priority: integer("priority").notNull().default(50), // 0-100, lower = higher priority
  status: text("status").notNull().default("pending"), // pending, processing, sent, failed, cancelled
  vendor: text("vendor"), // Target vendor (null = use default)
  apiKeyId: varchar("api_key_id").references(() => vendorApiKeyPool.id), // Which key processed this
  vendorMessageId: text("vendor_message_id"), // Message ID from vendor
  vendorStatus: text("vendor_status"), // Status from vendor
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  lastAttemptAt: timestamp("last_attempt_at"),
  lastError: text("last_error"),
  scheduledFor: timestamp("scheduled_for"), // For future scheduling (null = send immediately when routes open)
  routeWindowOnly: boolean("route_window_only").notNull().default(true), // Only send during route window
  costPerMessage: decimal("cost_per_message", { precision: 10, scale: 4 }),
  chargePerMessage: decimal("charge_per_message", { precision: 10, scale: 4 }),
  metadata: jsonb("metadata"), // Extra data (campaign ID, batch ID, etc.)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
}, (table) => ({
  userIdx: index("sq_user_idx").on(table.userId),
  statusIdx: index("sq_status_idx").on(table.status),
  priorityIdx: index("sq_priority_idx").on(table.priority),
  scheduledIdx: index("sq_scheduled_idx").on(table.scheduledFor),
  createdIdx: index("sq_created_idx").on(table.createdAt),
}));

export const insertSmsQueueSchema = createInsertSchema(smsQueue);
export type SmsQueue = typeof smsQueue.$inferSelect;
export type InsertSmsQueue = z.infer<typeof insertSmsQueueSchema>;

// Queue Statistics - for monitoring and analytics
export const queueStats = pgTable("queue_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: timestamp("date").notNull(), // Hourly bucket
  pending: integer("pending").notNull().default(0),
  processing: integer("processing").notNull().default(0),
  sent: integer("sent").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  throughputPerSec: decimal("throughput_per_sec", { precision: 10, scale: 2 }),
  avgLatencyMs: integer("avg_latency_ms"),
  routeWindowOpen: boolean("route_window_open").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  dateIdx: index("qs_date_idx").on(table.date),
}));

export type QueueStats = typeof queueStats.$inferSelect;

