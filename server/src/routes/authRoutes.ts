import { Router } from "express";
import { body } from "express-validator";
import { Pool } from "pg";
import { AuthController } from "../controllers/authController";
import { requireAuth } from "../middleware/authMiddleware";
import { CSRFMiddleware } from "../middleware/csrfMiddleware";

/**
 * Create authentication routes
 * @param pool - Database connection pool
 * @returns Express router with authentication routes
 */
export function createAuthRoutes(pool: Pool): Router {
  const router = Router();
  const authController = new AuthController(pool);

  // Validation rules
  const registerValidation = [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Please provide a valid email address"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long")
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage(
        "Password must contain at least one lowercase letter, one uppercase letter, and one number"
      ),
    body("firstName")
      .optional()
      .isLength({ min: 1, max: 100 })
      .trim()
      .withMessage("First name must be between 1 and 100 characters"),
    body("lastName")
      .optional()
      .isLength({ min: 1, max: 100 })
      .trim()
      .withMessage("Last name must be between 1 and 100 characters"),
  ];

  const loginValidation = [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Please provide a valid email address"),
    body("password").notEmpty().withMessage("Password is required"),
  ];

  const refreshTokenValidation = [
    body("refreshToken").notEmpty().withMessage("Refresh token is required"),
  ];

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
    registerValidation,
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
    loginValidation,
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
    refreshTokenValidation,
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
