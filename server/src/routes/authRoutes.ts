import { Router } from "express";
import { Pool } from "pg";
import { AuthController } from "../controllers/authController";
import { requireAuth } from "../middleware/authMiddleware";
import { CSRFMiddleware } from "../middleware/csrfMiddleware";
import { validateBody } from "../middleware/validationMiddleware";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
} from "../schemas/authSchemas";

/**
 * Create authentication routes
 * @param pool - Database connection pool
 * @returns Express router with authentication routes
 */
export function createAuthRoutes(pool: Pool): Router {
  const router = Router();
  const authController = new AuthController(pool);

  // Public routes (no authentication required)

  /**
   * @route   POST /api/auth/register
   * @desc    Register a new user
   * @access  Public
   */
  // CSRF token endpoint
  router.get("/csrf-token", CSRFMiddleware.getToken);

  router.post(
    "/register",
    CSRFMiddleware.csrfProtection,
    validateBody(registerSchema),
    authController.register
  );

  /**
   * @route   POST /api/auth/login
   * @desc    Login user
   * @access  Public
   */
  router.post(
    "/login",
    CSRFMiddleware.csrfProtection,
    validateBody(loginSchema),
    authController.login
  );

  /**
   * @route   POST /api/auth/refresh
   * @desc    Refresh access token
   * @access  Public
   */
  router.post(
    "/refresh",
    CSRFMiddleware.csrfProtection,
    validateBody(refreshTokenSchema),
    authController.refreshToken
  );

  // Protected routes (authentication required)

  /**
   * @route   GET /api/auth/me
   * @desc    Get current user information
   * @access  Private
   */
  router.get("/me", requireAuth, authController.getCurrentUser);

  /**
   * @route   POST /api/auth/logout
   * @desc    Logout user (revoke current session)
   * @access  Private
   */
  router.post(
    "/logout",
    CSRFMiddleware.csrfProtection,
    requireAuth,
    authController.logout
  );

  /**
   * @route   POST /api/auth/logout-all
   * @desc    Logout from all devices
   * @access  Private
   */
  router.post(
    "/logout-all",
    CSRFMiddleware.csrfProtection,
    requireAuth,
    authController.logoutAll
  );

  /**
   * @route   GET /api/auth/sessions
   * @desc    Get user sessions
   * @access  Private
   */
  router.get("/sessions", requireAuth, authController.getUserSessions);

  return router;
}
