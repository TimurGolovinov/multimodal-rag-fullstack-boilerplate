import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { Pool, PoolClient } from "pg";
import { PasswordService } from "./passwordService";

/**
 * JWT Token payload interface
 */
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  jti: string; // JWT ID for token tracking
  iat: number;
  exp: number;
}

/**
 * Refresh token payload interface
 */
export interface RefreshTokenPayload {
  userId: string;
  jti: string;
  iat: number;
  exp: number;
}

/**
 * Authentication result interface
 */
export interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: string;
    isVerified: boolean;
  };
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}

/**
 * Session information interface
 */
export interface SessionInfo {
  id: string;
  userId: string;
  tokenJti: string;
  expiresAt: Date;
  createdAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * AuthService - Handles JWT token generation, validation, and session management
 *
 * Features:
 * - JWT access token generation and validation
 * - Refresh token management
 * - Session tracking and blacklisting
 * - Token expiration and rotation
 * - Secure token storage
 */
export class AuthService {
  private static readonly ACCESS_TOKEN_EXPIRY = "15m"; // 15 minutes
  private static readonly REFRESH_TOKEN_EXPIRY = "7d"; // 7 days
  private static readonly JWT_SECRET = process.env.JWT_SECRET;
  private static readonly REFRESH_TOKEN_SECRET =
    process.env.REFRESH_TOKEN_SECRET;

