import DOMPurify from "isomorphic-dompurify";
import validator from "validator";

/**
 * Input sanitization service for security
 * Prevents XSS, injection attacks, and validates user inputs
 */
export class InputSanitizationService {
  // Maximum lengths for different input types
  private static readonly MAX_LENGTHS = {
    email: 255,
    password: 128,
    firstName: 100,
    lastName: 100,
    message: 10000,
    filename: 255,
    url: 500,
    general: 1000,
  };

  // Allowed characters for different input types
  private static readonly ALLOWED_PATTERNS = {
    email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    alphanumeric: /^[a-zA-Z0-9]+$/,
    alphanumericWithSpaces: /^[a-zA-Z0-9\s]+$/,
    alphanumericWithHyphens: /^[a-zA-Z0-9\-_]+$/,
    filename: /^[a-zA-Z0-9\-_\.\s]+$/,
    url: /^https?:\/\/.+/,
  };

  /**
   * Sanitize and validate email address
   * @param email - Email to sanitize
   * @returns Sanitized email or null if invalid
   */
  public static sanitizeEmail(email: string): string | null {
    if (!email || typeof email !== "string") {
      return null;
    }

    // Trim and normalize
    const trimmed = email.trim().toLowerCase();

    // Check length
    if (trimmed.length > this.MAX_LENGTHS.email) {
      return null;
    }

    // Validate email format
    if (!validator.isEmail(trimmed)) {
      return null;
    }

    // Additional regex check
    if (!this.ALLOWED_PATTERNS.email.test(trimmed)) {
      return null;
    }

    return trimmed;
  }

  /**
   * Sanitize and validate password
   * @param password - Password to sanitize
   * @returns Sanitized password or null if invalid
   */
  public static sanitizePassword(password: string): string | null {
    if (!password || typeof password !== "string") {
      return null;
    }

    // Check length
    if (password.length < 8 || password.length > this.MAX_LENGTHS.password) {
      return null;
    }

    // Check for null bytes and other dangerous characters
    if (password.includes("\0") || password.includes("\x00")) {
      return null;
    }

    return password;
  }

  /**
   * Sanitize and validate name fields
   * @param name - Name to sanitize
   * @param fieldName - Field name for error context
   * @returns Sanitized name or null if invalid
   */
  public static sanitizeName(
    name: string,
    fieldName: string = "name"
  ): string | null {
    if (!name || typeof name !== "string") {
      return null;
    }

    // Trim whitespace
    const trimmed = name.trim();

    // Check length
    const maxLength =
      fieldName === "firstName" || fieldName === "lastName"
        ? this.MAX_LENGTHS[fieldName as keyof typeof this.MAX_LENGTHS]
        : this.MAX_LENGTHS.general;

    if (trimmed.length > maxLength) {
      return null;
    }

    // Check for empty string after trim
    if (trimmed.length === 0) {
      return null;
    }

    // Allow letters, spaces, hyphens, and apostrophes for names
    if (!/^[a-zA-Z\s\-']+$/.test(trimmed)) {
      return null;
    }

    // Remove excessive whitespace
    const normalized = trimmed.replace(/\s+/g, " ");

    return normalized;
  }

  /**
   * Sanitize and validate text message
   * @param message - Message to sanitize
   * @returns Sanitized message or null if invalid
   */
  public static sanitizeMessage(message: string): string | null {
    if (!message || typeof message !== "string") {
      return null;
    }

    // Check length
    if (message.length > this.MAX_LENGTHS.message) {
      return null;
    }

    // Trim whitespace
    const trimmed = message.trim();

    // Check for empty message
    if (trimmed.length === 0) {
      return null;
    }

    // Sanitize HTML content to prevent XSS
    const sanitized = DOMPurify.sanitize(trimmed, {
      ALLOWED_TAGS: [], // No HTML tags allowed
      ALLOWED_ATTR: [], // No attributes allowed
      KEEP_CONTENT: true, // Keep text content
    });

    return sanitized;
  }

  /**
   * Sanitize and validate filename
   * @param filename - Filename to sanitize
   * @returns Sanitized filename or null if invalid
   */
  public static sanitizeFilename(filename: string): string | null {
    if (!filename || typeof filename !== "string") {
      return null;
    }

    // Check length
    if (filename.length > this.MAX_LENGTHS.filename) {
      return null;
    }

    // Check for dangerous characters
    const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (dangerousChars.test(filename)) {
      return null;
    }

    // Check for reserved names (Windows)
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
    if (reservedNames.test(filename)) {
      return null;
    }

    // Check for hidden files (optional - remove if you want to allow them)
    if (filename.startsWith(".")) {
      return null;
    }

    // Normalize filename
    const normalized = filename.trim().replace(/\s+/g, " ");

    return normalized;
  }

  /**
   * Sanitize and validate URL
   * @param url - URL to sanitize
   * @returns Sanitized URL or null if invalid
   */
  public static sanitizeUrl(url: string): string | null {
    if (!url || typeof url !== "string") {
      return null;
    }

    // Check length
    if (url.length > this.MAX_LENGTHS.url) {
      return null;
    }

    // Trim whitespace
    const trimmed = url.trim();

    // Validate URL format
    if (!validator.isURL(trimmed, { protocols: ["http", "https"] })) {
      return null;
    }

    // Additional regex check
    if (!this.ALLOWED_PATTERNS.url.test(trimmed)) {
      return null;
    }

    return trimmed;
  }

  /**
   * Sanitize general text input
   * @param text - Text to sanitize
   * @param maxLength - Maximum length (optional)
   * @returns Sanitized text or null if invalid
   */
  public static sanitizeText(text: string, maxLength?: number): string | null {
    if (!text || typeof text !== "string") {
      return null;
    }

    const lengthLimit = maxLength || this.MAX_LENGTHS.general;

    // Check length
    if (text.length > lengthLimit) {
      return null;
    }

    // Trim whitespace
    const trimmed = text.trim();

    // Check for empty string
    if (trimmed.length === 0) {
      return null;
    }

    // Sanitize HTML content
    const sanitized = DOMPurify.sanitize(trimmed, {
      ALLOWED_TAGS: [], // No HTML tags allowed
      ALLOWED_ATTR: [], // No attributes allowed
      KEEP_CONTENT: true, // Keep text content
    });

    return sanitized;
  }

  /**
   * Sanitize numeric input
   * @param value - Value to sanitize
   * @param min - Minimum value (optional)
   * @param max - Maximum value (optional)
   * @returns Sanitized number or null if invalid
   */
  public static sanitizeNumber(
    value: string | number,
    min?: number,
    max?: number
  ): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    const num = typeof value === "string" ? parseFloat(value) : value;

    if (isNaN(num)) {
      return null;
    }

    if (min !== undefined && num < min) {
      return null;
    }

    if (max !== undefined && num > max) {
      return null;
    }

    return num;
  }

