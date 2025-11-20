// server/index.ts
import dotenv from "dotenv";
import express3 from "express";

// server/routes.ts
import { createServer } from "http";
import express from "express";

// shared/schema.ts
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  // bcrypt hashed
  name: text("name").notNull(),
  company: text("company"),
  role: text("role").notNull().default("client"),
  // "admin" or "client"
  isActive: boolean("is_active").notNull().default(true),
  resetToken: text("reset_token"),
  // Password reset token
  resetTokenExpiry: timestamp("reset_token_expiry"),
  // Token expiration time
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (table) => ({
  emailIdx: index("email_idx").on(table.email),
  resetTokenIdx: index("reset_token_idx").on(table.resetToken)
}));
var apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  keyHash: text("key_hash").notNull().unique(),
  // SHA-256 hash of the key
  keyPrefix: text("key_prefix").notNull(),
  // First 8 chars for display (e.g., "ibk_live_")
  keySuffix: text("key_suffix").notNull(),
  // Last 4 chars for display
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at")
}, (table) => ({
  userIdIdx: index("user_id_idx").on(table.userId),
  keyHashIdx: index("key_hash_idx").on(table.keyHash)
}));
var clientProfiles = pgTable("client_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  credits: decimal("credits", { precision: 10, scale: 2 }).notNull().default("0.00"),
  currency: text("currency").notNull().default("USD"),
  customMarkup: decimal("custom_markup", { precision: 10, scale: 4 }),
  // Optional custom markup for this client
  assignedPhoneNumbers: text("assigned_phone_numbers").array(),
  // Array of phone numbers assigned to this client for routing incoming SMS
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var systemConfig = pgTable("system_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var messageLogs = pgTable("message_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  messageId: text("message_id").notNull(),
  // ExtremeSMS message ID
  endpoint: text("endpoint").notNull(),
  // Which endpoint was called
  recipient: text("recipient"),
  recipients: text("recipients").array(),
  // For bulk messages
  senderPhoneNumber: text("sender_phone_number"),
  // Phone number used to SEND this message (for 2-way SMS routing)
  status: text("status").notNull(),
  // queued, sent, delivered, failed
  costPerMessage: decimal("cost_per_message", { precision: 10, scale: 4 }).notNull(),
  // What ExtremeSMS charged
  chargePerMessage: decimal("charge_per_message", { precision: 10, scale: 4 }).notNull(),
  // What we charged the client
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull(),
  totalCharge: decimal("total_charge", { precision: 10, scale: 2 }).notNull(),
  messageCount: integer("message_count").notNull().default(1),
  requestPayload: text("request_payload"),
  // JSON string
  responsePayload: text("response_payload"),
  // JSON string
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (table) => ({
  userIdIdx: index("message_user_id_idx").on(table.userId),
  createdAtIdx: index("message_created_at_idx").on(table.createdAt),
  messageIdIdx: index("message_id_idx").on(table.messageId),
  senderPhoneIdx: index("message_sender_phone_idx").on(table.senderPhoneNumber)
}));
var creditTransactions = pgTable("credit_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  type: text("type").notNull(),
  // "credit", "debit", "adjustment"
  description: text("description").notNull(),
  balanceBefore: decimal("balance_before", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(),
  messageLogId: varchar("message_log_id").references(() => messageLogs.id),
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (table) => ({
  userIdIdx: index("transaction_user_id_idx").on(table.userId),
  createdAtIdx: index("transaction_created_at_idx").on(table.createdAt)
}));
var incomingMessages = pgTable("incoming_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  // Assigned client, null if unassigned
  from: text("from").notNull(),
  // Sender phone number
  firstname: text("firstname"),
  lastname: text("lastname"),
  business: text("business"),
  message: text("message").notNull(),
  status: text("status").notNull(),
  // "received" or "blocked"
  matchedBlockWord: text("matched_block_word"),
  receiver: text("receiver").notNull(),
  // Your phone number that received the SMS
  usedmodem: text("usedmodem"),
  port: text("port"),
  timestamp: timestamp("timestamp").notNull(),
  // From ExtremeSMS
  messageId: text("message_id").notNull(),
  // ExtremeSMS message ID
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (table) => ({
  userIdIdx: index("incoming_user_id_idx").on(table.userId),
  receiverIdx: index("incoming_receiver_idx").on(table.receiver),
  timestampIdx: index("incoming_timestamp_idx").on(table.timestamp),
  messageIdIdx: index("incoming_message_id_idx").on(table.messageId),
  fromIdx: index("incoming_from_idx").on(table.from)
}));
var clientContacts = pgTable("client_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  phoneNumber: text("phone_number").notNull(),
  // Customer phone number
  firstname: text("firstname"),
  lastname: text("lastname"),
  business: text("business"),
  // Should contain client_id for routing
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
}, (table) => ({
  userIdIdx: index("contact_user_id_idx").on(table.userId),
  phoneIdx: index("contact_phone_idx").on(table.phoneNumber),
  businessIdx: index("contact_business_idx").on(table.business),
  phoneUserIdx: index("contact_phone_user_idx").on(table.phoneNumber, table.userId)
}));
var insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true
});
var insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true
});
var insertClientProfileSchema = createInsertSchema(clientProfiles).omit({
  id: true,
  updatedAt: true
});
var insertSystemConfigSchema = createInsertSchema(systemConfig).omit({
  id: true,
  updatedAt: true
});
var insertMessageLogSchema = createInsertSchema(messageLogs).omit({
  id: true,
  createdAt: true
});
var insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({
  id: true,
  createdAt: true
});
var insertIncomingMessageSchema = createInsertSchema(incomingMessages).omit({
  id: true,
  createdAt: true
});
var insertClientContactSchema = createInsertSchema(clientContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// server/storage.ts
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq, desc, sql as sql2 } from "drizzle-orm";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
var MemStorage = class {
  users;
  apiKeys;
  clientProfiles;
  systemConfigs;
  messageLogs;
  creditTransactions;
  incomingMessages;
  clientContacts;
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.apiKeys = /* @__PURE__ */ new Map();
    this.clientProfiles = /* @__PURE__ */ new Map();
    this.systemConfigs = /* @__PURE__ */ new Map();
    this.messageLogs = /* @__PURE__ */ new Map();
    this.creditTransactions = /* @__PURE__ */ new Map();
    this.incomingMessages = /* @__PURE__ */ new Map();
    this.clientContacts = /* @__PURE__ */ new Map();
  }
  // User methods
  async getUser(id) {
    return this.users.get(id);
  }
  async getUserByEmail(email) {
    return Array.from(this.users.values()).find(
      (user) => user.email === email
    );
  }
  async createUser(insertUser) {
    const id = randomUUID();
    const isFirstUser = this.users.size === 0;
    const user = {
      ...insertUser,
      id,
      company: insertUser.company ?? null,
      role: isFirstUser ? "admin" : insertUser.role ?? "client",
      isActive: insertUser.isActive ?? true,
      resetToken: null,
      resetTokenExpiry: null,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.users.set(id, user);
    return user;
  }
  async getAllUsers() {
    return Array.from(this.users.values());
  }
  async updateUser(id, updates) {
    const user = this.users.get(id);
    if (!user) return void 0;
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  // Password Reset methods
  async setPasswordResetToken(email, token, expiry) {
    const user = await this.getUserByEmail(email);
    if (!user) return void 0;
    return this.updateUser(user.id, {
      resetToken: token,
      resetTokenExpiry: expiry
    });
  }
  async getUserByResetToken(token) {
    const user = Array.from(this.users.values()).find(
      (u) => u.resetToken === token
    );
    if (!user) return void 0;
    if (user.resetTokenExpiry && user.resetTokenExpiry < /* @__PURE__ */ new Date()) {
      return void 0;
    }
    return user;
  }
  async clearPasswordResetToken(userId) {
    await this.updateUser(userId, {
      resetToken: null,
      resetTokenExpiry: null
    });
  }
  async updateUserPassword(userId, newPasswordHash) {
    const user = await this.getUser(userId);
    if (!user) return void 0;
    const updatedUser = await this.updateUser(userId, {
      password: newPasswordHash,
      resetToken: null,
      resetTokenExpiry: null
    });
    return updatedUser;
  }
  // API Key methods
  async getApiKeyByHash(keyHash) {
    return Array.from(this.apiKeys.values()).find(
      (key) => key.keyHash === keyHash
    );
  }
  async getApiKeysByUserId(userId) {
    return Array.from(this.apiKeys.values()).filter(
      (key) => key.userId === userId
    );
  }
  async createApiKey(insertApiKey) {
    const id = randomUUID();
    const apiKey = {
      ...insertApiKey,
      id,
      isActive: insertApiKey.isActive ?? true,
      createdAt: /* @__PURE__ */ new Date(),
      lastUsedAt: null
    };
    this.apiKeys.set(id, apiKey);
    return apiKey;
  }
  async updateApiKeyLastUsed(id) {
    const apiKey = this.apiKeys.get(id);
    if (apiKey) {
      apiKey.lastUsedAt = /* @__PURE__ */ new Date();
      this.apiKeys.set(id, apiKey);
    }
  }
  async revokeApiKey(id) {
    const apiKey = this.apiKeys.get(id);
    if (apiKey) {
      apiKey.isActive = false;
      this.apiKeys.set(id, apiKey);
    }
  }
  // Client Profile methods
  async getClientProfileByUserId(userId) {
    return Array.from(this.clientProfiles.values()).find(
      (profile) => profile.userId === userId
    );
  }
  async createClientProfile(insertProfile) {
    const id = randomUUID();
    const profile = {
      ...insertProfile,
      id,
      credits: insertProfile.credits ?? "0.00",
      currency: insertProfile.currency ?? "USD",
      customMarkup: insertProfile.customMarkup ?? null,
      assignedPhoneNumbers: insertProfile.assignedPhoneNumbers ?? null,
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.clientProfiles.set(id, profile);
    return profile;
  }
  async getClientProfileByPhoneNumber(phoneNumber) {
    return Array.from(this.clientProfiles.values()).find(
      (profile) => profile.assignedPhoneNumbers?.includes(phoneNumber)
    );
  }
  async updateClientCredits(userId, newCredits) {
    const profile = Array.from(this.clientProfiles.values()).find(
      (p) => p.userId === userId
    );
    if (!profile) return void 0;
    profile.credits = newCredits;
    profile.updatedAt = /* @__PURE__ */ new Date();
    this.clientProfiles.set(profile.id, profile);
    return profile;
  }
  async updateClientPhoneNumbers(userId, phoneNumbers) {
    const profile = Array.from(this.clientProfiles.values()).find(
      (p) => p.userId === userId
    );
    if (!profile) return void 0;
    profile.assignedPhoneNumbers = phoneNumbers.length > 0 ? phoneNumbers : null;
    profile.updatedAt = /* @__PURE__ */ new Date();
    this.clientProfiles.set(profile.id, profile);
    return profile;
  }
  // System Config methods
  async getSystemConfig(key) {
    return Array.from(this.systemConfigs.values()).find(
      (config) => config.key === key
    );
  }
  async setSystemConfig(key, value) {
    const existing = await this.getSystemConfig(key);
    if (existing) {
      existing.value = value;
      existing.updatedAt = /* @__PURE__ */ new Date();
      this.systemConfigs.set(existing.id, existing);
      return existing;
    }
    const id = randomUUID();
    const config = {
      id,
      key,
      value,
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.systemConfigs.set(id, config);
    return config;
  }
  async getAllSystemConfig() {
    return Array.from(this.systemConfigs.values());
  }
  // Message Log methods
  async createMessageLog(insertLog) {
    const id = randomUUID();
    const log2 = {
      ...insertLog,
      id,
      messageCount: insertLog.messageCount ?? 1,
      recipients: insertLog.recipients ?? null,
      recipient: insertLog.recipient ?? null,
      senderPhoneNumber: insertLog.senderPhoneNumber ?? null,
      requestPayload: insertLog.requestPayload ?? null,
      responsePayload: insertLog.responsePayload ?? null,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.messageLogs.set(id, log2);
    return log2;
  }
  async getMessageLogsByUserId(userId, limit = 100) {
    const logs = Array.from(this.messageLogs.values()).filter((log2) => log2.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return limit ? logs.slice(0, limit) : logs;
  }
  async getMessageLogByMessageId(messageId) {
    return Array.from(this.messageLogs.values()).find(
      (log2) => log2.messageId === messageId
    );
  }
  async getAllMessageLogs(limit = 1e3) {
    const logs = Array.from(this.messageLogs.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return limit ? logs.slice(0, limit) : logs;
  }
  async updateMessageStatus(logId, status) {
    const log2 = this.messageLogs.get(logId);
    if (log2) {
      log2.status = status;
      this.messageLogs.set(logId, log2);
    }
  }
  async findClientBySenderPhone(senderPhone) {
    const logs = Array.from(this.messageLogs.values()).filter((log2) => log2.senderPhoneNumber === senderPhone).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return logs.length > 0 ? logs[0].userId : void 0;
  }
  async findClientByRecipient(recipientPhone) {
    const logs = Array.from(this.messageLogs.values()).filter((log2) => {
      if (log2.recipient === recipientPhone) return true;
      if (log2.recipients && log2.recipients.includes(recipientPhone)) return true;
      return false;
    }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return logs.length > 0 ? logs[0].userId : void 0;
  }
  async getTotalMessageCount() {
    return this.messageLogs.size;
  }
  // Credit Transaction methods
  async createCreditTransaction(insertTransaction) {
    const id = randomUUID();
    const transaction = {
      ...insertTransaction,
      id,
      messageLogId: insertTransaction.messageLogId ?? null,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.creditTransactions.set(id, transaction);
    return transaction;
  }
  async getCreditTransactionsByUserId(userId, limit = 100) {
    const transactions = Array.from(this.creditTransactions.values()).filter((txn) => txn.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return limit ? transactions.slice(0, limit) : transactions;
  }
  // Incoming Message methods
  async createIncomingMessage(insertMessage) {
    const id = randomUUID();
    const message = {
      ...insertMessage,
      id,
      userId: insertMessage.userId ?? null,
      firstname: insertMessage.firstname ?? null,
      lastname: insertMessage.lastname ?? null,
      business: insertMessage.business ?? null,
      matchedBlockWord: insertMessage.matchedBlockWord ?? null,
      usedmodem: insertMessage.usedmodem ?? null,
      port: insertMessage.port ?? null,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.incomingMessages.set(id, message);
    return message;
  }
  async getIncomingMessagesByUserId(userId, limit = 100) {
    const messages = Array.from(this.incomingMessages.values()).filter((msg) => msg.userId === userId).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return limit ? messages.slice(0, limit) : messages;
  }
  async getAllIncomingMessages(limit = 100) {
    const messages = Array.from(this.incomingMessages.values()).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return limit ? messages.slice(0, limit) : messages;
  }
  // Client Contact methods (for Business field routing)
  async createClientContact(insertContact) {
    const id = randomUUID();
    const contact = {
      ...insertContact,
      id,
      firstname: insertContact.firstname ?? null,
      lastname: insertContact.lastname ?? null,
      business: insertContact.business ?? null,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.clientContacts.set(id, contact);
    return contact;
  }
  async createClientContacts(contacts) {
    const createdContacts = [];
    for (const contact of contacts) {
      const created = await this.createClientContact(contact);
      createdContacts.push(created);
    }
    return createdContacts;
  }
  async getClientContactsByUserId(userId) {
    return Array.from(this.clientContacts.values()).filter((contact) => contact.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async getClientContactByPhone(phoneNumber) {
    return Array.from(this.clientContacts.values()).find(
      (contact) => contact.phoneNumber === phoneNumber
    );
  }
  async updateClientContact(id, updates) {
    const contact = this.clientContacts.get(id);
    if (!contact) return void 0;
    const updated = {
      ...contact,
      ...updates,
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.clientContacts.set(id, updated);
    return updated;
  }
  async deleteClientContact(id) {
    this.clientContacts.delete(id);
  }
  async deleteClientContactsByUserId(userId) {
    const contactsToDelete = Array.from(this.clientContacts.entries()).filter(([_, contact]) => contact.userId === userId).map(([id, _]) => id);
    for (const id of contactsToDelete) {
      this.clientContacts.delete(id);
    }
  }
  // Error logging methods
  async getErrorLogs(level) {
    const failedLogs = Array.from(this.messageLogs.values()).filter((log2) => log2.status === "failed").map((log2) => {
      const user = this.users.get(log2.userId);
      return {
        id: log2.id,
        level: "error",
        message: `SMS delivery failed`,
        endpoint: log2.endpoint,
        userId: log2.userId,
        userName: user?.name || "Unknown",
        details: log2.responsePayload,
        timestamp: log2.createdAt.toISOString()
      };
    });
    if (level && level !== "all") {
      return failedLogs.filter((log2) => log2.level === level).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 100);
    }
    return failedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 100);
  }
};
var dbInstance = null;
var poolInstance = null;
var DbStorage = class {
  db;
  constructor() {
    if (!dbInstance) {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        console.warn("DATABASE_URL not set - DbStorage requires database connection");
        throw new Error("DATABASE_URL environment variable is not set");
      }
      neonConfig.webSocketConstructor = ws;
      poolInstance = new Pool({ connectionString });
      dbInstance = drizzle(poolInstance, {
        schema: {
          users,
          apiKeys,
          clientProfiles,
          systemConfig,
          messageLogs,
          creditTransactions,
          incomingMessages
        }
      });
      process.on("SIGINT", async () => {
        if (poolInstance) await poolInstance.end();
        process.exit(0);
      });
      process.on("SIGTERM", async () => {
        if (poolInstance) await poolInstance.end();
        process.exit(0);
      });
    }
    this.db = dbInstance;
  }
  // User methods
  async getUser(id) {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0];
  }
  async getUserByEmail(email) {
    const result = await this.db.select().from(users).where(eq(users.email, email));
    return result[0];
  }
  async getAllUsers() {
    return this.db.select().from(users);
  }
  async createUser(user) {
    const allUsers = await this.getAllUsers();
    const isFirstUser = allUsers.length === 0;
    const result = await this.db.insert(users).values({
      ...user,
      role: isFirstUser ? "admin" : user.role || "client"
    }).returning();
    return result[0];
  }
  async updateUser(id, updates) {
    const result = await this.db.update(users).set(updates).where(eq(users.id, id)).returning();
    return result[0];
  }
  // Password Reset methods
  async setPasswordResetToken(email, token, expiry) {
    const result = await this.db.update(users).set({ resetToken: token, resetTokenExpiry: expiry }).where(eq(users.email, email)).returning();
    return result[0];
  }
  async getUserByResetToken(token) {
    const result = await this.db.select().from(users).where(eq(users.resetToken, token));
    return result[0];
  }
  async clearPasswordResetToken(userId) {
    await this.db.update(users).set({ resetToken: null, resetTokenExpiry: null }).where(eq(users.id, userId));
  }
  async updateUserPassword(userId, newPasswordHash) {
    const result = await this.db.update(users).set({ password: newPasswordHash }).where(eq(users.id, userId)).returning();
    return result[0];
  }
  // API Key methods
  async getApiKeyByHash(keyHash) {
    const result = await this.db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash));
    return result[0];
  }
  async getApiKeysByUserId(userId) {
    return this.db.select().from(apiKeys).where(eq(apiKeys.userId, userId)).orderBy(desc(apiKeys.createdAt));
  }
  async createApiKey(apiKey) {
    const result = await this.db.insert(apiKeys).values(apiKey).returning();
    return result[0];
  }
  async updateApiKeyLastUsed(id) {
    await this.db.update(apiKeys).set({ lastUsedAt: /* @__PURE__ */ new Date() }).where(eq(apiKeys.id, id));
  }
  async revokeApiKey(id) {
    await this.db.delete(apiKeys).where(eq(apiKeys.id, id));
  }
  // Client Profile methods
  async getClientProfileByUserId(userId) {
    const result = await this.db.select().from(clientProfiles).where(eq(clientProfiles.userId, userId));
    return result[0];
  }
  async getClientProfileByPhoneNumber(phoneNumber) {
    const result = await this.db.select().from(clientProfiles).where(sql2`${phoneNumber} = ANY(${clientProfiles.assignedPhoneNumbers})`);
    return result[0];
  }
  async createClientProfile(profile) {
    const result = await this.db.insert(clientProfiles).values({
      credits: "0.00",
      customMarkup: "0.00",
      assignedPhoneNumbers: [],
      ...profile
    }).returning();
    return result[0];
  }
  async updateClientCredits(userId, newCredits) {
    const result = await this.db.update(clientProfiles).set({ credits: newCredits }).where(eq(clientProfiles.userId, userId)).returning();
    return result[0];
  }
  async updateClientPhoneNumbers(userId, phoneNumbers) {
    const result = await this.db.update(clientProfiles).set({ assignedPhoneNumbers: phoneNumbers }).where(eq(clientProfiles.userId, userId)).returning();
    return result[0];
  }
  // System Config methods
  async getSystemConfig(key) {
    const result = await this.db.select().from(systemConfig).where(eq(systemConfig.key, key));
    return result[0];
  }
  async setSystemConfig(key, value) {
    const existing = await this.getSystemConfig(key);
    if (existing) {
      const result = await this.db.update(systemConfig).set({ value }).where(eq(systemConfig.key, key)).returning();
      return result[0];
    } else {
      const result = await this.db.insert(systemConfig).values({ key, value }).returning();
      return result[0];
    }
  }
  async getAllSystemConfig() {
    return this.db.select().from(systemConfig);
  }
  // Message Log methods
  async createMessageLog(log2) {
    const result = await this.db.insert(messageLogs).values(log2).returning();
    return result[0];
  }
  async getMessageLogsByUserId(userId, limit) {
    let query = this.db.select().from(messageLogs).where(eq(messageLogs.userId, userId)).orderBy(desc(messageLogs.createdAt));
    if (limit) {
      query = query.limit(limit);
    }
    return query;
  }
  async getMessageLogByMessageId(messageId) {
    const result = await this.db.select().from(messageLogs).where(eq(messageLogs.messageId, messageId));
    return result[0];
  }
  async getAllMessageLogs(limit) {
    let query = this.db.select().from(messageLogs).orderBy(desc(messageLogs.createdAt));
    if (limit) {
      query = query.limit(limit);
    }
    return query;
  }
  async updateMessageStatus(logId, status) {
    await this.db.update(messageLogs).set({ status }).where(eq(messageLogs.id, logId));
  }
  async findClientBySenderPhone(senderPhone) {
    const result = await this.db.select().from(messageLogs).where(eq(messageLogs.senderPhoneNumber, senderPhone)).orderBy(desc(messageLogs.createdAt)).limit(1);
    return result.length > 0 ? result[0].userId : void 0;
  }
  async findClientByRecipient(recipientPhone) {
    const result = await this.db.select().from(messageLogs).where(
      sql2`${messageLogs.recipient} = ${recipientPhone} OR ${recipientPhone} = ANY(${messageLogs.recipients})`
    ).orderBy(desc(messageLogs.createdAt)).limit(1);
    return result.length > 0 ? result[0].userId : void 0;
  }
  // Credit Transaction methods
  async createCreditTransaction(transaction) {
    const result = await this.db.insert(creditTransactions).values(transaction).returning();
    return result[0];
  }
  async getCreditTransactionsByUserId(userId, limit) {
    let query = this.db.select().from(creditTransactions).where(eq(creditTransactions.userId, userId)).orderBy(desc(creditTransactions.createdAt));
    if (limit) {
      query = query.limit(limit);
    }
    return query;
  }
  // Incoming Message methods
  async createIncomingMessage(message) {
    const result = await this.db.insert(incomingMessages).values(message).returning();
    return result[0];
  }
  async getIncomingMessagesByUserId(userId, limit) {
    let query = this.db.select().from(incomingMessages).where(eq(incomingMessages.userId, userId)).orderBy(desc(incomingMessages.timestamp));
    if (limit) {
      query = query.limit(limit);
    }
    return query;
  }
  async getAllIncomingMessages(limit) {
    let query = this.db.select().from(incomingMessages).orderBy(desc(incomingMessages.timestamp));
    if (limit) {
      query = query.limit(limit);
    }
    return query;
  }
  // Client Contact methods (for Business field routing)
  async createClientContact(contact) {
    const result = await this.db.insert(clientContacts).values(contact).returning();
    return result[0];
  }
  async createClientContacts(contacts) {
    if (contacts.length === 0) return [];
    const result = await this.db.insert(clientContacts).values(contacts).returning();
    return result;
  }
  async getClientContactsByUserId(userId) {
    return this.db.select().from(clientContacts).where(eq(clientContacts.userId, userId)).orderBy(desc(clientContacts.createdAt));
  }
  async getClientContactByPhone(phoneNumber) {
    const result = await this.db.select().from(clientContacts).where(eq(clientContacts.phoneNumber, phoneNumber)).limit(1);
    return result[0];
  }
  async updateClientContact(id, updates) {
    const result = await this.db.update(clientContacts).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(clientContacts.id, id)).returning();
    return result[0];
  }
  async deleteClientContact(id) {
    await this.db.delete(clientContacts).where(eq(clientContacts.id, id));
  }
  async deleteClientContactsByUserId(userId) {
    await this.db.delete(clientContacts).where(eq(clientContacts.userId, userId));
  }
  // Error logging methods
  async getErrorLogs(level) {
    const failedLogs = await this.db.select({
      id: messageLogs.id,
      level: sql2`'error'`,
      message: sql2`'SMS delivery failed'`,
      endpoint: messageLogs.endpoint,
      userId: messageLogs.userId,
      details: messageLogs.responsePayload,
      timestamp: messageLogs.createdAt
    }).from(messageLogs).where(eq(messageLogs.status, "failed")).orderBy(desc(messageLogs.createdAt)).limit(100);
    const logsWithUsers = await Promise.all(
      failedLogs.map(async (log2) => {
        const user = await this.getUser(log2.userId.toString());
        return {
          ...log2,
          userName: user?.name || "Unknown",
          timestamp: log2.timestamp.toISOString()
        };
      })
    );
    if (level && level !== "all") {
      return logsWithUsers.filter((log2) => log2.level === level);
    }
    return logsWithUsers;
  }
  // Stats methods
  async getTotalMessageCount() {
    const result = await this.db.select({ count: sql2`count(*)` }).from(messageLogs);
    return Number(result[0].count);
  }
};
var storage = process.env.DATABASE_URL ? (() => {
  const dbStorage = new DbStorage();
  console.log("\u2705 Using PostgreSQL database storage");
  console.log(`\u2705 Database: ${process.env.DATABASE_URL?.split("@")[1]?.split("?")[0] || "connected"}`);
  return dbStorage;
})() : (() => {
  console.warn("\u26A0\uFE0F  DATABASE_URL not set - using in-memory storage (data will not persist)");
  return new MemStorage();
})();

// server/routes.ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import axios from "axios";
import crypto from "crypto";

// server/resend.ts
import { Resend } from "resend";
var connectionSettings;
async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY ? "repl " + process.env.REPL_IDENTITY : process.env.WEB_REPL_RENEWAL ? "depl " + process.env.WEB_REPL_RENEWAL : null;
  if (!xReplitToken) {
    throw new Error("X_REPLIT_TOKEN not found for repl/depl");
  }
  connectionSettings = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
    {
      headers: {
        "Accept": "application/json",
        "X_REPLIT_TOKEN": xReplitToken
      }
    }
  ).then((res) => res.json()).then((data) => data.items?.[0]);
  if (!connectionSettings || !connectionSettings.settings.api_key) {
    throw new Error("Resend not connected");
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}
async function getUncachableResendClient() {
  const credentials = await getCredentials();
  return {
    client: new Resend(credentials.apiKey),
    fromEmail: connectionSettings.settings.from_email
  };
}
async function sendPasswordResetEmail(to, resetUrl) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    const { data, error } = await client.emails.send({
      from: fromEmail || "noreply@ibikisms.com",
      to: [to],
      subject: "Password Reset - Ibiki SMS",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Ibiki SMS</h1>
          </div>
          
          <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1f2937; margin-top: 0;">Reset Your Password</h2>
            
            <p style="color: #4b5563; font-size: 16px;">
              You requested to reset your password. Click the button below to create a new password:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">
                Reset Password
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
              <strong>Security Notice:</strong> This link will expire in 1 hour. If you didn't request this password reset, you can safely ignore this email.
            </p>
            
            <p style="color: #9ca3af; font-size: 13px; margin-top: 20px;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <span style="color: #667eea; word-break: break-all;">${resetUrl}</span>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
            <p>\xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} Ibiki SMS. All rights reserved.</p>
          </div>
        </body>
        </html>
      `
    });
    if (error) {
      console.error("Resend email error:", error);
      throw new Error("Failed to send password reset email");
    }
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("Password reset email error:", error);
    throw error;
  }
}

// server/routes.ts
var JWT_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || "your-secret-key-change-in-production";
var EXTREMESMS_BASE_URL = "https://extremesms.net";
async function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}
function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}
async function authenticateApiKey(req, res, next) {
  const authHeader = req.headers["authorization"];
  const apiKey = authHeader && authHeader.split(" ")[1];
  if (!apiKey) {
    return res.status(401).json({ error: "API key required" });
  }
  try {
    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
    const storedKey = await storage.getApiKeyByHash(keyHash);
    if (!storedKey || !storedKey.isActive) {
      return res.status(401).json({ error: "Invalid API key" });
    }
    const user = await storage.getUser(storedKey.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "User account inactive" });
    }
    req.user = { userId: user.id, role: user.role };
    req.apiKeyId = storedKey.id;
    await storage.updateApiKeyLastUsed(storedKey.id);
    next();
  } catch (error) {
    return res.status(500).json({ error: "Authentication error" });
  }
}
async function getPricingConfig() {
  const extremeCostConfig = await storage.getSystemConfig("extreme_cost_per_sms");
  const clientRateConfig = await storage.getSystemConfig("client_rate_per_sms");
  const extremeCost = extremeCostConfig ? parseFloat(extremeCostConfig.value) : 0.01;
  const clientRate = clientRateConfig ? parseFloat(clientRateConfig.value) : 0.02;
  return { extremeCost, clientRate };
}
async function deductCreditsAndLog(userId, messageCount, endpoint, messageId, status, requestPayload, responsePayload, recipient, recipients, senderPhoneNumber) {
  const { extremeCost, clientRate } = await getPricingConfig();
  const totalCost = extremeCost * messageCount;
  const totalCharge = clientRate * messageCount;
  const profile = await storage.getClientProfileByUserId(userId);
  if (!profile) {
    throw new Error("Client profile not found");
  }
  const currentCredits = parseFloat(profile.credits);
  if (currentCredits < totalCharge) {
    throw new Error("Insufficient credits");
  }
  const newCredits = currentCredits - totalCharge;
  const senderPhone = senderPhoneNumber || responsePayload?.senderPhone || responsePayload?.from || responsePayload?.sender || null;
  const messageLog = await storage.createMessageLog({
    userId,
    messageId,
    endpoint,
    recipient: recipient || null,
    recipients: recipients || null,
    senderPhoneNumber: senderPhone,
    status,
    costPerMessage: extremeCost.toFixed(4),
    chargePerMessage: clientRate.toFixed(4),
    totalCost: totalCost.toFixed(2),
    totalCharge: totalCharge.toFixed(2),
    messageCount,
    requestPayload: JSON.stringify(requestPayload),
    responsePayload: JSON.stringify(responsePayload)
  });
  await storage.createCreditTransaction({
    userId,
    amount: (-totalCharge).toFixed(2),
    type: "debit",
    description: `SMS sent via ${endpoint}`,
    balanceBefore: currentCredits.toFixed(2),
    balanceAfter: newCredits.toFixed(2),
    messageLogId: messageLog.id
  });
  await storage.updateClientCredits(userId, newCredits.toFixed(2));
  return { messageLog, newBalance: newCredits };
}
async function getExtremeApiKey() {
  const config = await storage.getSystemConfig("extreme_api_key");
  if (!config) {
    throw new Error("ExtremeSMS API key not configured");
  }
  return config.value;
}
async function registerRoutes(app2) {
  app2.use(express.json());
  app2.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, confirmPassword } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      if (!confirmPassword) {
        return res.status(400).json({ error: "Password confirmation is required" });
      }
      if (password !== confirmPassword) {
        return res.status(400).json({ error: "Passwords do not match" });
      }
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }
      const name = email.split("@")[0];
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name,
        company: null,
        role: "client",
        isActive: true
      });
      await storage.createClientProfile({
        userId: user.id,
        credits: "0.00",
        currency: "USD",
        customMarkup: null
      });
      const rawApiKey = `ibk_live_${crypto.randomBytes(24).toString("hex")}`;
      const keyHash = crypto.createHash("sha256").update(rawApiKey).digest("hex");
      const keyPrefix = rawApiKey.slice(0, 12);
      const keySuffix = rawApiKey.slice(-4);
      await storage.createApiKey({
        userId: user.id,
        keyHash,
        keyPrefix,
        keySuffix,
        isActive: true
      });
      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        token,
        apiKey: rawApiKey
        // Only shown once
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ error: "Signup failed" });
    }
  });
  app2.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      const user = await storage.getUserByEmail(email);
      if (!user || !user.isActive) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        token
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });
  app2.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.json({
          success: true,
          message: "If an account exists with this email, a password reset link has been sent."
        });
      }
      const resetToken = crypto.randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 36e5);
      await storage.setPasswordResetToken(email, resetToken, expiry);
      const resetUrl = `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://151.243.109.79"}/reset-password?token=${resetToken}`;
      await sendPasswordResetEmail(user.email, resetUrl);
      res.json({
        success: true,
        message: "If an account exists with this email, a password reset link has been sent."
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Failed to process password reset request" });
    }
  });
  app2.get("/api/auth/verify-reset-token/:token", async (req, res) => {
    try {
      const { token } = req.params;
      if (!token) {
        return res.status(400).json({ error: "Token is required" });
      }
      const user = await storage.getUserByResetToken(token);
      if (!user) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }
      res.json({
        success: true,
        email: user.email
      });
    } catch (error) {
      console.error("Verify reset token error:", error);
      res.status(500).json({ error: "Failed to verify reset token" });
    }
  });
  app2.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ error: "Token and new password are required" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long" });
      }
      const user = await storage.getUserByResetToken(token);
      if (!user) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(user.id, hashedPassword);
      res.json({
        success: true,
        message: "Password has been reset successfully"
      });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });
  app2.post("/webhook/incoming-sms", async (req, res) => {
    try {
      const webhookSecret = process.env.WEBHOOK_SECRET;
      if (webhookSecret && webhookSecret !== "CHANGE_THIS_TO_A_RANDOM_SECRET_STRING_BEFORE_DEPLOYMENT") {
        const providedSecret = req.headers["x-webhook-secret"] || req.query.secret;
        if (providedSecret !== webhookSecret) {
          console.warn("Webhook authentication failed: Invalid or missing secret");
          return res.status(401).json({ error: "Unauthorized" });
        }
      }
      const payload = req.body;
      console.log("Incoming SMS webhook received:", {
        from: payload.from,
        receiver: payload.receiver,
        status: payload.status
      });
      if (!payload.from || !payload.message || !payload.receiver || !payload.timestamp || !payload.messageId) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      let assignedUserId = null;
      if (payload.business && payload.business.trim() !== "") {
        const potentialUserId = payload.business.trim();
        const user = await storage.getUser(potentialUserId);
        if (user && user.role === "client") {
          assignedUserId = user.id;
          console.log(`Routing incoming SMS to client ${user.id} (matched Business field: ${payload.business})`);
        } else {
          console.log(`Business field '${payload.business}' does not match a valid client`);
        }
      }
      if (!assignedUserId) {
        const clientFromOutbound = await storage.findClientByRecipient(payload.from);
        if (clientFromOutbound) {
          assignedUserId = clientFromOutbound;
          console.log(`Routing incoming SMS to client ${clientFromOutbound} (matched conversation: client sent to ${payload.from})`);
        }
      }
      if (!assignedUserId) {
        const clientProfile = await storage.getClientProfileByPhoneNumber(payload.receiver);
        if (clientProfile) {
          assignedUserId = clientProfile.userId;
          console.log(`Routing incoming SMS to client ${clientProfile.userId} (matched assigned phone number)`);
        } else {
          console.log(`No client found for incoming SMS from ${payload.from} to ${payload.receiver}`);
        }
      }
      await storage.createIncomingMessage({
        userId: assignedUserId,
        from: payload.from,
        firstname: payload.firstname || null,
        lastname: payload.lastname || null,
        business: payload.business || null,
        message: payload.message,
        status: payload.status,
        matchedBlockWord: payload.matchedBlockWord || null,
        receiver: payload.receiver,
        usedmodem: payload.usedmodem || null,
        port: payload.port || null,
        timestamp: new Date(payload.timestamp),
        messageId: payload.messageId
      });
      res.json({
        success: true,
        message: "Incoming message processed successfully"
      });
    } catch (error) {
      console.error("Webhook processing error:", error);
      res.status(500).json({ error: "Failed to process incoming message" });
    }
  });
  app2.get("/api/client/profile", authenticateToken, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const profile = await storage.getClientProfileByUserId(user.id);
      const apiKeys2 = await storage.getApiKeysByUserId(user.id);
      const clientRateConfig = await storage.getSystemConfig("client_rate_per_sms");
      const clientRate = clientRateConfig?.value || "0.02";
      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          company: user.company,
          role: user.role
        },
        credits: profile?.credits || "0.00",
        currency: profile?.currency || "USD",
        ratePerSms: clientRate,
        apiKeys: apiKeys2.map((key) => ({
          id: key.id,
          displayKey: `${key.keyPrefix}...${key.keySuffix}`,
          isActive: key.isActive,
          createdAt: key.createdAt?.toISOString() || (/* @__PURE__ */ new Date()).toISOString(),
          lastUsedAt: key.lastUsedAt?.toISOString() || null
        }))
      });
    } catch (error) {
      console.error("Profile fetch error:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });
  app2.post("/api/client/generate-key", authenticateToken, async (req, res) => {
    try {
      const userId = req.user.userId;
      const rawApiKey = `ibk_live_${crypto.randomBytes(24).toString("hex")}`;
      const keyHash = crypto.createHash("sha256").update(rawApiKey).digest("hex");
      const keyPrefix = rawApiKey.slice(0, 12);
      const keySuffix = rawApiKey.slice(-4);
      await storage.createApiKey({
        userId,
        keyHash,
        keyPrefix,
        keySuffix,
        isActive: true
      });
      res.json({
        success: true,
        apiKey: rawApiKey,
        // Only returned once
        message: "New API key generated successfully"
      });
    } catch (error) {
      console.error("Generate key error:", error);
      res.status(500).json({ error: "Failed to generate API key" });
    }
  });
  app2.post("/api/client/revoke-key", authenticateToken, async (req, res) => {
    try {
      const { keyId } = req.body;
      const userId = req.user.userId;
      if (!keyId) {
        return res.status(400).json({ error: "Key ID is required" });
      }
      const apiKeys2 = await storage.getApiKeysByUserId(userId);
      const keyToRevoke = apiKeys2.find((k) => k.id === keyId);
      if (!keyToRevoke) {
        return res.status(404).json({ error: "API key not found" });
      }
      await storage.revokeApiKey(keyId);
      res.json({
        success: true,
        message: "API key revoked successfully"
      });
    } catch (error) {
      console.error("Revoke key error:", error);
      res.status(500).json({ error: "Failed to revoke API key" });
    }
  });
  app2.get("/api/client/messages", authenticateToken, async (req, res) => {
    try {
      const logs = await storage.getMessageLogsByUserId(req.user.userId, 100);
      res.json({ success: true, messages: logs });
    } catch (error) {
      console.error("Message logs fetch error:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });
  app2.get("/api/client/inbox", authenticateToken, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 100;
      const messages = await storage.getIncomingMessagesByUserId(req.user.userId, limit);
      res.json({
        success: true,
        messages: messages.map((msg) => ({
          id: msg.id,
          from: msg.from,
          firstname: msg.firstname,
          lastname: msg.lastname,
          business: msg.business,
          message: msg.message,
          status: msg.status,
          matchedBlockWord: msg.matchedBlockWord,
          receiver: msg.receiver,
          timestamp: msg.timestamp.toISOString(),
          messageId: msg.messageId
        })),
        count: messages.length
      });
    } catch (error) {
      console.error("Client inbox fetch error:", error);
      res.status(500).json({ error: "Failed to retrieve inbox" });
    }
  });
  app2.post("/api/client/contacts/upload", authenticateToken, async (req, res) => {
    try {
      const { contacts } = req.body;
      if (!Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({ error: "Contacts array is required" });
      }
      const validatedContacts = contacts.map((contact, index2) => {
        if (!contact.phoneNumber) {
          throw new Error(`Phone number is required for contact at index ${index2}`);
        }
        return {
          userId: req.user.userId,
          phoneNumber: contact.phoneNumber,
          firstname: contact.firstname || null,
          lastname: contact.lastname || null,
          business: req.user.userId
          // Store client's userId in Business field for routing
        };
      });
      try {
        const oldContacts = await storage.getClientContactsByUserId(req.user.userId);
        await storage.deleteClientContactsByUserId(req.user.userId);
        try {
          const createdContacts = await storage.createClientContacts(validatedContacts);
          res.json({
            success: true,
            message: `Successfully uploaded ${createdContacts.length} contacts`,
            count: createdContacts.length
          });
        } catch (insertError) {
          if (oldContacts.length > 0) {
            const restoreContacts = oldContacts.map((c) => ({
              userId: c.userId,
              phoneNumber: c.phoneNumber,
              firstname: c.firstname,
              lastname: c.lastname,
              business: c.business
            }));
            await storage.createClientContacts(restoreContacts);
          }
          throw insertError;
        }
      } catch (dbError) {
        console.error("Database error during contact upload:", dbError);
        throw new Error("Failed to upload contacts - operation rolled back");
      }
    } catch (error) {
      console.error("Contact upload error:", error);
      res.status(500).json({ error: error.message || "Failed to upload contacts" });
    }
  });
  app2.get("/api/client/contacts", authenticateToken, async (req, res) => {
    try {
      const contacts = await storage.getClientContactsByUserId(req.user.userId);
      res.json({
        success: true,
        contacts: contacts.map((c) => ({
          id: c.id,
          phoneNumber: c.phoneNumber,
          firstname: c.firstname,
          lastname: c.lastname,
          business: c.business,
          createdAt: c.createdAt.toISOString()
        })),
        count: contacts.length
      });
    } catch (error) {
      console.error("Contact fetch error:", error);
      res.status(500).json({ error: "Failed to retrieve contacts" });
    }
  });
  app2.delete("/api/client/contacts/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const contacts = await storage.getClientContactsByUserId(req.user.userId);
      const contact = contacts.find((c) => c.id === id);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      await storage.deleteClientContact(id);
      res.json({
        success: true,
        message: "Contact deleted successfully"
      });
    } catch (error) {
      console.error("Contact delete error:", error);
      res.status(500).json({ error: "Failed to delete contact" });
    }
  });
  app2.delete("/api/client/contacts", authenticateToken, async (req, res) => {
    try {
      await storage.deleteClientContactsByUserId(req.user.userId);
      res.json({
        success: true,
        message: "All contacts deleted successfully"
      });
    } catch (error) {
      console.error("Contact delete error:", error);
      res.status(500).json({ error: "Failed to delete contacts" });
    }
  });
  app2.get("/api/admin/stats", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const totalMessages = await storage.getTotalMessageCount();
      const allUsers = await storage.getAllUsers();
      const totalClients = allUsers.filter((u) => u.role === "client").length;
      res.json({
        success: true,
        totalMessages,
        totalClients
      });
    } catch (error) {
      console.error("Admin stats fetch error:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });
  app2.get("/api/admin/recent-activity", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const recentLogs = await storage.getAllMessageLogs(10);
      const enrichedLogs = await Promise.all(
        recentLogs.map(async (log2) => {
          const user = await storage.getUser(log2.userId);
          return {
            id: log2.id,
            endpoint: log2.endpoint,
            clientName: user?.company || user?.name || "Unknown",
            timestamp: log2.createdAt,
            status: log2.status,
            recipient: log2.recipient || (log2.recipients && log2.recipients.length > 0 ? `${log2.recipients.length} recipients` : "N/A")
          };
        })
      );
      res.json({ success: true, logs: enrichedLogs });
    } catch (error) {
      console.error("Recent activity fetch error:", error);
      res.status(500).json({ error: "Failed to fetch recent activity" });
    }
  });
  app2.get("/api/admin/clients", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const clients = await Promise.all(
        allUsers.filter((user) => user.role === "client").map(async (user) => {
          const apiKeys2 = await storage.getApiKeysByUserId(user.id);
          const messageLogs2 = await storage.getMessageLogsByUserId(user.id);
          const profile = await storage.getClientProfileByUserId(user.id);
          const displayKey = apiKeys2[0] ? `ibk_live_${apiKeys2[0].keyPrefix}...${apiKeys2[0].keySuffix}` : "No key";
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            apiKey: displayKey,
            status: apiKeys2.length > 0 && apiKeys2[0].isActive ? "active" : "inactive",
            messagesSent: messageLogs2.length,
            credits: profile?.credits || "0.00",
            lastActive: apiKeys2[0]?.lastUsedAt ? new Date(apiKeys2[0].lastUsedAt).toLocaleDateString() : "Never",
            assignedPhoneNumbers: profile?.assignedPhoneNumbers || []
          };
        })
      );
      res.json({ success: true, clients });
    } catch (error) {
      console.error("Admin clients fetch error:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });
  app2.get("/api/admin/config", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const configs = await storage.getAllSystemConfig();
      const configMap = {};
      configs.forEach((config) => {
        configMap[config.key] = config.value;
      });
      res.json({ success: true, config: configMap });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch configuration" });
    }
  });
  app2.post("/api/admin/config", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { extremeApiKey, extremeCost, clientRate } = req.body;
      if (extremeApiKey) {
        await storage.setSystemConfig("extreme_api_key", extremeApiKey);
      }
      if (extremeCost) {
        await storage.setSystemConfig("extreme_cost_per_sms", extremeCost);
      }
      if (clientRate) {
        await storage.setSystemConfig("client_rate_per_sms", clientRate);
      }
      res.json({ success: true, message: "Configuration updated" });
    } catch (error) {
      console.error("Config update error:", error);
      res.status(500).json({ error: "Failed to update configuration" });
    }
  });
  app2.get("/api/admin/extremesms-balance", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const extremeApiKey = await storage.getSystemConfig("extreme_api_key");
      if (!extremeApiKey || !extremeApiKey.value) {
        return res.status(400).json({ error: "ExtremeSMS API key not configured" });
      }
      const response = await axios.get(`${EXTREMESMS_BASE_URL}/api/v2/account/balance`, {
        headers: {
          "Authorization": `Bearer ${extremeApiKey.value}`,
          "Content-Type": "application/json"
        },
        validateStatus: (status) => status >= 200 && status < 300
      });
      if (response.data && response.data.success) {
        res.json({
          success: true,
          balance: response.data.balance || 0,
          currency: response.data.currency || "USD"
        });
      } else {
        console.error("ExtremeSMS balance: unexpected response format");
        res.status(400).json({ error: "Unable to fetch balance" });
      }
    } catch (error) {
      const statusCode = error.response?.status || "unknown";
      console.error(`ExtremeSMS balance fetch failed with status ${statusCode}`);
      res.status(500).json({
        error: "Unable to fetch balance"
      });
    }
  });
  app2.post("/api/admin/test-connection", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const extremeApiKey = await storage.getSystemConfig("extreme_api_key");
      if (!extremeApiKey || !extremeApiKey.value) {
        return res.status(400).json({ error: "ExtremeSMS API key not configured" });
      }
      const response = await axios.get(`${EXTREMESMS_BASE_URL}/api/v2/account/balance`, {
        headers: {
          "Authorization": `Bearer ${extremeApiKey.value}`,
          "Content-Type": "application/json"
        }
      });
      if (response.data && response.data.success) {
        res.json({
          success: true,
          message: `Connected successfully! Balance: ${response.data.balance || "N/A"}`
        });
      } else {
        res.status(400).json({ error: "ExtremeSMS API returned unexpected response" });
      }
    } catch (error) {
      console.error("ExtremeSMS test connection error:", error.response?.data || error.message);
      res.status(500).json({
        error: "Failed to connect to ExtremeSMS API",
        details: error.response?.data?.message || error.message
      });
    }
  });
  app2.post("/api/admin/test-endpoint", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { endpoint, payload } = req.body;
      const extremeApiKey = await storage.getSystemConfig("extreme_api_key");
      if (!extremeApiKey || !extremeApiKey.value) {
        return res.status(400).json({ error: "ExtremeSMS API key not configured" });
      }
      let response;
      switch (endpoint) {
        case "balance":
          response = await axios.get(`${EXTREMESMS_BASE_URL}/api/v2/account/balance`, {
            headers: {
              "Authorization": `Bearer ${extremeApiKey.value}`,
              "Content-Type": "application/json"
            }
          });
          break;
        case "sendsingle":
          if (!payload || !payload.recipient || !payload.message) {
            return res.status(400).json({ error: "Missing recipient or message" });
          }
          response = await axios.post(
            `${EXTREMESMS_BASE_URL}/api/v2/sms/sendsingle`,
            { recipient: payload.recipient, message: payload.message },
            {
              headers: {
                "Authorization": `Bearer ${extremeApiKey.value}`,
                "Content-Type": "application/json"
              }
            }
          );
          break;
        case "sendbulk":
          if (!payload || !payload.recipients || !payload.content) {
            return res.status(400).json({ error: "Missing recipients or content" });
          }
          response = await axios.post(
            `${EXTREMESMS_BASE_URL}/api/v2/sms/sendbulk`,
            { recipients: payload.recipients, content: payload.content },
            {
              headers: {
                "Authorization": `Bearer ${extremeApiKey.value}`,
                "Content-Type": "application/json"
              }
            }
          );
          break;
        case "sendbulkmulti":
          if (!Array.isArray(payload) || payload.length === 0) {
            return res.status(400).json({ error: "Invalid payload format" });
          }
          response = await axios.post(
            `${EXTREMESMS_BASE_URL}/api/v2/sms/sendbulkmulti`,
            payload,
            {
              headers: {
                "Authorization": `Bearer ${extremeApiKey.value}`,
                "Content-Type": "application/json"
              }
            }
          );
          break;
        default:
          return res.status(400).json({ error: "Invalid endpoint" });
      }
      res.json({ success: true, data: response.data });
    } catch (error) {
      console.error("Test endpoint error:", error.response?.data || error.message);
      res.status(500).json({
        error: error.response?.data?.error || error.message,
        details: error.response?.data
      });
    }
  });
  app2.get("/api/admin/error-logs", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { level } = req.query;
      const logs = await storage.getErrorLogs(level);
      res.json({ success: true, logs });
    } catch (error) {
      console.error("Error logs fetch error:", error);
      res.status(500).json({ error: "Failed to fetch error logs" });
    }
  });
  app2.post("/api/admin/add-credits", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { amount, userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: "Invalid amount - must be positive number" });
      }
      const profile = await storage.getClientProfileByUserId(userId);
      if (!profile) {
        return res.status(404).json({ error: "Client profile not found" });
      }
      const balanceBefore = profile.credits;
      const newBalance = (parseFloat(profile.credits) + parseFloat(amount)).toFixed(2);
      await storage.updateClientCredits(userId, newBalance);
      await storage.createCreditTransaction({
        userId,
        amount: parseFloat(amount).toString(),
        type: "admin_credit_add",
        description: `Admin added ${amount} credits`,
        balanceBefore,
        balanceAfter: newBalance
      });
      res.json({
        success: true,
        message: "Credits added successfully",
        newBalance
      });
    } catch (error) {
      console.error("Add credits error:", error);
      res.status(500).json({ error: "Failed to add credits" });
    }
  });
  app2.post("/api/admin/update-phone-numbers", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { userId, phoneNumbers } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const profile = await storage.getClientProfileByUserId(userId);
      if (!profile) {
        return res.status(404).json({ error: "Client profile not found" });
      }
      let numbersArray = [];
      if (typeof phoneNumbers === "string") {
        numbersArray = phoneNumbers.split(",").map((num) => num.trim()).filter((num) => num.length > 0);
      } else if (Array.isArray(phoneNumbers)) {
        numbersArray = phoneNumbers.filter((num) => num && num.trim().length > 0);
      }
      await storage.updateClientPhoneNumbers(userId, numbersArray);
      res.json({
        success: true,
        message: numbersArray.length > 0 ? `${numbersArray.length} phone number(s) assigned` : "Phone numbers unassigned",
        phoneNumbers: numbersArray
      });
    } catch (error) {
      console.error("Update phone numbers error:", error);
      res.status(500).json({ error: "Failed to update phone numbers" });
    }
  });
  app2.post("/api/v2/sms/sendsingle", authenticateApiKey, async (req, res) => {
    try {
      const { recipient, message } = req.body;
      if (!recipient || !message) {
        return res.status(400).json({
          success: false,
          error: "Invalid recipient phone number",
          code: "INVALID_RECIPIENT"
        });
      }
      const profile = await storage.getClientProfileByUserId(req.user.userId);
      const { clientRate } = await getPricingConfig();
      if (!profile || parseFloat(profile.credits) < clientRate) {
        return res.status(402).json({
          success: false,
          error: "Insufficient credits",
          code: "INSUFFICIENT_CREDITS"
        });
      }
      const extremeApiKey = await getExtremeApiKey();
      const response = await axios.post(
        `${EXTREMESMS_BASE_URL}/api/v2/sms/sendsingle`,
        { recipient, message },
        {
          headers: {
            "Authorization": `Bearer ${extremeApiKey}`,
            "Content-Type": "application/json"
          }
        }
      );
      await deductCreditsAndLog(
        req.user.userId,
        1,
        "/api/v2/sms/sendsingle",
        response.data.messageId,
        response.data.status,
        { recipient, message },
        response.data,
        recipient
      );
      res.json(response.data);
    } catch (error) {
      if (error.message === "Insufficient credits") {
        return res.status(402).json({
          success: false,
          error: "Insufficient credits",
          code: "INSUFFICIENT_CREDITS"
        });
      }
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      console.error("Send single SMS error:", error);
      res.status(500).json({ success: false, error: "Failed to send SMS" });
    }
  });
  app2.post("/api/v2/sms/sendbulk", authenticateApiKey, async (req, res) => {
    try {
      const { recipients, content } = req.body;
      if (!recipients || !Array.isArray(recipients) || !content) {
        return res.status(400).json({
          success: false,
          error: "Invalid parameters",
          code: "INVALID_PARAMS"
        });
      }
      const profile = await storage.getClientProfileByUserId(req.user.userId);
      const { clientRate } = await getPricingConfig();
      const totalCharge = clientRate * recipients.length;
      if (!profile || parseFloat(profile.credits) < totalCharge) {
        return res.status(402).json({
          success: false,
          error: "Insufficient credits",
          code: "INSUFFICIENT_CREDITS"
        });
      }
      const extremeApiKey = await getExtremeApiKey();
      const response = await axios.post(
        `${EXTREMESMS_BASE_URL}/api/v2/sms/sendbulk`,
        { recipients, content },
        {
          headers: {
            "Authorization": `Bearer ${extremeApiKey}`,
            "Content-Type": "application/json"
          }
        }
      );
      await deductCreditsAndLog(
        req.user.userId,
        recipients.length,
        "/api/v2/sms/sendbulk",
        response.data.messageIds?.[0] || "bulk_" + Date.now(),
        response.data.status,
        { recipients, content },
        response.data,
        void 0,
        recipients
      );
      res.json(response.data);
    } catch (error) {
      if (error.message === "Insufficient credits") {
        return res.status(402).json({
          success: false,
          error: "Insufficient credits",
          code: "INSUFFICIENT_CREDITS"
        });
      }
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      console.error("Send bulk SMS error:", error);
      res.status(500).json({ success: false, error: "Failed to send bulk SMS" });
    }
  });
  app2.post("/api/v2/sms/sendbulkmulti", authenticateApiKey, async (req, res) => {
    try {
      const messages = req.body;
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Invalid parameters",
          code: "INVALID_PARAMS"
        });
      }
      const profile = await storage.getClientProfileByUserId(req.user.userId);
      const { clientRate } = await getPricingConfig();
      const totalCharge = clientRate * messages.length;
      if (!profile || parseFloat(profile.credits) < totalCharge) {
        return res.status(402).json({
          success: false,
          error: "Insufficient credits",
          code: "INSUFFICIENT_CREDITS"
        });
      }
      const extremeApiKey = await getExtremeApiKey();
      const response = await axios.post(
        `${EXTREMESMS_BASE_URL}/api/v2/sms/sendbulkmulti`,
        messages,
        {
          headers: {
            "Authorization": `Bearer ${extremeApiKey}`,
            "Content-Type": "application/json"
          }
        }
      );
      const recipients = messages.map((m) => m.recipient);
      await deductCreditsAndLog(
        req.user.userId,
        messages.length,
        "/api/v2/sms/sendbulkmulti",
        response.data.results?.[0]?.messageId || "multi_" + Date.now(),
        "queued",
        messages,
        response.data,
        void 0,
        recipients
      );
      res.json(response.data);
    } catch (error) {
      if (error.message === "Insufficient credits") {
        return res.status(402).json({
          success: false,
          error: "Insufficient credits",
          code: "INSUFFICIENT_CREDITS"
        });
      }
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      console.error("Send bulk multi SMS error:", error);
      res.status(500).json({ success: false, error: "Failed to send messages" });
    }
  });
  app2.get("/api/v2/sms/messages", authenticateApiKey, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 100;
      const messages = await storage.getMessageLogsByUserId(req.user.userId, limit);
      res.json({
        success: true,
        messages: messages.map((msg) => ({
          id: msg.id,
          messageId: msg.messageId,
          endpoint: msg.endpoint,
          recipient: msg.recipient,
          recipients: msg.recipients,
          status: msg.status,
          totalCost: msg.totalCost,
          totalCharge: msg.totalCharge,
          messageCount: msg.messageCount,
          createdAt: msg.createdAt.toISOString(),
          requestPayload: msg.requestPayload,
          responsePayload: msg.responsePayload
        })),
        count: messages.length,
        limit
      });
    } catch (error) {
      console.error("Messages fetch error:", error);
      res.status(500).json({ success: false, error: "Failed to retrieve messages" });
    }
  });
  app2.get("/api/dashboard/sms/status/:messageId", authenticateToken, async (req, res) => {
    try {
      const { messageId } = req.params;
      const messageLog = await storage.getMessageLogByMessageId(messageId);
      if (!messageLog) {
        return res.status(404).json({
          success: false,
          error: "Message not found"
        });
      }
      if (req.user.role !== "admin" && messageLog.userId !== req.user.userId) {
        return res.status(403).json({
          success: false,
          error: "Access denied"
        });
      }
      const extremeApiKey = await getExtremeApiKey();
      try {
        const response = await axios.get(
          `${EXTREMESMS_BASE_URL}/api/v2/sms/status/${messageId}`,
          {
            headers: {
              "Authorization": `Bearer ${extremeApiKey}`
            }
          }
        );
        if (response.data.status && response.data.status !== messageLog.status) {
          await storage.updateMessageStatus(messageLog.id, response.data.status);
        }
        res.json({
          success: true,
          messageId: response.data.messageId,
          status: response.data.status,
          statusDescription: response.data.statusDescription || response.data.status
        });
      } catch (extremeError) {
        console.error("ExtremeSMS status check failed, using local status:", extremeError.message);
        res.json({
          success: true,
          messageId: messageLog.messageId,
          status: messageLog.status,
          statusDescription: messageLog.status + " (cached)"
        });
      }
    } catch (error) {
      console.error("Dashboard status check error:", error);
      res.status(500).json({ success: false, error: "Failed to check status" });
    }
  });
  app2.get("/api/v2/sms/status/:messageId", authenticateApiKey, async (req, res) => {
    try {
      const { messageId } = req.params;
      const messageLog = await storage.getMessageLogByMessageId(messageId);
      if (!messageLog) {
        return res.status(404).json({
          success: false,
          error: "Message not found"
        });
      }
      if (messageLog.userId !== req.user.userId) {
        return res.status(403).json({
          success: false,
          error: "Access denied"
        });
      }
      const extremeApiKey = await getExtremeApiKey();
      const response = await axios.get(
        `${EXTREMESMS_BASE_URL}/api/v2/sms/status/${messageId}`,
        {
          headers: {
            "Authorization": `Bearer ${extremeApiKey}`
          }
        }
      );
      if (response.data.status && response.data.status !== messageLog.status) {
        await storage.updateMessageStatus(messageLog.id, response.data.status);
      }
      res.json(response.data);
    } catch (error) {
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      console.error("Status check error:", error);
      res.status(500).json({ success: false, error: "Failed to check status" });
    }
  });
  app2.get("/api/v2/sms/inbox", authenticateApiKey, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 100;
      const messages = await storage.getIncomingMessagesByUserId(req.user.userId, limit);
      res.json({
        success: true,
        messages: messages.map((msg) => ({
          id: msg.id,
          from: msg.from,
          firstname: msg.firstname,
          lastname: msg.lastname,
          business: msg.business,
          message: msg.message,
          status: msg.status,
          matchedBlockWord: msg.matchedBlockWord,
          receiver: msg.receiver,
          timestamp: msg.timestamp.toISOString(),
          messageId: msg.messageId
        })),
        count: messages.length
      });
    } catch (error) {
      console.error("Inbox fetch error:", error);
      res.status(500).json({ success: false, error: "Failed to retrieve inbox" });
    }
  });
  app2.get("/api/v2/account/balance", authenticateApiKey, async (req, res) => {
    try {
      const profile = await storage.getClientProfileByUserId(req.user.userId);
      if (!profile) {
        return res.status(404).json({
          success: false,
          error: "Profile not found"
        });
      }
      res.json({
        success: true,
        balance: parseFloat(profile.credits),
        currency: profile.currency
      });
    } catch (error) {
      console.error("Balance check error:", error);
      res.status(500).json({ success: false, error: "Failed to get balance" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express2 from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      ),
      await import("@replit/vite-plugin-dev-banner").then(
        (m) => m.devBanner()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express2.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
dotenv.config();
if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
  console.error("\u274C FATAL ERROR: DATABASE_URL environment variable is not set!");
  console.error("\u274C The application REQUIRES a PostgreSQL database in production.");
  console.error("\u274C Please set DATABASE_URL in your .env file or environment variables.");
  console.error("\u274C Example: DATABASE_URL=postgresql://user:password@host:port/database");
  process.exit(1);
}
var app = express3();
app.use(express3.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express3.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
