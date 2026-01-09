import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { logger } from "../utils/logger";

/**
 * Middleware to validate request body against Zod schema
 * Provides detailed error messages for invalid input
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          const path = err.path.join(".");
          fieldErrors[path] = err.message;
        });

        logger.warn("Request validation failed", {
          endpoint: req.path,
          method: req.method,
          errors: fieldErrors,
        });

        res.status(400).json({
          success: false,
          error: "Invalid request parameters",
          details: fieldErrors,
        });
      } else {
        logger.error("Unexpected error during validation", error as Error, {
          endpoint: req.path,
        });
        res.status(500).json({
          success: false,
          error: "Validation error",
        });
      }
    }
  };
}

/**
 * Middleware to validate query parameters against Zod schema
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          const path = err.path.join(".");
          fieldErrors[path] = err.message;
        });

        logger.warn("Query validation failed", {
          endpoint: req.path,
          query: fieldErrors,
        });

        res.status(400).json({
          success: false,
          error: "Invalid query parameters",
          details: fieldErrors,
        });
      } else {
        logger.error("Unexpected error during validation", error as Error);
        res.status(500).json({
          success: false,
          error: "Validation error",
        });
      }
    }
  };
}

/**
 * Middleware to validate request parameters (URL params) against Zod schema
 */
export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.params);
      req.params = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          const path = err.path.join(".");
          fieldErrors[path] = err.message;
        });

        logger.warn("Params validation failed", {
          endpoint: req.path,
          params: fieldErrors,
        });

        res.status(400).json({
          success: false,
          error: "Invalid URL parameters",
          details: fieldErrors,
        });
      } else {
        logger.error("Unexpected error during validation", error as Error);
        res.status(500).json({
          success: false,
          error: "Validation error",
        });
      }
    }
  };
}
