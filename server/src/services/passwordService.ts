import * as bcrypt from "bcryptjs";

/**
 * PasswordService - Handles secure password hashing and validation
 *
 * Features:
 * - bcrypt hashing with configurable salt rounds
 * - Password strength validation
 * - Secure comparison to prevent timing attacks
 * - Password policy enforcement
 */
export class PasswordService {
  private static readonly SALT_ROUNDS = 12;
  private static readonly MIN_PASSWORD_LENGTH = 8;
  private static readonly MAX_PASSWORD_LENGTH = 128;

  /**
   * Hash a password using bcrypt
   * @param password - Plain text password
   * @returns Promise<string> - Hashed password
   */
  public static async hashPassword(password: string): Promise<string> {
    try {
      const saltRounds = parseInt(
        process.env.BCRYPT_SALT_ROUNDS || this.SALT_ROUNDS.toString()
      );
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      console.error("Error hashing password:", error);
      throw new Error("Failed to hash password");
    }
  }

  /**
   * Compare a plain text password with a hashed password
   * @param password - Plain text password
   * @param hashedPassword - Hashed password from database
   * @returns Promise<boolean> - True if passwords match
   */
  public static async comparePassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      console.error("Error comparing password:", error);
      throw new Error("Failed to compare password");
    }
  }

  /**
   * Validate password strength
   * @param password - Password to validate
   * @returns Object with validation result and errors
   */
  public static validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
    score: number; // 0-4 (0=very weak, 4=very strong)
  } {
    const errors: string[] = [];
    let score = 0;

    // Length validation
    if (password.length < this.MIN_PASSWORD_LENGTH) {
      errors.push(
        `Password must be at least ${this.MIN_PASSWORD_LENGTH} characters long`
      );
    } else if (password.length >= this.MIN_PASSWORD_LENGTH) {
      score += 1;
    }

    if (password.length > this.MAX_PASSWORD_LENGTH) {
      errors.push(
        `Password must be no more than ${this.MAX_PASSWORD_LENGTH} characters long`
      );
    }

    // Character type validation
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
      password
    );

    if (hasLowercase) score += 1;
    if (hasUppercase) score += 1;
    if (hasNumbers) score += 1;
    if (hasSpecialChars) score += 1;

    // Common password patterns
    const commonPatterns = [
      /password/i,
      /123456/,
      /qwerty/i,
      /admin/i,
      /letmein/i,
      /welcome/i,
      /monkey/i,
      /dragon/i,
      /master/i,
      /hello/i,
    ];

    const hasCommonPattern = commonPatterns.some((pattern) =>
      pattern.test(password)
    );
    if (hasCommonPattern) {
      errors.push("Password contains common patterns and is not secure");
      score = Math.max(0, score - 1);
    }

    // Sequential characters
    const hasSequential = /(.)\1{2,}/.test(password);
    if (hasSequential) {
      errors.push("Password contains repeated characters");
      score = Math.max(0, score - 1);
    }

    // Keyboard patterns
    const keyboardPatterns = [/qwerty/i, /asdf/i, /zxcv/i, /1234/, /abcd/i];

    const hasKeyboardPattern = keyboardPatterns.some((pattern) =>
      pattern.test(password)
    );
    if (hasKeyboardPattern) {
      errors.push("Password contains keyboard patterns");
      score = Math.max(0, score - 1);
    }

    const isValid = errors.length === 0 && score >= 2;

    return {
      isValid,
      errors,
      score: Math.max(0, Math.min(4, score)),
    };
  }

  /**
   * Generate a secure random password
   * @param length - Password length (default: 16)
   * @param includeSpecialChars - Include special characters (default: true)
   * @returns Generated password
   */
  public static generateSecurePassword(
    length: number = 16,
    includeSpecialChars: boolean = true
  ): string {
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    const specialChars = "!@#$%^&*()_+-=[]{}|;:,.<>?";

    let charset = lowercase + uppercase + numbers;
    if (includeSpecialChars) {
      charset += specialChars;
    }

    let password = "";

    // Ensure at least one character from each required type
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];

    if (includeSpecialChars) {
      password += specialChars[Math.floor(Math.random() * specialChars.length)];
    }

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }

    // Shuffle the password
    return password
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
  }

  /**
   * Get password strength description
   * @param score - Password strength score (0-4)
   * @returns Human-readable strength description
   */
  public static getPasswordStrengthDescription(score: number): string {
    switch (score) {
      case 0:
      case 1:
        return "Very Weak";
      case 2:
        return "Weak";
      case 3:
        return "Good";
      case 4:
        return "Very Strong";
      default:
        return "Unknown";
    }
  }

  /**
   * Check if password meets minimum requirements for registration
   * @param password - Password to check
   * @returns True if password meets minimum requirements
   */
  public static meetsMinimumRequirements(password: string): boolean {
    const validation = this.validatePasswordStrength(password);
    return validation.isValid && validation.score >= 2;
  }
}
