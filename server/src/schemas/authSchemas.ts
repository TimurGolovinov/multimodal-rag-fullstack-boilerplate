import { z } from "zod";

/**
 * Authentication validation schemas using Zod
 */

// Common validation patterns
const emailSchema = z
  .string()
  .email("Please provide a valid email address")
  .toLowerCase()
  .trim();

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    "Password must contain at least one lowercase letter, one uppercase letter, and one number"
  );

const nameSchema = z
  .string()
  .min(1, "Name cannot be empty")
  .max(100, "Name must be less than 100 characters")
  .trim();

const urlSchema = z.string().url("Must be a valid URL").optional();

// Register schema
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
});

// Login schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

// Refresh token schema
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

// Profile update schema
export const profileUpdateSchema = z.object({
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  avatarUrl: urlSchema,
});

// Password change schema
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

// User update schema (admin)
export const userUpdateSchema = z.object({
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  avatarUrl: urlSchema,
  role: z.enum(["admin", "user", "viewer"]).optional(),
  isActive: z.boolean().optional(),
  isVerified: z.boolean().optional(),
});

// User ID parameter schema
export const userIdSchema = z.object({
  id: z.string().uuid("User ID must be a valid UUID"),
});

// Pagination schema
export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1, "Page must be a positive integer")),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .pipe(z.number().int().min(1).max(100, "Limit must be between 1 and 100")),
});

// Search schema
export const searchSchema = z.object({
  q: z
    .string()
    .min(1, "Search query cannot be empty")
    .max(100, "Search query must be less than 100 characters")
    .trim(),
});

// Type exports for use in controllers
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type UserIdParams = z.infer<typeof userIdSchema>;
export type PaginationQuery = z.infer<typeof paginationSchema>;
export type SearchQuery = z.infer<typeof searchSchema>;