  /**
   * Sanitize UUID
   * @param uuid - UUID to sanitize
   * @returns Sanitized UUID or null if invalid
   */
  public static sanitizeUuid(uuid: string): string | null {
    if (!uuid || typeof uuid !== "string") {
      return null;
    }

    const trimmed = uuid.trim();

    if (!validator.isUUID(trimmed)) {
      return null;
    }

    return trimmed.toLowerCase();
  }

  /**
   * Sanitize search query
   * @param query - Search query to sanitize
   * @returns Sanitized query or null if invalid
   */
  public static sanitizeSearchQuery(query: string): string | null {
    if (!query || typeof query !== "string") {
      return null;
    }

    // Check length
    if (query.length > this.MAX_LENGTHS.general) {
      return null;
    }

    // Trim whitespace
    const trimmed = query.trim();

    // Check for empty query
    if (trimmed.length === 0) {
      return null;
    }

    // Remove potentially dangerous characters
    const sanitized = trimmed
      .replace(/[<>\"'&]/g, "") // Remove HTML/XML characters
      .replace(/[;|&$`]/g, "") // Remove shell injection characters
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();

    return sanitized.length > 0 ? sanitized : null;
  }

  /**
   * Validate and sanitize request body
   * @param body - Request body object
   * @param schema - Validation schema
   * @returns Sanitized body or null if invalid
   */
  public static sanitizeRequestBody<T extends Record<string, any>>(
    body: any,
    schema: Partial<Record<keyof T, (value: any) => any>>
  ): T | null {
    if (!body || typeof body !== "object") {
      return null;
    }

    const sanitized: any = {};

    for (const [key, sanitizer] of Object.entries(schema)) {
      if (key in body && sanitizer) {
        const result = sanitizer(body[key]);
        if (result !== null) {
          sanitized[key] = result;
        } else {
          return null; // Invalid input
        }
      }
    }

    return sanitized as T;
  }

  /**
   * Check if input contains potentially malicious content
   * @param input - Input to check
   * @returns True if potentially malicious
   */
  public static isPotentiallyMalicious(input: string): boolean {
    if (!input || typeof input !== "string") {
      return false;
    }

    const maliciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /<link/i,
      /<meta/i,
      /<style/i,
      /expression\s*\(/i,
      /url\s*\(/i,
      /@import/i,
      /eval\s*\(/i,
      /setTimeout\s*\(/i,
      /setInterval\s*\(/i,
      /Function\s*\(/i,
      /document\./i,
      /window\./i,
      /location\./i,
      /alert\s*\(/i,
      /confirm\s*\(/i,
      /prompt\s*\(/i,
    ];

    return maliciousPatterns.some((pattern) => pattern.test(input));
  }
}