  /**
   * Generate access and refresh tokens for a user
   * @param user - User information
   * @param pool - Database connection pool
   * @param userAgent - User agent string
   * @param ipAddress - User IP address
   * @returns Promise<AuthResult>
   */
  public static async generateTokens(
    user: {
      id: string;
      email: string;
      firstName?: string;
      lastName?: string;
      role: string;
      isVerified: boolean;
    },
    pool: Pool,
    userAgent?: string,
    ipAddress?: string
  ): Promise<AuthResult> {
    try {
      // Validate required environment variables
      if (!this.JWT_SECRET || !this.REFRESH_TOKEN_SECRET) {
        throw new Error(
          "JWT secrets not configured. Please set JWT_SECRET and REFRESH_TOKEN_SECRET environment variables."
        );
      }

      const jti = uuidv4();
      const refreshJti = uuidv4();

      // Generate access token
      const accessTokenPayload: JWTPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        jti,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutes
      };

      const accessToken = jwt.sign(accessTokenPayload, this.JWT_SECRET, {
        issuer: "rag-app",
        audience: "rag-client",
      });

      // Generate refresh token
      const refreshTokenPayload: RefreshTokenPayload = {
        userId: user.id,
        jti: refreshJti,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
      };

      const refreshToken = jwt.sign(
        refreshTokenPayload,
        this.REFRESH_TOKEN_SECRET,
        {
          issuer: "rag-app",
          audience: "rag-client",
        }
      );

      // Hash refresh token for storage
      const refreshTokenHash = await PasswordService.hashPassword(refreshToken);

      // Store session in database
      const client = await pool.connect();
      try {
        await client.query(
          `INSERT INTO user_sessions (user_id, token_jti, refresh_token_hash, expires_at, user_agent, ip_address)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            user.id,
            refreshJti,
            refreshTokenHash,
            new Date(refreshTokenPayload.exp * 1000),
            userAgent,
            ipAddress,
          ]
        );

        // Update user's last login
        await client.query(
          "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1",
          [user.id]
        );
      } finally {
        client.release();
      }

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isVerified: user.isVerified,
        },
        accessToken,
        refreshToken,
      };
    } catch (error) {
      console.error("Error generating tokens:", error);
      return {
        success: false,
        error: "Failed to generate authentication tokens",
      };
    }
  }

  /**
   * Validate and decode JWT access token
   * @param token - JWT access token
   * @returns Decoded token payload or null if invalid
   */
  public static validateAccessToken(token: string): JWTPayload | null {
    try {
      if (!this.JWT_SECRET) {
        console.error("JWT_SECRET not configured");
        return null;
      }

      const decoded = jwt.verify(token, this.JWT_SECRET, {
        issuer: "rag-app",
        audience: "rag-client",
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        console.log("Access token expired");
      } else if (error instanceof jwt.JsonWebTokenError) {
        console.log("Invalid access token:", error.message);
      } else {
        console.error("Error validating access token:", error);
      }
      return null;
    }
  }

  /**
   * Validate and decode refresh token
   * @param token - Refresh token
   * @returns Decoded token payload or null if invalid
   */
  public static validateRefreshToken(
    token: string
  ): RefreshTokenPayload | null {
    try {
      if (!this.REFRESH_TOKEN_SECRET) {
        console.error("REFRESH_TOKEN_SECRET not configured");
        return null;
      }

      const decoded = jwt.verify(token, this.REFRESH_TOKEN_SECRET, {
        issuer: "rag-app",
        audience: "rag-client",
      }) as RefreshTokenPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        console.log("Refresh token expired");
      } else if (error instanceof jwt.JsonWebTokenError) {
        console.log("Invalid refresh token:", error.message);
      } else {
        console.error("Error validating refresh token:", error);
      }
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   * @param refreshToken - Refresh token
   * @param pool - Database connection pool
   * @returns New access token or null if refresh failed
   */
  public static async refreshAccessToken(
    refreshToken: string,
    pool: Pool
  ): Promise<{ accessToken: string; refreshToken: string } | null> {
    try {
      // Validate refresh token
      const payload = this.validateRefreshToken(refreshToken);
      if (!payload) {
        return null;
      }

      // Check if session exists and is not revoked
      const client = await pool.connect();
      try {
        const sessionResult = await client.query(
          `SELECT us.*, u.email, u.first_name, u.last_name, u.role, u.is_verified, u.is_active
           FROM user_sessions us
           JOIN users u ON us.user_id = u.id
           WHERE us.token_jti = $1 AND us.is_revoked = FALSE AND us.expires_at > CURRENT_TIMESTAMP`,
          [payload.jti]
        );

        if (sessionResult.rows.length === 0) {
          console.log("Session not found or expired");
          return null;
        }

        const session = sessionResult.rows[0];
        const user = sessionResult.rows[0];

        // Verify refresh token hash
        const isValidToken = await PasswordService.comparePassword(
          refreshToken,
          session.refresh_token_hash
        );
        if (!isValidToken) {
          console.log("Invalid refresh token hash");
          return null;
        }

        // Check if user is still active
        if (!user.is_active) {
          console.log("User account is inactive");
          return null;
        }

        // Generate new tokens
        const authResult = await this.generateTokens(
          {
            id: user.user_id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            isVerified: user.is_verified,
          },
          pool,
          session.user_agent,
          session.ip_address
        );

        if (
          authResult.success &&
          authResult.accessToken &&
          authResult.refreshToken
        ) {
          // Revoke old session
          await client.query(
            "UPDATE user_sessions SET is_revoked = TRUE WHERE token_jti = $1",
            [payload.jti]
          );

          return {
            accessToken: authResult.accessToken,
            refreshToken: authResult.refreshToken,
          };
        }

        return null;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Error refreshing access token:", error);
      return null;
    }
  }

  /**
   * Revoke a session (logout)
   * @param tokenJti - JWT ID of the session to revoke
   * @param pool - Database connection pool
   * @returns Promise<boolean>
   */
  public static async revokeSession(
    tokenJti: string,
    pool: Pool
  ): Promise<boolean> {
    try {
      const client = await pool.connect();
      try {
        const result = await client.query(
          "UPDATE user_sessions SET is_revoked = TRUE WHERE token_jti = $1",
          [tokenJti]
        );

        return (result.rowCount || 0) > 0;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Error revoking session:", error);
      return false;
    }
  }

  /**
   * Revoke all sessions for a user
   * @param userId - User ID
   * @param pool - Database connection pool
   * @returns Promise<number> - Number of sessions revoked
   */
  public static async revokeAllUserSessions(
    userId: string,
    pool: Pool
  ): Promise<number> {
    try {
      const client = await pool.connect();
      try {
        const result = await client.query(
          "UPDATE user_sessions SET is_revoked = TRUE WHERE user_id = $1 AND is_revoked = FALSE",
          [userId]
        );

        return result.rowCount || 0;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Error revoking all user sessions:", error);
      return 0;
    }
  }

  /**
   * Get active sessions for a user
   * @param userId - User ID
   * @param pool - Database connection pool
   * @returns Promise<SessionInfo[]>
   */
  public static async getUserSessions(
    userId: string,
    pool: Pool
  ): Promise<SessionInfo[]> {
    try {
      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT id, user_id, token_jti, expires_at, created_at, user_agent, ip_address
           FROM user_sessions
           WHERE user_id = $1 AND is_revoked = FALSE AND expires_at > CURRENT_TIMESTAMP
           ORDER BY created_at DESC`,
          [userId]
        );

        return result.rows.map((row) => ({
          id: row.id,
          userId: row.user_id,
          tokenJti: row.token_jti,
          expiresAt: row.expires_at,
          createdAt: row.created_at,
          userAgent: row.user_agent,
          ipAddress: row.ip_address,
        }));
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Error getting user sessions:", error);
      return [];
    }
  }

  /**
   * Clean up expired sessions
   * @param pool - Database connection pool
   * @returns Promise<number> - Number of sessions cleaned up
   */
  public static async cleanupExpiredSessions(pool: Pool): Promise<number> {
    try {
      const client = await pool.connect();
      try {
        const result = await client.query(
          "SELECT cleanup_expired_sessions() as deleted_count"
        );
        return result.rows[0].deleted_count || 0;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Error cleaning up expired sessions:", error);
      return 0;
    }
  }

  /**
   * Check if a token is blacklisted
   * @param tokenJti - JWT ID to check
   * @param pool - Database connection pool
   * @returns Promise<boolean>
   */
  public static async isTokenBlacklisted(
    tokenJti: string,
    pool: Pool
  ): Promise<boolean> {
    try {
      const client = await pool.connect();
      try {
        const result = await client.query(
          "SELECT 1 FROM user_sessions WHERE token_jti = $1 AND is_revoked = TRUE",
          [tokenJti]
        );

        return result.rows.length > 0;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Error checking token blacklist:", error);
      return false;
    }
  }
}
