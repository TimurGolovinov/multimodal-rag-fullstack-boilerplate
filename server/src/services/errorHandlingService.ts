import { Response } from "express";

/**
 * Error types for different categories
 */
export enum ErrorType {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR",
  NOT_FOUND_ERROR = "NOT_FOUND_ERROR",
  RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
  FILE_ERROR = "FILE_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  CSRF_ERROR = "CSRF_ERROR",
  INPUT_ERROR = "INPUT_ERROR",
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

/**
 * Secure error response interface
 */
export interface SecureErrorResponse {
  success: false;
  error: string;
  message: string;
  timestamp: string;
  requestId?: string;
}

/**
 * Internal error details (for logging only)
 */
export interface InternalErrorDetails {
  type: ErrorType;
  severity: ErrorSeverity;
  originalError?: Error;
  context?: Record<string, any>;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Error handling service for secure error responses
 * Prevents information disclosure while maintaining useful error messages
 */
export class ErrorHandlingService {
  // User-friendly error messages (safe to expose)
  private static readonly ERROR_MESSAGES: Record<ErrorType, string> = {
    [ErrorType.VALIDATION_ERROR]: "The provided data is invalid",
    [ErrorType.AUTHENTICATION_ERROR]: "Authentication required",
    [ErrorType.AUTHORIZATION_ERROR]: "Access denied",
    [ErrorType.NOT_FOUND_ERROR]: "The requested resource was not found",
    [ErrorType.RATE_LIMIT_ERROR]: "Too many requests, please try again later",
    [ErrorType.FILE_ERROR]: "File processing failed",
    [ErrorType.DATABASE_ERROR]: "A database error occurred",
    [ErrorType.EXTERNAL_SERVICE_ERROR]: "External service unavailable",
    [ErrorType.INTERNAL_SERVER_ERROR]: "An internal server error occurred",
    [ErrorType.CSRF_ERROR]: "Invalid request token",
    [ErrorType.INPUT_ERROR]: "Invalid input provided",
  };

  // Error codes for client-side handling
  private static readonly ERROR_CODES: Record<ErrorType, string> = {
    [ErrorType.VALIDATION_ERROR]: "VALIDATION_FAILED",
    [ErrorType.AUTHENTICATION_ERROR]: "AUTH_REQUIRED",
    [ErrorType.AUTHORIZATION_ERROR]: "ACCESS_DENIED",
    [ErrorType.NOT_FOUND_ERROR]: "NOT_FOUND",
    [ErrorType.RATE_LIMIT_ERROR]: "RATE_LIMIT_EXCEEDED",
    [ErrorType.FILE_ERROR]: "FILE_PROCESSING_ERROR",
    [ErrorType.DATABASE_ERROR]: "DATABASE_ERROR",
    [ErrorType.EXTERNAL_SERVICE_ERROR]: "EXTERNAL_SERVICE_ERROR",
    [ErrorType.INTERNAL_SERVER_ERROR]: "INTERNAL_ERROR",
    [ErrorType.CSRF_ERROR]: "CSRF_TOKEN_INVALID",
    [ErrorType.INPUT_ERROR]: "INVALID_INPUT",
  };

  /**
   * Handle and send a secure error response
   * @param res - Express response object
   * @param errorType - Type of error
   * @param statusCode - HTTP status code
   * @param details - Internal error details (for logging)
   * @param customMessage - Custom user message (optional)
   */
  public static handleError(
    res: Response,
    errorType: ErrorType,
    statusCode: number,
    details?: InternalErrorDetails,
    customMessage?: string
  ): void {
    // Log the error internally (with full details)
    this.logError(errorType, details);

    // Create secure response
    const response: SecureErrorResponse = {
      success: false,
      error: this.ERROR_CODES[errorType],
      message: customMessage || this.ERROR_MESSAGES[errorType],
      timestamp: new Date().toISOString(),
      requestId: details?.context?.requestId,
    };

    // Send response
    res.status(statusCode).json(response);
  }

  /**
   * Handle validation errors
   * @param res - Express response object
   * @param validationErrors - Array of validation errors
   * @param requestId - Request ID for tracking
   */
  public static handleValidationError(
    res: Response,
    validationErrors: any[],
    requestId?: string
  ): void {
    this.logError(ErrorType.VALIDATION_ERROR, {
      type: ErrorType.VALIDATION_ERROR,
      severity: ErrorSeverity.LOW,
      context: { validationErrors, requestId },
    });

    const response: SecureErrorResponse = {
      success: false,
      error: this.ERROR_CODES[ErrorType.VALIDATION_ERROR],
      message: "Please check your input data",
      timestamp: new Date().toISOString(),
      requestId,
    };

    res.status(400).json(response);
  }

  /**
   * Handle authentication errors
   * @param res - Express response object
   * @param message - Custom message (optional)
   * @param details - Internal error details
   */
  public static handleAuthenticationError(
    res: Response,
    message?: string,
    details?: InternalErrorDetails
  ): void {
    this.handleError(
      res,
      ErrorType.AUTHENTICATION_ERROR,
      401,
      details,
      message
    );
  }

  /**
   * Handle authorization errors
   * @param res - Express response object
   * @param message - Custom message (optional)
   * @param details - Internal error details
   */
  public static handleAuthorizationError(
    res: Response,
    message?: string,
    details?: InternalErrorDetails
  ): void {
    this.handleError(res, ErrorType.AUTHORIZATION_ERROR, 403, details, message);
  }

