import { Response } from "express";

/**
 * CookieService - Handles secure cookie operations for authentication
 *
 * Features:
 * - httpOnly cookies for refresh tokens
 * - Secure cookie settings
 * - SameSite protection
 * - Configurable expiry times
 */
export class CookieService {
  private static readonly REFRESH_TOKEN_COOKIE_NAME = "refreshToken";
  private static readonly REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  private static readonly COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // Only secure in production
    sameSite: "strict" as const,
    maxAge: this.REFRESH_TOKEN_MAX_AGE,
    path: "/api/auth", // Only send to auth endpoints
  };

  /**
   * Set refresh token as httpOnly cookie
   * @param res - Express response object
   * @param refreshToken - Refresh token to set
   */
  public static setRefreshTokenCookie(
    res: Response,
    refreshToken: string
  ): void {
    res.cookie(
      this.REFRESH_TOKEN_COOKIE_NAME,
      refreshToken,
      this.COOKIE_OPTIONS
    );
  }

  /**
   * Clear refresh token cookie
   * @param res - Express response object
   */
  public static clearRefreshTokenCookie(res: Response): void {
    res.clearCookie(this.REFRESH_TOKEN_COOKIE_NAME, {
      ...this.COOKIE_OPTIONS,
      maxAge: 0, // Expire immediately
    });
  }

  /**
   * Get refresh token from cookie
   * @param req - Express request object
   * @returns Refresh token or null
   */
  public static getRefreshTokenFromCookie(req: any): string | null {
    return req.cookies?.[this.REFRESH_TOKEN_COOKIE_NAME] || null;
  }

  /**
   * Get cookie name for refresh token
   * @returns Cookie name
   */
  public static getRefreshTokenCookieName(): string {
    return this.REFRESH_TOKEN_COOKIE_NAME;
  }

  /**
   * Get cookie options for refresh token
   * @returns Cookie options
   */
  public static getCookieOptions() {
    return { ...this.COOKIE_OPTIONS };
  }
}
