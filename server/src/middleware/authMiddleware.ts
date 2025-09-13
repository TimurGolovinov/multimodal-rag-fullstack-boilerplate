import { Request, Response, NextFunction } from "express";
import { Pool } from "pg";
import { AuthService, JWTPayload } from "../services/authService";
import { UserService, User } from "../services/userService";

/**
 * Extended Request interface with user information
 */
export interface AuthenticatedRequest extends Request {
  user?: User;
  tokenPayload?: JWTPayload;
}

/**
 * Role-based access control options
 */
export interface RoleOptions {
  roles?: string[];
  requireAll?: boolean; // If true, user must have ALL roles; if false, user needs ANY role
}

/**
 * AuthMiddleware - Handles authentication and authorization for Express routes
 *
 * Features:
 * - JWT token validation
 * - User context injection
 * - Role-based access control
 * - Token blacklist checking
 * - Optional authentication
 */
export class AuthMiddleware {
  private static pool: Pool;

  /**
   * Initialize middleware with database pool
   * @param pool - Database connection pool
   */
  public static initialize(pool: Pool): void {
    this.pool = pool;
  }

  /**
   * Require authentication - user must be logged in
   * @param req - Express request
   * @param res - Express response
   * @param next - Express next function
   */
  public static requireAuth = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const token = extractTokenFromRequest(req);

      if (!token) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
          message: "No authentication token provided",
        });
        return;
      }

      const user = await this.validateTokenAndGetUser(token);

      if (!user) {
        res.status(401).json({
          success: false,
          error: "Invalid authentication",
          message: "Invalid or expired token",
        });
        return;
      }

      // Check if user is active
      if (!user.isActive) {
        res.status(403).json({
          success: false,
          error: "Account disabled",
          message: "Your account has been disabled",
        });
        return;
      }

      // Add user to request
      req.user = user;
      next();
    } catch (error) {
      console.error("Auth middleware error:", error);
      res.status(500).json({
        success: false,
        error: "Authentication error",
        message: "Internal server error during authentication",
      });
    }
  };

  /**
   * Optional authentication - user may or may not be logged in
   * @param req - Express request
   * @param res - Express response
   * @param next - Express next function
   */
  public static optionalAuth = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const token = extractTokenFromRequest(req);

      if (token) {
        const user = await this.validateTokenAndGetUser(token);
        if (user && user.isActive) {
          req.user = user;
        }
      }

      next();
    } catch (error) {
      console.error("Optional auth middleware error:", error);
      // Continue without authentication for optional auth
      next();
    }
  };

  /**
   * Require specific roles
   * @param options - Role options
   * @returns Middleware function
   */
  public static requireRoles = (options: RoleOptions = {}) => {
    return async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        if (!req.user) {
          res.status(401).json({
            success: false,
            error: "Authentication required",
            message: "User must be authenticated to access this resource",
          });
          return;
        }

        const { roles = [], requireAll = false } = options;

        if (roles.length === 0) {
          // No specific roles required, just authentication
          next();
          return;
        }

        const userRole = req.user.role;
        let hasAccess = false;

        if (requireAll) {
          // User must have ALL specified roles
          hasAccess = roles.every((role) => userRole === role);
        } else {
          // User needs ANY of the specified roles
          hasAccess = roles.includes(userRole);
        }

        if (!hasAccess) {
          res.status(403).json({
            success: false,
            error: "Insufficient permissions",
            message: `Access denied. Required role(s): ${roles.join(", ")}`,
          });
          return;
        }

        next();
      } catch (error) {
        console.error("Role middleware error:", error);
        res.status(500).json({
          success: false,
          error: "Authorization error",
          message: "Internal server error during authorization",
        });
      }
    };
  };

  /**
   * Require admin role
   * @param req - Express request
   * @param res - Express response
   * @param next - Express next function
   */
  public static requireAdmin = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
          message: "User must be authenticated to access this resource",
        });
        return;
      }

      if (req.user.role !== "admin") {
        res.status(403).json({
          success: false,
          error: "Admin access required",
          message: "This resource requires administrator privileges",
        });
        return;
      }

      next();
    } catch (error) {
      console.error("Admin middleware error:", error);
      res.status(500).json({
        success: false,
        error: "Authorization error",
        message: "Internal server error during authorization",
      });
    }
  };

  /**
   * Require verified user
   * @param req - Express request
   * @param res - Express response
   * @param next - Express next function
   */
  public static requireVerified = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
          message: "User must be authenticated to access this resource",
        });
        return;
      }

      if (!req.user.isVerified) {
        res.status(403).json({
          success: false,
          error: "Email verification required",
          message: "Please verify your email address to access this resource",
        });
        return;
      }

      next();
    } catch (error) {
      console.error("Verification middleware error:", error);
      res.status(500).json({
        success: false,
        error: "Authorization error",
        message: "Internal server error during authorization",
      });
    }
  };

  /**
   * Validate token and get user information
   * @param token - JWT token
   * @returns Promise<User | null>
   */
  private static async validateTokenAndGetUser(
    token: string
  ): Promise<User | null> {
    try {
      // Validate token
      const payload = AuthService.validateAccessToken(token);
      if (!payload) {
        return null;
      }

      // Check if token is blacklisted
      const isBlacklisted = await AuthService.isTokenBlacklisted(
        payload.jti,
        this.pool
      );
      if (isBlacklisted) {
        return null;
      }

      // Get user from database
      const user = await UserService.getUserById(payload.userId, this.pool);
      return user;
    } catch (error) {
      console.error("Error validating token and getting user:", error);
      return null;
    }
  }
}

/**
 * Extract JWT token from request
 * @param req - Express request
 * @returns Token string or null
 */
function extractTokenFromRequest(req: Request): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // Check x-access-token header
  const accessToken = req.headers["x-access-token"] as string;
  if (accessToken) {
    return accessToken;
  }

  // Check cookies (if using cookie-based auth)
  const cookieToken = req.cookies?.accessToken;
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}

/**
 * Convenience middleware functions
 */
export const requireAuth = AuthMiddleware.requireAuth;
export const requireAdmin = AuthMiddleware.requireAdmin;
export const requireRoles = AuthMiddleware.requireRoles;