  /**
   * Handle not found errors
   * @param res - Express response object
   * @param resource - Resource that was not found
   * @param details - Internal error details
   */
  public static handleNotFoundError(
    res: Response,
    resource: string = "Resource",
    details?: InternalErrorDetails
  ): void {
    this.handleError(
      res,
      ErrorType.NOT_FOUND_ERROR,
      404,
      details,
      `${resource} not found`
    );
  }

  /**
   * Handle rate limit errors
   * @param res - Express response object
   * @param retryAfter - Seconds to wait before retry
   * @param details - Internal error details
   */
  public static handleRateLimitError(
    res: Response,
    retryAfter?: number,
    details?: InternalErrorDetails
  ): void {
    const response: SecureErrorResponse = {
      success: false,
      error: this.ERROR_CODES[ErrorType.RATE_LIMIT_ERROR],
      message: "Too many requests, please try again later",
      timestamp: new Date().toISOString(),
      requestId: details?.context?.requestId,
    };

    if (retryAfter) {
      res.set("Retry-After", retryAfter.toString());
    }

    this.logError(ErrorType.RATE_LIMIT_ERROR, details);
    res.status(429).json(response);
  }

  /**
   * Handle file processing errors
   * @param res - Express response object
   * @param message - Custom message (optional)
   * @param details - Internal error details
   */
  public static handleFileError(
    res: Response,
    message?: string,
    details?: InternalErrorDetails
  ): void {
    this.handleError(
      res,
      ErrorType.FILE_ERROR,
      400,
      details,
      message || "File processing failed"
    );
  }

  /**
   * Handle database errors
   * @param res - Express response object
   * @param details - Internal error details
   */
  public static handleDatabaseError(
    res: Response,
    details?: InternalErrorDetails
  ): void {
    this.handleError(res, ErrorType.DATABASE_ERROR, 500, details);
  }

  /**
   * Handle external service errors
   * @param res - Express response object
   * @param service - Service name
   * @param details - Internal error details
   */
  public static handleExternalServiceError(
    res: Response,
    service: string,
    details?: InternalErrorDetails
  ): void {
    this.handleError(
      res,
      ErrorType.EXTERNAL_SERVICE_ERROR,
      502,
      details,
      "External service temporarily unavailable"
    );
  }

  /**
   * Handle CSRF errors
   * @param res - Express response object
   * @param details - Internal error details
   */
  public static handleCSRFError(
    res: Response,
    details?: InternalErrorDetails
  ): void {
    this.handleError(
      res,
      ErrorType.CSRF_ERROR,
      403,
      details,
      "Invalid request token"
    );
  }

  /**
   * Handle input errors
   * @param res - Express response object
   * @param message - Custom message (optional)
   * @param details - Internal error details
   */
  public static handleInputError(
    res: Response,
    message?: string,
    details?: InternalErrorDetails
  ): void {
    this.handleError(
      res,
      ErrorType.INPUT_ERROR,
      400,
      details,
      message || "Invalid input provided"
    );
  }

  /**
   * Handle internal server errors (catch-all)
   * @param res - Express response object
   * @param error - Original error
   * @param details - Internal error details
   */
  public static handleInternalError(
    res: Response,
    error: Error,
    details?: InternalErrorDetails
  ): void {
    this.handleError(res, ErrorType.INTERNAL_SERVER_ERROR, 500, {
      type: ErrorType.INTERNAL_SERVER_ERROR,
      severity: ErrorSeverity.HIGH,
      originalError: error,
      ...details,
    });
  }

  /**
   * Log error internally (with full details)
   * @param errorType - Type of error
   * @param details - Error details
   */
  private static logError(
    errorType: ErrorType,
    details?: InternalErrorDetails
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: errorType,
      severity: details?.severity || ErrorSeverity.MEDIUM,
      message: details?.originalError?.message || "Unknown error",
      stack: details?.originalError?.stack,
      context: details?.context,
      userId: details?.userId,
      ipAddress: details?.ipAddress,
      userAgent: details?.userAgent,
    };

    // Log based on severity
    if (details?.severity === ErrorSeverity.CRITICAL) {
      console.error("CRITICAL ERROR:", logEntry);
    } else if (details?.severity === ErrorSeverity.HIGH) {
      console.error("HIGH SEVERITY ERROR:", logEntry);
    } else if (details?.severity === ErrorSeverity.MEDIUM) {
      console.warn("MEDIUM SEVERITY ERROR:", logEntry);
    } else {
      console.log("LOW SEVERITY ERROR:", logEntry);
    }
  }

  /**
   * Create error details from request
   * @param req - Express request object
   * @param additionalContext - Additional context
   * @returns Error details object
   */
  public static createErrorDetails(
    req: any,
    additionalContext?: Record<string, any>
  ): InternalErrorDetails {
    return {
      type: ErrorType.INTERNAL_SERVER_ERROR,
      severity: ErrorSeverity.MEDIUM,
      context: {
        method: req.method,
        url: req.url,
        headers: this.sanitizeHeaders(req.headers),
        ...additionalContext,
      },
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get("User-Agent"),
    };
  }

  /**
   * Sanitize headers to remove sensitive information
   * @param headers - Request headers
   * @returns Sanitized headers
   */
  private static sanitizeHeaders(headers: any): Record<string, any> {
    const sensitiveHeaders = [
      "authorization",
      "cookie",
      "x-api-key",
      "x-csrf-token",
      "x-access-token",
    ];

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}
