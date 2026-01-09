import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

/**
 * Wrapper for async route handlers to catch errors
 * Prevents unhandled promise rejections
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      // Log the error with context
      logger.error("Unhandled route error", error as Error, {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userId: (req as any).user?.userId,
      });

      // Send appropriate response
      if (error.statusCode && error.statusCode < 500) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          details: error.details,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Internal server error",
          ...(process.env.NODE_ENV === "development" && {
            debug: error instanceof Error ? error.message : String(error),
          }),
        });
      }
    });
  };
}

/**
 * Global error handling middleware
 * Should be registered AFTER all other routes
 */
export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  logger.error("Global error handler", error, {
    path: _req.path,
    method: _req.method,
  });

  // Check if response was already sent
  if (res.headersSent) {
    return;
  }

  // Handle specific error types
  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: (error as any).fieldErrors,
    });
  }

  if (error.name === "UnauthorizedError") {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
    });
  }

  // Default error response
  const statusCode = (error as any).statusCode || 500;
  const isDev = process.env.NODE_ENV === "development";

  res.status(statusCode).json({
    success: false,
    error: isDev ? error.message : "An error occurred",
    ...(isDev && { debug: error.stack }),
  });
}
