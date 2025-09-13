import { Pool, PoolClient } from "pg";
import { PasswordService } from "./passwordService";

/**
 * User interface
 */
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  isActive: boolean;
  isVerified: boolean;
  role: "admin" | "user" | "viewer";
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}

/**
 * User creation data interface
 */
export interface CreateUserData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: "admin" | "user" | "viewer";
}

/**
 * User update data interface
 */
export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  isActive?: boolean;
  isVerified?: boolean;
  role?: "admin" | "user" | "viewer";
}

/**
 * User statistics interface
 */
export interface UserStats {
  documentCount: number;
  chatMessageCount: number;
  totalFileSize: number;
  lastActivity?: Date;
}

/**
 * UserService - Handles user CRUD operations and database interactions
 *
 * Features:
 * - User creation, reading, updating, deletion
 * - User authentication and validation
 * - User statistics and activity tracking
 * - Role-based access control
 * - User search and filtering
 */
export class UserService {
  /**
   * Create a new user
   * @param userData - User creation data
   * @param pool - Database connection pool
   * @returns Promise<User> - Created user (without password)
   */
  public static async createUser(
    userData: CreateUserData,
    pool: Pool
  ): Promise<User> {
    const client = await pool.connect();
    try {
      // Validate password strength
      const passwordValidation = PasswordService.validatePasswordStrength(
        userData.password
      );
      if (!passwordValidation.isValid) {
        throw new Error(
          `Password validation failed: ${passwordValidation.errors.join(", ")}`
        );
      }

      // Hash password
      const passwordHash = await PasswordService.hashPassword(
        userData.password
      );

      // Check if user already exists
      const existingUser = await client.query(
        "SELECT id FROM users WHERE email = $1",
        [userData.email.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        throw new Error("User with this email already exists");
      }

      // Create user
      const result = await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, is_verified, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, email, first_name, last_name, avatar_url, is_active, is_verified, role, created_at, updated_at, last_login`,
        [
          userData.email.toLowerCase(),
          passwordHash,
          userData.firstName || null,
          userData.lastName || null,
          userData.role || "user",
          false, // Not verified by default
          true, // Active by default
        ]
      );

      return this.mapRowToUser(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Get user by ID
   * @param userId - User ID
   * @param pool - Database connection pool
   * @returns Promise<User | null>
   */
  public static async getUserById(
    userId: string,
    pool: Pool
  ): Promise<User | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, email, first_name, last_name, avatar_url, is_active, is_verified, role, created_at, updated_at, last_login
         FROM users WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToUser(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Get user by email
   * @param email - User email
   * @param pool - Database connection pool
   * @returns Promise<User | null>
   */
  public static async getUserByEmail(
    email: string,
    pool: Pool
  ): Promise<User | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, email, first_name, last_name, avatar_url, is_active, is_verified, role, created_at, updated_at, last_login
         FROM users WHERE email = $1`,
        [email.toLowerCase()]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToUser(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Get user with password hash for authentication
   * @param email - User email
   * @param pool - Database connection pool
   * @returns Promise<{user: User, passwordHash: string} | null>
   */
  public static async getUserWithPassword(
    email: string,
    pool: Pool
  ): Promise<{ user: User; passwordHash: string } | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, email, first_name, last_name, avatar_url, is_active, is_verified, role, created_at, updated_at, last_login, password_hash
         FROM users WHERE email = $1`,
        [email.toLowerCase()]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        user: this.mapRowToUser(row),
        passwordHash: row.password_hash,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Update user information
   * @param userId - User ID
   * @param updateData - Update data
   * @param pool - Database connection pool
   * @returns Promise<User | null>
   */
  public static async updateUser(
    userId: string,
    updateData: UpdateUserData,
    pool: Pool
  ): Promise<User | null> {
    const client = await pool.connect();
    try {
      // Build dynamic query
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (updateData.firstName !== undefined) {
        fields.push(`first_name = $${paramCount++}`);
        values.push(updateData.firstName || null);
      }
      if (updateData.lastName !== undefined) {
        fields.push(`last_name = $${paramCount++}`);
        values.push(updateData.lastName || null);
      }
      if (updateData.avatarUrl !== undefined) {
        fields.push(`avatar_url = $${paramCount++}`);
        values.push(updateData.avatarUrl || null);
      }
      if (updateData.isActive !== undefined) {
        fields.push(`is_active = $${paramCount++}`);
        values.push(updateData.isActive);
      }
      if (updateData.isVerified !== undefined) {
        fields.push(`is_verified = $${paramCount++}`);
        values.push(updateData.isVerified);
      }
      if (updateData.role !== undefined) {
        fields.push(`role = $${paramCount++}`);
        values.push(updateData.role);
      }

      if (fields.length === 0) {
        // No fields to update, return current user
        return await this.getUserById(userId, pool);
      }

      // Add updated_at
      fields.push(`updated_at = CURRENT_TIMESTAMP`);

      values.push(userId);

      const query = `
        UPDATE users 
        SET ${fields.join(", ")}
        WHERE id = $${paramCount}
        RETURNING id, email, first_name, last_name, avatar_url, is_active, is_verified, role, created_at, updated_at, last_login
      `;

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToUser(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Update user password
   * @param userId - User ID
   * @param newPassword - New password
   * @param pool - Database connection pool
   * @returns Promise<boolean>
   */
  public static async updateUserPassword(
    userId: string,
    newPassword: string,
    pool: Pool
  ): Promise<boolean> {
    const client = await pool.connect();
    try {
      // Validate password strength
      const passwordValidation =
        PasswordService.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        throw new Error(
          `Password validation failed: ${passwordValidation.errors.join(", ")}`
        );
      }

      // Hash new password
      const passwordHash = await PasswordService.hashPassword(newPassword);

      // Update password
      const result = await client.query(
        "UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [passwordHash, userId]
      );

      return (result.rowCount || 0) > 0;
    } finally {
      client.release();
    }
  }

  /**
   * Delete user (soft delete by setting is_active to false)
   * @param userId - User ID
   * @param pool - Database connection pool
   * @returns Promise<boolean>
   */
  public static async deleteUser(userId: string, pool: Pool): Promise<boolean> {
    const client = await pool.connect();
    try {
      // Soft delete by setting is_active to false
      const result = await client.query(
        "UPDATE users SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [userId]
      );

      return (result.rowCount || 0) > 0;
    } finally {
      client.release();
    }
  }

  /**
   * Get user statistics
   * @param userId - User ID
   * @param pool - Database connection pool
   * @returns Promise<UserStats>
   */
  public static async getUserStats(
    userId: string,
    pool: Pool
  ): Promise<UserStats> {
    const client = await pool.connect();
    try {
      const result = await client.query("SELECT * FROM get_user_stats($1)", [
        userId,
      ]);

      if (result.rows.length === 0) {
        return {
          documentCount: 0,
          chatMessageCount: 0,
          totalFileSize: 0,
          lastActivity: undefined,
        };
      }

      const stats = result.rows[0];
      return {
        documentCount: parseInt(stats.document_count) || 0,
        chatMessageCount: parseInt(stats.chat_message_count) || 0,
        totalFileSize: parseInt(stats.total_file_size) || 0,
        lastActivity: stats.last_activity
          ? new Date(stats.last_activity)
          : undefined,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get all users with pagination
   * @param page - Page number (1-based)
   * @param limit - Number of users per page
   * @param pool - Database connection pool
   * @returns Promise<{users: User[], total: number, page: number, limit: number}>
   */
  public static async getUsers(
    page: number = 1,
    limit: number = 20,
    pool: Pool
  ): Promise<{ users: User[]; total: number; page: number; limit: number }> {
    const client = await pool.connect();
    try {
      const offset = (page - 1) * limit;

      // Get total count
      const countResult = await client.query(
        "SELECT COUNT(*) as total FROM users WHERE is_active = TRUE"
      );
      const total = parseInt(countResult.rows[0].total);

      // Get users
      const result = await client.query(
        `SELECT id, email, first_name, last_name, avatar_url, is_active, is_verified, role, created_at, updated_at, last_login
         FROM users 
         WHERE is_active = TRUE
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      const users = result.rows.map((row) => this.mapRowToUser(row));

      return {
        users,
        total,
        page,
        limit,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Search users by email or name
   * @param searchTerm - Search term
   * @param pool - Database connection pool
   * @returns Promise<User[]>
   */
  public static async searchUsers(
    searchTerm: string,
    pool: Pool
  ): Promise<User[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, email, first_name, last_name, avatar_url, is_active, is_verified, role, created_at, updated_at, last_login
         FROM users 
         WHERE is_active = TRUE 
         AND (
           email ILIKE $1 
           OR first_name ILIKE $1 
           OR last_name ILIKE $1
           OR CONCAT(first_name, ' ', last_name) ILIKE $1
         )
         ORDER BY email ASC
         LIMIT 50`,
        [`%${searchTerm}%`]
      );

      return result.rows.map((row) => this.mapRowToUser(row));
    } finally {
      client.release();
    }
  }

  /**
   * Verify user email
   * @param userId - User ID
   * @param pool - Database connection pool
   * @returns Promise<boolean>
   */
  public static async verifyUser(userId: string, pool: Pool): Promise<boolean> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        "UPDATE users SET is_verified = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [userId]
      );

      return (result.rowCount || 0) > 0;
    } finally {
      client.release();
    }
  }

  /**
   * Map database row to User object
   * @param row - Database row
   * @returns User object
   */
  private static mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      avatarUrl: row.avatar_url,
      isActive: row.is_active,
      isVerified: row.is_verified,
      role: row.role,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastLogin: row.last_login ? new Date(row.last_login) : undefined,
    };
  }
}
