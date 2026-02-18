import { Request, Response, NextFunction } from 'express';

/**
 * Catch-all 404 handler for undefined routes.
 * Should be placed after all other route definitions.
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({ status: "error", message: "Not Found" });
};

/**
 * Centralized global error handler.
 * Catches errors propagated via next(err) and returns a standardized JSON response.
 */
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.status || 500;
  const message = err.message || "Internal Server Error";
  
  // Log the error stack for server-side debugging
  console.error(`[Error] ${req.method} ${req.url}:`, err.stack || err);

  res.status(statusCode).json({
    status: "error",
    message: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
