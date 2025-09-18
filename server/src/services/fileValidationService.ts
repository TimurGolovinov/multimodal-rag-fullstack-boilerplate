import { createHash } from "crypto";

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileType: string;
  mimeType: string;
  size: number;
  hash: string;
}

export interface FileValidationConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  maxFiles: number;
  scanForMalware: boolean;
}

export class FileValidationService {
  private static readonly DEFAULT_CONFIG: FileValidationConfig = {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      "audio/mpeg",
      "audio/wav",
      "audio/ogg",
      "audio/mp4",
      "audio/aac",
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
      "video/webm",
      "video/x-ms-wmv",
      "text/plain",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    allowedExtensions: [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".svg",
      ".mp3",
      ".wav",
      ".ogg",
      ".m4a",
      ".aac",
      ".mp4",
      ".mov",
      ".avi",
      ".webm",
      ".wmv",
      ".m4v",
      ".3gp",
      ".ogv",
      ".txt",
      ".pdf",
      ".doc",
      ".docx",
    ],
    maxFiles: 30,
    scanForMalware: false, // Set to true in production with proper antivirus integration
  };

  /**
   * Validate a single file
   */
  static async validateFile(
    file: Express.Multer.File,
    config: Partial<FileValidationConfig> = {}
  ): Promise<FileValidationResult> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic file checks
    if (!file) {
      errors.push("No file provided");
      return this.createResult(false, errors, warnings, "", "", 0, "");
    }

    if (!file.buffer || file.buffer.length === 0) {
      errors.push("File is empty");
      return this.createResult(false, errors, warnings, "", "", 0, "");
    }

    // Size validation
    if (file.size > finalConfig.maxFileSize) {
      errors.push(
        `File size (${this.formatBytes(
          file.size
        )}) exceeds maximum allowed size (${this.formatBytes(
          finalConfig.maxFileSize
        )})`
      );
    }

    // MIME type validation
    const mimeType = file.mimetype || "";
    if (!finalConfig.allowedMimeTypes.includes(mimeType)) {
      errors.push(`MIME type '${mimeType}' is not allowed`);
    }

    // File extension validation
    const extension = this.getFileExtension(file.originalname);
    if (!finalConfig.allowedExtensions.includes(extension.toLowerCase())) {
      errors.push(`File extension '${extension}' is not allowed`);
    }

    // File signature validation (magic number check)
    const signatureValidation = this.validateFileSignature(
      file.buffer,
      mimeType
    );
    if (!signatureValidation.isValid) {
      errors.push(
        `File signature validation failed: ${signatureValidation.error}`
      );
    }

    // Check for suspicious patterns
    const suspiciousPatterns = this.checkSuspiciousPatterns(
      file.buffer,
      file.originalname
    );
    if (suspiciousPatterns.length > 0) {
      warnings.push(...suspiciousPatterns);
    }

    // Generate file hash
    const hash = this.generateFileHash(file.buffer);

    // Check for duplicate content (if needed)
    if (this.isDuplicateContent(file.buffer)) {
      warnings.push(
        "File appears to be a duplicate of previously uploaded content"
      );
    }

