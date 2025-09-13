import crypto from "crypto";
import { Request, Response } from "express";

/**
 * CSRFService - Handles CSRF token generation and validation
 *
 * Features:
 * - CSRF token generation using crypto.randomBytes
 * - Token validation against stored tokens
 * - SameSite cookie protection
 * - Token expiry management
 */
export class CSRFService {
  private static readonly CSRF_TOKEN_COOKIE_NAME = "csrfToken";
  private static readonly CSRF_TOKEN_HEADER_NAME = "x-csrf-token";
  private static readonly CSRF_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds
  private static readonly CSRF_SECRET = process.env.CSRF_SECRET;

  /**
   * Generate a CSRF token
   * @returns CSRF token
   */
  public static generateToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Create a signed CSRF token
   * @param token - CSRF token
   * @returns Signed token
   */
  public static signToken(token: string): string {
    if (!this.CSRF_SECRET) {
      throw new Error(
        "CSRF_SECRET not configured. Please set CSRF_SECRET environment variable."
      );
    }

    const signature = crypto
      .createHmac("sha256", this.CSRF_SECRET)
      .update(token)
      .digest("hex");
    return `${token}.${signature}`;
  }

  /**
   * Verify a signed CSRF token
   * @param signedToken - Signed CSRF token
   * @returns Original token if valid, null if invalid
   */
  public static verifyToken(signedToken: string): string | null {
    if (!this.CSRF_SECRET) {
      console.error("CSRF_SECRET not configured");
      return null;
    }

    if (!signedToken || typeof signedToken !== "string") {
      return null;
    }

    const parts = signedToken.split(".");
    if (parts.length !== 2) {
      return null;
    }

    const [token, signature] = parts;
    const expectedSignature = crypto
      .createHmac("sha256", this.CSRF_SECRET)
      .update(token)
      .digest("hex");

    if (signature !== expectedSignature) {
      return null;
    }

    return token;
  }

  /**
   * Set CSRF token as cookie
   * @param res - Express response object
   * @param token - CSRF token
   */
  public static setCSRFTokenCookie(res: Response, token: string): void {
    const signedToken = this.signToken(token);
    res.cookie(this.CSRF_TOKEN_COOKIE_NAME, signedToken, {
      httpOnly: false, // Allow JavaScript to read for form submission
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: this.CSRF_TOKEN_EXPIRY,
      path: "/",
    });
  }

  /**
   * Get CSRF token from cookie
   * @param req - Express request object
   * @returns CSRF token or null
   */
  public static getCSRFTokenFromCookie(req: Request): string | null {
    const signedToken = req.cookies?.[this.CSRF_TOKEN_COOKIE_NAME];
    if (!signedToken) {
      return null;
    }
    return this.verifyToken(signedToken);
  }

  /**
   * Get CSRF token from header
   * @param req - Express request object
   * @returns CSRF token or null
   */
  public static getCSRFTokenFromHeader(req: Request): string | null {
    const token = req.headers[this.CSRF_TOKEN_HEADER_NAME] as string;
    return token || null;
  }

  /**
   * Validate CSRF token
   * @param req - Express request object
   * @returns True if valid, false otherwise
   */
  public static validateCSRFToken(req: Request): boolean {
    const cookieToken = this.getCSRFTokenFromCookie(req);
    const headerToken = this.getCSRFTokenFromHeader(req);

    if (!cookieToken || !headerToken) {
      return false;
    }

    return cookieToken === headerToken;
  }

  /**
   * Clear CSRF token cookie
   * @param res - Express response object
   */
  public static clearCSRFTokenCookie(res: Response): void {
    res.clearCookie(this.CSRF_TOKEN_COOKIE_NAME, {
      path: "/",
    });
  }

  /**
   * Get CSRF token cookie name
   * @returns Cookie name
   */
  public static getCSRFTokenCookieName(): string {
    return this.CSRF_TOKEN_COOKIE_NAME;
  }

  /**
   * Get CSRF token header name
   * @returns Header name
   */
  public static getCSRFTokenHeaderName(): string {
    return this.CSRF_TOKEN_HEADER_NAME;
  }
}
