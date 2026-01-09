import { env } from "../env";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

/**
 * Logger utility with structured logging
 * Respects LOG_LEVEL environment variable
 */
class Logger {
  private logLevel: LogLevel;
  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor() {
    this.logLevel = (env.LOG_LEVEL as LogLevel) || "info";
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.logLevel];
  }

  private formatEntry(entry: LogEntry): string {
    if (env.NODE_ENV === "production") {
      // Production: JSON format for log aggregation
      return JSON.stringify(entry);
    } else {
      // Development: readable format
      const context =
        entry.context && Object.keys(entry.context).length > 0
          ? `\n  ${JSON.stringify(entry.context, null, 2).split("\n").join("\n  ")}`
          : "";
      const error = entry.error
        ? `\n  Error: ${entry.error.message}`
        : "";
      return `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}${context}${error}`;
    }
  }

  debug(message: string, context?: Record<string, any>) {
    if (this.shouldLog("debug")) {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: "debug",
        message,
        context,
      };
      console.log(this.formatEntry(entry));
    }
  }

  info(message: string, context?: Record<string, any>) {
    if (this.shouldLog("info")) {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: "info",
        message,
        context,
      };
      console.log(this.formatEntry(entry));
    }
  }

  warn(message: string, context?: Record<string, any>) {
    if (this.shouldLog("warn")) {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: "warn",
        message,
        context,
      };
      console.warn(this.formatEntry(entry));
    }
  }

  error(message: string, error?: Error | unknown, context?: Record<string, any>) {
    if (this.shouldLog("error")) {
      const errorInfo =
        error instanceof Error
          ? {
              message: error.message,
              stack: env.NODE_ENV === "development" ? error.stack : undefined,
              code: (error as any).code,
            }
          : error
            ? { message: String(error) }
            : undefined;

      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: "error",
        message,
        context,
        error: errorInfo,
      };
      console.error(this.formatEntry(entry));
    }
  }
}

export const logger = new Logger();