    return this.createResult(
      errors.length === 0,
      errors,
      warnings,
      this.determineFileType(mimeType, extension),
      mimeType,
      file.size,
      hash
    );
  }

  /**
   * Validate multiple files
   */
  static async validateFiles(
    files: Express.Multer.File[],
    config: Partial<FileValidationConfig> = {}
  ): Promise<FileValidationResult[]> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };

    // Check total file count
    if (files.length > finalConfig.maxFiles) {
      throw new Error(
        `Too many files. Maximum allowed: ${finalConfig.maxFiles}`
      );
    }

    // Validate each file
    const results = await Promise.all(
      files.map((file) => this.validateFile(file, finalConfig))
    );

    // Check for duplicate files in the batch
    const hashes = results.map((r) => r.hash);
    const duplicateHashes = hashes.filter(
      (hash, index) => hashes.indexOf(hash) !== index
    );

    if (duplicateHashes.length > 0) {
      results.forEach((result) => {
        if (duplicateHashes.includes(result.hash)) {
          result.warnings.push("Duplicate file detected in upload batch");
        }
      });
    }

    return results;
  }

  /**
   * Validate file signature (magic number)
   */
  private static validateFileSignature(
    buffer: Buffer,
    mimeType: string
  ): { isValid: boolean; error?: string } {
    if (buffer.length < 4) {
      return { isValid: false, error: "File too small to validate signature" };
    }

    const header = buffer.subarray(0, 12);
    const hex = header.toString("hex").toLowerCase();

    // Common file signatures
    const signatures: Record<string, string[]> = {
      "image/jpeg": ["ffd8ff"],
      "image/png": ["89504e47"],
      "image/gif": ["47494638"],
      "image/webp": ["52494646"],
      "image/svg+xml": ["3c3f786d6c", "3c737667"],
      "audio/mpeg": ["fffb", "fff3", "fff2"],
      "audio/wav": ["52494646"],
      "audio/ogg": ["4f676753"],
      "video/mp4": ["00000018", "00000020", "0000001c"],
      "video/quicktime": ["00000014", "00000018", "00000020"],
      "video/webm": ["1a45dfa3"],
      "application/pdf": ["25504446"],
      "text/plain": [], // No specific signature for text files
    };

    const expectedSignatures = signatures[mimeType] || [];

    if (expectedSignatures.length === 0) {
      return { isValid: true }; // No signature to validate
    }

    const isValid = expectedSignatures.some((sig) => hex.startsWith(sig));

    if (!isValid) {
      return {
        isValid: false,
        error: `File signature does not match MIME type '${mimeType}'`,
      };
    }

    return { isValid: true };
  }

  /**
   * Check for suspicious patterns in file content
   */
  private static checkSuspiciousPatterns(
    buffer: Buffer,
    filename: string
  ): string[] {
    const warnings: string[] = [];
    const content = buffer.toString("utf8", 0, Math.min(buffer.length, 1024)); // Check first 1KB

    // Check for executable patterns
    if (content.includes("MZ") || content.includes("PE")) {
      warnings.push("File may contain executable content");
    }

    // Check for script patterns
    if (content.includes("<script") || content.includes("javascript:")) {
      warnings.push("File may contain script content");
    }

    // Check for suspicious file names
    const suspiciousNames = [".exe", ".bat", ".cmd", ".scr", ".pif", ".com"];
    if (suspiciousNames.some((ext) => filename.toLowerCase().includes(ext))) {
      warnings.push("Filename suggests executable content");
    }

    // Check for double extensions
    const parts = filename.split(".");
    if (parts.length > 2) {
      warnings.push("File has multiple extensions - potential security risk");
    }

    return warnings;
  }

  /**
   * Check if file content is duplicate
   */
  private static isDuplicateContent(buffer: Buffer): boolean {
    // This is a simplified check - in production, you'd check against a database
    // of previously uploaded file hashes
    return false;
  }

  /**
   * Generate file hash
   */
  private static generateFileHash(buffer: Buffer): string {
    return createHash("sha256").update(buffer).digest("hex");
  }

  /**
   * Get file extension from filename
   */
  private static getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf(".");
    return lastDot === -1 ? "" : filename.substring(lastDot);
  }

  /**
   * Determine file type from MIME type and extension
   */
  private static determineFileType(
    mimeType: string,
    extension: string
  ): string {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType === "application/pdf") return "pdf";
    if (
      mimeType.includes("word") ||
      extension === ".doc" ||
      extension === ".docx"
    )
      return "word";
    if (mimeType.startsWith("text/")) return "text";
    return "unknown";
  }

  /**
   * Format bytes to human readable string
   */
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * Create validation result object
   */
  private static createResult(
    isValid: boolean,
    errors: string[],
    warnings: string[],
    fileType: string,
    mimeType: string,
    size: number,
    hash: string
  ): FileValidationResult {
    return {
      isValid,
      errors,
      warnings,
      fileType,
      mimeType,
      size,
      hash,
    };
  }

  /**
   * Get validation configuration for video processing
   */
  static getVideoProcessingConfig(): FileValidationConfig {
    return {
      maxFileSize: 50 * 1024 * 1024, // 50MB per file
      allowedMimeTypes: [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "audio/wav",
        "audio/mpeg",
        "audio/ogg",
        "audio/mp4",
        "audio/aac",
      ],
      allowedExtensions: [
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".webp",
        ".wav",
        ".mp3",
        ".ogg",
        ".m4a",
        ".aac",
      ],
      maxFiles: 30,
      scanForMalware: false,
    };
  }

  /**
   * Get allowed MIME types
   */
  static getAllowedMimeTypes(): string[] {
    return [...this.DEFAULT_CONFIG.allowedMimeTypes];
  }

  /**
   * Get allowed file extensions
   */
  static getAllowedExtensions(): string[] {
    return [...this.DEFAULT_CONFIG.allowedExtensions];
  }

  /**
   * Check if MIME type is supported
   */
  static isMimeTypeSupported(mimeType: string): boolean {
    return this.DEFAULT_CONFIG.allowedMimeTypes.includes(mimeType);
  }

  /**
   * Check if file extension is allowed
   */
  static isExtensionAllowed(extension: string): boolean {
    return this.DEFAULT_CONFIG.allowedExtensions.includes(
      extension.toLowerCase()
    );
  }
}
