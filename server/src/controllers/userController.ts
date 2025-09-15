import { Request, Response } from "express";
import { Pool } from "pg";
import { UserService, UpdateUserData } from "../services/userService";
import { PasswordService } from "../services/passwordService";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

/**
 * UserController - Handles user management endpoints
 *
 * Features:
 * - User profile management
 * - Password changes
 * - User settings
 * - Admin user management
 * - User search and listing
 */
export class UserController {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get user profile
   * GET /api/users/profile
   */
  public getProfile = async (
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
      const stats = await UserService.getUserStats(req.user.userId, this.pool);

      res.json({
        success: true,
        data: {
          user: {
            id: req.user.userId,
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
      console.error("Get profile error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get profile",
        message: "An error occurred while retrieving user profile",
      });
    }
  };

  /**
   * Update user profile
   * PUT /api/users/profile
   */
  public updateProfile = async (
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

      const { firstName, lastName, avatarUrl } = req.body;

      // Prepare update data
      const updateData: UpdateUserData = {};
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

      // Update user
      const updatedUser = await UserService.updateUser(
        req.user.userId,
        updateData,
        this.pool
      );

      if (!updatedUser) {
        res.status(404).json({
          success: false,
          error: "User not found",
          message: "User profile not found",
        });
        return;
      }

      res.json({
        success: true,
        message: "Profile updated successfully",
        data: {
          user: {
            id: updatedUser.userId,
            email: updatedUser.email,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            avatarUrl: updatedUser.avatarUrl,
            role: updatedUser.role,
            isVerified: updatedUser.isVerified,
            isActive: updatedUser.isActive,
            createdAt: updatedUser.createdAt,
            updatedAt: updatedUser.updatedAt,
            lastLogin: updatedUser.lastLogin,
          },
        },
      });
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update profile",
        message: "An error occurred while updating user profile",
      });
    }
  };

  /**
   * Change user password
   * PUT /api/users/password
   */
  public changePassword = async (
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

      const { currentPassword, newPassword } = req.body;

      // Get user with current password hash
      const userWithPassword = await UserService.getUserWithPassword(
        req.user.email,
        this.pool
      );

      if (!userWithPassword) {
        res.status(404).json({
          success: false,
          error: "User not found",
          message: "User not found",
        });
        return;
      }

      // Verify current password
      const isCurrentPasswordValid = await PasswordService.comparePassword(
        currentPassword,
        userWithPassword.passwordHash
      );

      if (!isCurrentPasswordValid) {
        res.status(400).json({
          success: false,
          error: "Invalid current password",
          message: "Current password is incorrect",
        });
        return;
      }

      // Validate new password strength
      const passwordValidation =
        PasswordService.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        res.status(400).json({
          success: false,
          error: "Password validation failed",
          message: passwordValidation.errors.join(", "),
        });
        return;
      }

      // Update password
      const passwordUpdated = await UserService.updateUserPassword(
        req.user.userId,
        newPassword,
        this.pool
      );

      if (!passwordUpdated) {
        res.status(500).json({
          success: false,
          error: "Password update failed",
          message: "Failed to update password",
        });
        return;
      }

      res.json({
        success: true,
        message: "Password updated successfully",
      });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to change password",
        message: "An error occurred while changing password",
      });
    }
  };

  /**
   * Get all users (admin only)
   * GET /api/users
   */
  public getUsers = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!req.user || req.user.role !== "admin") {
        res.status(403).json({
          success: false,
          error: "Admin access required",
          message: "This endpoint requires administrator privileges",
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await UserService.getUsers(page, limit, this.pool);

      res.json({
        success: true,
        data: {
          users: result.users.map((user) => ({
            id: user.userId,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            avatarUrl: user.avatarUrl,
            role: user.role,
            isVerified: user.isVerified,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            lastLogin: user.lastLogin,
          })),
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: Math.ceil(result.total / result.limit),
          },
        },
      });
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get users",
        message: "An error occurred while retrieving users",
      });
    }
  };

  /**
   * Get user by ID (admin only)
   * GET /api/users/:id
   */
  public getUserById = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!req.user || req.user.role !== "admin") {
        res.status(403).json({
          success: false,
          error: "Admin access required",
          message: "This endpoint requires administrator privileges",
        });
        return;
      }

      const { id } = req.params;

      const user = await UserService.getUserById(id, this.pool);

      if (!user) {
        res.status(404).json({
          success: false,
          error: "User not found",
          message: "User not found",
        });
        return;
      }

      // Get user stats
      const stats = await UserService.getUserStats(user.userId, this.pool);

      res.json({
        success: true,
        data: {
          user: {
            id: user.userId,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            avatarUrl: user.avatarUrl,
            role: user.role,
            isVerified: user.isVerified,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            lastLogin: user.lastLogin,
          },
          stats,
        },
      });
    } catch (error) {
      console.error("Get user by ID error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get user",
        message: "An error occurred while retrieving user information",
      });
    }
  };

  /**
   * Update user (admin only)
   * PUT /api/users/:id
   */
  public updateUser = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!req.user || req.user.role !== "admin") {
        res.status(403).json({
          success: false,
          error: "Admin access required",
          message: "This endpoint requires administrator privileges",
        });
        return;
      }

      const { id } = req.params;
      const { firstName, lastName, avatarUrl, role, isActive, isVerified } =
        req.body;

      // Prepare update data
      const updateData: UpdateUserData = {};
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
      if (role !== undefined) updateData.role = role;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (isVerified !== undefined) updateData.isVerified = isVerified;

      // Update user
      const updatedUser = await UserService.updateUser(
        id,
        updateData,
        this.pool
      );

      if (!updatedUser) {
        res.status(404).json({
          success: false,
          error: "User not found",
          message: "User not found",
        });
        return;
      }

      res.json({
        success: true,
        message: "User updated successfully",
        data: {
          user: {
            id: updatedUser.userId,
            email: updatedUser.email,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            avatarUrl: updatedUser.avatarUrl,
            role: updatedUser.role,
            isVerified: updatedUser.isVerified,
            isActive: updatedUser.isActive,
            createdAt: updatedUser.createdAt,
            updatedAt: updatedUser.updatedAt,
            lastLogin: updatedUser.lastLogin,
          },
        },
      });
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update user",
        message: "An error occurred while updating user",
      });
    }
  };

  /**
   * Delete user (admin only)
   * DELETE /api/users/:id
   */
  public deleteUser = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!req.user || req.user.role !== "admin") {
        res.status(403).json({
          success: false,
          error: "Admin access required",
          message: "This endpoint requires administrator privileges",
        });
        return;
      }

      const { id } = req.params;

      // Prevent admin from deleting themselves
      if (id === req.user.userId) {
        res.status(400).json({
          success: false,
          error: "Cannot delete self",
          message: "You cannot delete your own account",
        });
        return;
      }

      const deleted = await UserService.deleteUser(id, this.pool);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: "User not found",
          message: "User not found",
        });
        return;
      }

      res.json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete user",
        message: "An error occurred while deleting user",
      });
    }
  };

  /**
   * Search users (admin only)
   * GET /api/users/search
   */
  public searchUsers = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!req.user || req.user.role !== "admin") {
        res.status(403).json({
          success: false,
          error: "Admin access required",
          message: "This endpoint requires administrator privileges",
        });
        return;
      }

      const { q } = req.query;

      if (!q || typeof q !== "string") {
        res.status(400).json({
          success: false,
          error: "Search query required",
          message: "Please provide a search query",
        });
        return;
      }

      const users = await UserService.searchUsers(q, this.pool);

      res.json({
        success: true,
        data: {
          users: users.map((user) => ({
            id: user.userId,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            avatarUrl: user.avatarUrl,
            role: user.role,
            isVerified: user.isVerified,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            lastLogin: user.lastLogin,
          })),
        },
      });
    } catch (error) {
      console.error("Search users error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to search users",
        message: "An error occurred while searching users",
      });
    }
  };
}
