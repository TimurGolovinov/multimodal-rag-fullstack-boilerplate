import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { Pool } from "pg";
import { AuthService } from "../services/authService";
import { UserService, CreateUserData } from "../services/userService";
import { PasswordService } from "../services/passwordService";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { CookieService } from "../services/cookieService";
import { InputSanitizationService } from "../services/inputSanitizationService";
import {
  SecurityLoggingService,
  SecurityEventType,
} from "../services/securityLoggingService";

/**
 * AuthController - Handles authentication endpoints
 *
 * Features:
 * - User registration
 * - User login
 * - Token refresh
 * - Logout
 * - Password reset (future)
 * - Email verification (future)
 */
export class AuthController {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Register a new user
   * POST /api/auth/register
   */
  public register = async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: "Validation failed",
          message: "Please check your input data",
          details: errors.array(),
        });
        return;
      }

      const { email, password, firstName, lastName } = req.body;

      // Sanitize inputs
      const sanitizedEmail = InputSanitizationService.sanitizeEmail(email);
      const sanitizedPassword =
        InputSanitizationService.sanitizePassword(password);
      const sanitizedFirstName = InputSanitizationService.sanitizeName(
        firstName,
        "firstName"
      );
      const sanitizedLastName = InputSanitizationService.sanitizeName(
        lastName,
        "lastName"
      );

      if (!sanitizedEmail || !sanitizedPassword) {
        res.status(400).json({
          success: false,
          error: "Invalid input",
          message: "Invalid email or password format",
        });
        return;
      }

      if (!sanitizedFirstName || !sanitizedLastName) {
        res.status(400).json({
          success: false,
          error: "Invalid input",
          message: "Invalid first name or last name format",
        });
        return;
      }

      // Create user data
      const userData: CreateUserData = {
        email: sanitizedEmail,
        password: sanitizedPassword,
        firstName: sanitizedFirstName,
        lastName: sanitizedLastName,
        role: "user", // Default role
      };

      // Create user
      const user = await UserService.createUser(userData, this.pool);

      // Generate tokens
      const authResult = await AuthService.generateTokens(
        {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isVerified: user.isVerified,
        },
        this.pool,
        req.get("User-Agent"),
        req.ip
      );

      if (!authResult.success) {
        res.status(500).json({
          success: false,
          error: "Registration failed",
          message: "Failed to create authentication tokens",
        });
        return;
      }

      // Set refresh token as httpOnly cookie
      if (authResult.refreshToken) {
        CookieService.setRefreshTokenCookie(res, authResult.refreshToken);
      }

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            isVerified: user.isVerified,
            isActive: user.isActive,
            createdAt: user.createdAt,
          },
          accessToken: authResult.accessToken,
          // Don't send refresh token in response body for security
        },
      });
    } catch (error: any) {
      console.error("Registration error:", error);

      if (error.message.includes("already exists")) {
        res.status(409).json({
          success: false,
          error: "User already exists",
          message: "A user with this email address already exists",
        });
        return;
      }

      if (error.message.includes("Password validation failed")) {
        res.status(400).json({
          success: false,
          error: "Password validation failed",
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: "Registration failed",
        message: "An error occurred during registration",
      });
    }
  };

  /**
   * Login user
   * POST /api/auth/login
   */
  public login = async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: "Validation failed",
          message: "Please check your input data",
          details: errors.array(),
        });
        return;
      }

      const { email, password } = req.body;

      // Sanitize inputs
      const sanitizedEmail = InputSanitizationService.sanitizeEmail(email);
      const sanitizedPassword =
        InputSanitizationService.sanitizePassword(password);

      if (!sanitizedEmail || !sanitizedPassword) {
        res.status(400).json({
          success: false,
          error: "Invalid input",
          message: "Invalid email or password format",
        });
        return;
      }

      // Get user with password hash
      const userWithPassword = await UserService.getUserWithPassword(
        sanitizedEmail,
        this.pool
      );

      if (!userWithPassword) {
        // Log failed login attempt
        SecurityLoggingService.logAuthEvent(
          SecurityEventType.LOGIN_FAILED,
          undefined,
          req.ip || "unknown",
          req.get("User-Agent"),
          "User not found",
          { email: sanitizedEmail, reason: "user_not_found" }
        );

        res.status(401).json({
          success: false,
          error: "Invalid credentials",
          message: "Invalid email or password",
        });
        return;
      }

      const { user, passwordHash } = userWithPassword;

      // Check if user is active
      if (!user.isActive) {
        res.status(403).json({
          success: false,
          error: "Account disabled",
          message: "Your account has been disabled",
        });
        return;
      }

      // Verify password
      const isPasswordValid = await PasswordService.comparePassword(
        sanitizedPassword,
        passwordHash
      );

      if (!isPasswordValid) {
        // Log failed login attempt
        SecurityLoggingService.logAuthEvent(
          SecurityEventType.LOGIN_FAILED,
          undefined,
          req.ip || "unknown",
          req.get("User-Agent"),
          "Invalid password provided",
          { email: sanitizedEmail, reason: "invalid_password" }
        );

        res.status(401).json({
          success: false,
          error: "Invalid credentials",
          message: "Invalid email or password",
        });
        return;
      }

      // Generate tokens
      const authResult = await AuthService.generateTokens(
        {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isVerified: user.isVerified,
        },
        this.pool,
        req.get("User-Agent"),
        req.ip
      );

      if (!authResult.success) {
        res.status(500).json({
          success: false,
          error: "Login failed",
          message: "Failed to create authentication tokens",
        });
        return;
      }

      // Set refresh token as httpOnly cookie
      if (authResult.refreshToken) {
        CookieService.setRefreshTokenCookie(res, authResult.refreshToken);
      }

      // Log successful login
      SecurityLoggingService.logAuthEvent(
        SecurityEventType.LOGIN_SUCCESS,
        user.id,
        req.ip || "unknown",
        req.get("User-Agent"),
        "User logged in successfully",
        { email: user.email, role: user.role }
      );

      res.json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            isVerified: user.isVerified,
            isActive: user.isActive,
            lastLogin: user.lastLogin,
          },
          accessToken: authResult.accessToken,
          // Don't send refresh token in response body for security
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        success: false,
        error: "Login failed",
        message: "An error occurred during login",
      });
    }
  };

  /**
   * Refresh access token
   * POST /api/auth/refresh
   */
  public refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      // Get refresh token from httpOnly cookie
      const refreshToken = CookieService.getRefreshTokenFromCookie(req);

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: "Refresh token required",
          message: "Please provide a refresh token",
        });
        return;
      }

      // Refresh the token
      const newTokens = await AuthService.refreshAccessToken(
        refreshToken,
        this.pool
      );

      if (!newTokens) {
        // Clear invalid refresh token cookie
        CookieService.clearRefreshTokenCookie(res);
        res.status(401).json({
          success: false,
          error: "Invalid refresh token",
          message: "Refresh token is invalid or expired",
        });
        return;
      }

      // Set new refresh token as httpOnly cookie
      CookieService.setRefreshTokenCookie(res, newTokens.refreshToken);

      res.json({
        success: true,
        message: "Token refreshed successfully",
        data: {
          accessToken: newTokens.accessToken,
          // Don't send refresh token in response body for security
        },
      });
    } catch (error) {
      console.error("Token refresh error:", error);
      res.status(500).json({
        success: false,
        error: "Token refresh failed",
        message: "An error occurred while refreshing the token",
      });
    }
  };

  /**
   * Logout user
   * POST /api/auth/logout
   */
  public logout = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const token = req.headers.authorization?.substring(7); // Remove 'Bearer ' prefix

      if (!token) {
        res.status(400).json({
          success: false,
          error: "Token required",
          message: "Please provide an authentication token",
        });
        return;
      }

      // Validate token to get user info
      const payload = AuthService.validateAccessToken(token);

      if (!payload) {
        res.status(401).json({
          success: false,
          error: "Invalid token",
          message: "Invalid authentication token",
        });
        return;
      }

      // Revoke all sessions for this user
      const revoked = await AuthService.revokeAllUserSessions(
        payload.userId,
        this.pool
      );

      // Clear refresh token cookie
      CookieService.clearRefreshTokenCookie(res);

      res.json({
        success: true,
        message: "Logout successful",
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({
        success: false,
        error: "Logout failed",
        message: "An error occurred during logout",
      });
    }
  };

  /**
   * Get current user information
   * GET /api/auth/me
   */
  public getCurrentUser = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
          message: "User must be authenticated",
        });
        return;
      }

      // Get user stats
      const stats = await UserService.getUserStats(req.user.id, this.pool);

      res.json({
        success: true,
        data: {
          user: {
            id: req.user.id,
            email: req.user.email,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
            avatarUrl: req.user.avatarUrl,
            role: req.user.role,
            isVerified: req.user.isVerified,
            isActive: req.user.isActive,
            createdAt: req.user.createdAt,
            updatedAt: req.user.updatedAt,
            lastLogin: req.user.lastLogin,
          },
          stats,
        },
      });
    } catch (error) {
      console.error("Get current user error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get user information",
        message: "An error occurred while retrieving user information",
      });
    }
  };

  /**
   * Logout from all devices
   * POST /api/auth/logout-all
   */
  public logoutAll = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
          message: "User must be authenticated",
        });
        return;
      }

      // Revoke all user sessions
      const revokedCount = await AuthService.revokeAllUserSessions(
        req.user.id,
        this.pool
      );

      // Clear refresh token cookie
      CookieService.clearRefreshTokenCookie(res);

      res.json({
        success: true,
        message: "Logged out from all devices",
        data: {
          revokedSessions: revokedCount,
        },
      });
    } catch (error) {
      console.error("Logout all error:", error);
      res.status(500).json({
        success: false,
        error: "Logout failed",
        message: "An error occurred while logging out from all devices",
      });
    }
  };

  /**
   * Get user sessions
   * GET /api/auth/sessions
   */
  public getUserSessions = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
          message: "User must be authenticated",
        });
        return;
      }

      const sessions = await AuthService.getUserSessions(
        req.user.id,
        this.pool
      );

      res.json({
        success: true,
        data: {
          sessions: sessions.map((session) => ({
            id: session.id,
            expiresAt: session.expiresAt,
            createdAt: session.createdAt,
            userAgent: session.userAgent,
            ipAddress: session.ipAddress,
          })),
        },
      });
    } catch (error) {
      console.error("Get user sessions error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get user sessions",
        message: "An error occurred while retrieving user sessions",
      });
    }
  };
}
