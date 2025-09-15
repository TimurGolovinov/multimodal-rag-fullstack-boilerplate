import { Router } from "express";
import { Pool } from "pg";
import { UserController } from "../controllers/userController";
import {
  requireAuth,
  requireAdmin,
  requireRoles,
} from "../middleware/authMiddleware";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "../middleware/validationMiddleware";
import {
  profileUpdateSchema,
  passwordChangeSchema,
  userUpdateSchema,
  userIdSchema,
  paginationSchema,
  searchSchema,
} from "../schemas/authSchemas";

/**
 * Create user management routes
 * @param pool - Database connection pool
 * @returns Express router with user management routes
 */
export function createUserRoutes(pool: Pool): Router {
  const router = Router();
  const userController = new UserController(pool);

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
    validateBody(profileUpdateSchema),
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
    validateBody(passwordChangeSchema),
    userController.changePassword
  );

  // Admin routes (admin only)

  /**
   * @route   GET /api/users
   * @desc    Get all users (with pagination)
   * @access  Admin
   */
  router.get(
    "/",
    requireAdmin,
    validateQuery(paginationSchema),
    userController.getUsers
  );

  /**
   * @route   GET /api/users/search
   * @desc    Search users by email or name
   * @access  Admin
   */
  router.get(
    "/search",
    requireAdmin,
    validateQuery(searchSchema),
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
    validateParams(userIdSchema),
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
    validateParams(userIdSchema),
    validateBody(userUpdateSchema),
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
    validateParams(userIdSchema),
    userController.deleteUser
  );

  return router;
}
