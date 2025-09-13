import { Router } from "express";
import { body, param, query } from "express-validator";
import { Pool } from "pg";
import { UserController } from "../controllers/userController";
import {
  requireAuth,
  requireAdmin,
  requireRoles,
} from "../middleware/authMiddleware";

/**
 * Create user management routes
 * @param pool - Database connection pool
 * @returns Express router with user management routes
 */
export function createUserRoutes(pool: Pool): Router {
  const router = Router();
  const userController = new UserController(pool);

  // Validation rules
  const profileUpdateValidation = [
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
    body("avatarUrl")
      .optional()
      .isURL()
      .withMessage("Avatar URL must be a valid URL"),
  ];

  const passwordChangeValidation = [
    body("currentPassword")
      .notEmpty()
      .withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("New password must be at least 8 characters long")
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage(
        "New password must contain at least one lowercase letter, one uppercase letter, and one number"
      ),
  ];

  const userUpdateValidation = [
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
    body("avatarUrl")
      .optional()
      .isURL()
      .withMessage("Avatar URL must be a valid URL"),
    body("role")
      .optional()
      .isIn(["admin", "user", "viewer"])
      .withMessage("Role must be one of: admin, user, viewer"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean value"),
    body("isVerified")
      .optional()
      .isBoolean()
      .withMessage("isVerified must be a boolean value"),
  ];

  const userIdValidation = [
    param("id").isUUID().withMessage("User ID must be a valid UUID"),
  ];

  const paginationValidation = [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
  ];

  const searchValidation = [
    query("q")
      .isLength({ min: 1, max: 100 })
      .trim()
      .withMessage("Search query must be between 1 and 100 characters"),
  ];

  // User profile routes (authenticated users)

  /**
   * @route   GET /api/users/profile
   * @desc    Get current user profile
   * @access  Private
   */
  router.get("/profile", requireAuth, userController.getProfile);

  /**
   * @route   PUT /api/users/profile
   * @desc    Update current user profile
   * @access  Private
   */
  router.put(
    "/profile",
    requireAuth,
    profileUpdateValidation,
    userController.updateProfile
  );

  /**
   * @route   PUT /api/users/password
   * @desc    Change current user password
   * @access  Private
   */
  router.put(
    "/password",
    requireAuth,
    passwordChangeValidation,
    userController.changePassword
  );

  // Admin routes (admin only)

  /**
   * @route   GET /api/users
   * @desc    Get all users (with pagination)
   * @access  Admin
   */
  router.get("/", requireAdmin, paginationValidation, userController.getUsers);

  /**
   * @route   GET /api/users/search
   * @desc    Search users by email or name
   * @access  Admin
   */
  router.get(
    "/search",
    requireAdmin,
    searchValidation,
    userController.searchUsers
  );

  /**
   * @route   GET /api/users/:id
   * @desc    Get user by ID
   * @access  Admin
   */
  router.get(
    "/:id",
    requireAdmin,
    userIdValidation,
    userController.getUserById
  );

  /**
   * @route   PUT /api/users/:id
   * @desc    Update user by ID
   * @access  Admin
   */
  router.put(
    "/:id",
    requireAdmin,
    userIdValidation,
    userUpdateValidation,
    userController.updateUser
  );

  /**
   * @route   DELETE /api/users/:id
   * @desc    Delete user by ID (soft delete)
   * @access  Admin
   */
  router.delete(
    "/:id",
    requireAdmin,
    userIdValidation,
    userController.deleteUser
  );

  return router;
}
