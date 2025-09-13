import { Request, Response, NextFunction } from "express";
import { CSRFService } from "../services/csrfService";

/**
 * CSRF Middleware - Protects against Cross-Site Request Forgery attacks
 *
 * Features:
 * - Validates CSRF tokens for state-changing operations
 * - Generates CSRF tokens for GET requests
 * - Excludes safe methods (GET, HEAD, OPTIONS)
 */
export class CSRFMiddleware {
  /**
   * CSRF protection middleware
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Next function
   */
  public static csrfProtection(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    // Skip CSRF protection for safe methods
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      // Generate and set CSRF token for GET requests
      const token = CSRFService.generateToken();
      CSRFService.setCSRFTokenCookie(res, token);
      return next();
    }

    // Validate CSRF token for state-changing operations
    if (!CSRFService.validateCSRFToken(req)) {
      res.status(403).json({
        success: false,
        error: "CSRF token validation failed",
        message: "Invalid or missing CSRF token",
      });
      return;
    }

    next();
  }

  /**
   * Generate CSRF token endpoint
   * @param req - Express request object
   * @param res - Express response object
   */
  public static generateToken(req: Request, res: Response): void {
    const token = CSRFService.generateToken();
    CSRFService.setCSRFTokenCookie(res, token);

    res.json({
      success: true,
      data: {
        csrfToken: token,
      },
    });
  }

  /**
   * Get CSRF token from cookie or generate new one
   * @param req - Express request object
   * @param res - Express response object
   */
  public static getToken(req: Request, res: Response): void {
    let token = CSRFService.getCSRFTokenFromCookie(req);

    // If no token exists, generate a new one
    if (!token) {
      token = CSRFService.generateToken();
      CSRFService.setCSRFTokenCookie(res, token);
    }

    res.json({
      success: true,
      data: {
        csrfToken: token,
      },
    });
  }
}
