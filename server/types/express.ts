import { Request, Response, NextFunction } from "express";

/**
 * Authenticated user information attached to requests
 */
export interface AuthenticatedUser {
  userId: string;
  role: "admin" | "supervisor" | "client";
}

/**
 * Extended Express Request with authenticated user
 */
// Augment Express Request globally so `req.user` is available everywhere
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      rawBody?: Buffer;
      apiUserId?: string;
    }
  }
}

export type AuthenticatedRequest = Request & { user: AuthenticatedUser };

/**
 * Extended Express Response with proper typing
 */
export interface TypedResponse<T = any> extends Response {
  json(body: T): this;
}

/**
 * Standard API Response wrapper
 */
export interface ApiResponse<T = any> {
  success?: boolean;
  message?: string;
  data?: T;
  error?: string;
}

/**
 * API Error Response
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: Record<string, any>;
}

/**
 * Pagination query parameters
 */
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
}

/**
 * Type-safe request handler
 */
export type RequestHandler<T = any, ResBody = any> = (
  req: AuthenticatedRequest,
  res: TypedResponse<ResBody>,
  next: NextFunction
) => Promise<void> | void;

/**
 * Type-safe error for better error handling
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Validation error with field details
 */
export class ValidationError extends AppError {
  constructor(message: string, public fieldErrors: Record<string, string>) {
    super(400, message, fieldErrors);
    this.name = "ValidationError";
  }
}
