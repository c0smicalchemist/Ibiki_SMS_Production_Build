import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Determine dialect from DATABASE_URL
const isSqlite = process.env.DATABASE_URL.startsWith('file:');
const dialect = isSqlite ? 'sqlite' : 'postgresql';

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: dialect,
  dbCredentials: isSqlite ? {
    url: process.env.DATABASE_URL,
  } : {
    url: process.env.DATABASE_URL,
  },
});
