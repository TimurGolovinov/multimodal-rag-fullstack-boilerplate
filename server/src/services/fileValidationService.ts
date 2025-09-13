import { Express } from "express";

/**
 * File validation service with magic number checking
 * Prevents malicious file uploads by validating file headers
 */
export class FileValidationService {
  // Magic number signatures for different file types
  private static readonly MAGIC_NUMBERS: Record<string, number[][]> = {
    // Images
    "image/jpeg": [[0xff, 0xd8, 0xff]],
    "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    "image/gif": [
      [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
    ], // GIF87a and GIF89a
    "image/webp": [
      [0x52, 0x49, 0x46, 0x46],
      [0x57, 0x45, 0x42, 0x50],
    ], // RIFF....WEBP
    "image/svg+xml": [[0x3c, 0x3f, 0x78, 0x6d, 0x6c]], // <?xml
    "image/bmp": [[0x42, 0x4d]], // BM
    "image/tiff": [
      [0x49, 0x49, 0x2a, 0x00],
      [0x4d, 0x4d, 0x00, 0x2a],
    ], // II* or MM*

    // Documents
    "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
    "application/msword": [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]], // OLE2
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
      [0x50, 0x4b, 0x03, 0x04],
    ], // ZIP (DOCX is ZIP)
    "application/vnd.ms-excel": [
      [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
    ], // OLE2
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
      [0x50, 0x4b, 0x03, 0x04],
    ], // ZIP (XLSX is ZIP)
    "application/vnd.ms-powerpoint": [
      [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
    ], // OLE2
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      [[0x50, 0x4b, 0x03, 0x04]], // ZIP (PPTX is ZIP)

    // Text files
    "text/plain": [
      [0xef, 0xbb, 0xbf], // UTF-8 BOM
      [0xff, 0xfe], // UTF-16 LE BOM
      [0xfe, 0xff], // UTF-16 BE BOM
    ],
    "text/csv": [
      [0xef, 0xbb, 0xbf], // UTF-8 BOM
      [0xff, 0xfe], // UTF-16 LE BOM
      [0xfe, 0xff], // UTF-16 BE BOM
    ],
    "text/html": [[0x3c, 0x21, 0x44, 0x4f, 0x43, 0x54, 0x59, 0x50, 0x45]], // <!DOCTYPE

    // Audio files
    "audio/mpeg": [
      [0xff, 0xfb],
      [0xff, 0xf3],
      [0xff, 0xf2],
    ], // MP3
    "audio/wav": [
      [0x52, 0x49, 0x46, 0x46],
      [0x57, 0x41, 0x56, 0x45],
    ], // RIFF....WAVE
    "audio/ogg": [[0x4f, 0x67, 0x67, 0x53]], // OggS
    "audio/flac": [[0x66, 0x4c, 0x61, 0x43]], // fLaC
    "audio/aac": [
      [0xff, 0xf1],
      [0xff, 0xf9],
    ], // AAC
    "audio/mp4": [[0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]], // MP4

    // Video files
    "video/mp4": [[0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]], // MP4
    "video/quicktime": [[0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]], // MOV
    "video/x-msvideo": [
      [0x52, 0x49, 0x46, 0x46],
      [0x41, 0x56, 0x49, 0x20],
    ], // RIFF....AVI
    "video/webm": [[0x1a, 0x45, 0xdf, 0xa3]], // WebM
    "video/x-matroska": [[0x1a, 0x45, 0xdf, 0xa3]], // Matroska
    "video/x-flv": [[0x46, 0x4c, 0x56, 0x01]], // FLV
    "video/x-ms-wmv": [[0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11]], // WMV
    "video/3gpp": [[0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]], // 3GP
    "video/ogg": [[0x4f, 0x67, 0x67, 0x53]], // OggS

    // Archives
    "application/zip": [
      [0x50, 0x4b, 0x03, 0x04],
      [0x50, 0x4b, 0x05, 0x06],
      [0x50, 0x4b, 0x07, 0x08],
    ], // ZIP
    "application/x-rar-compressed": [
      [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00],
    ], // RAR
    "application/x-7z-compressed": [[0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]], // 7Z
  };

  // Allowed file extensions as backup validation
  private static readonly ALLOWED_EXTENSIONS = new Set([
    // Images
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".svg",
    ".bmp",
    ".tiff",
    // Documents
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".txt",
    ".csv",
    ".html",
    // Audio
    ".mp3",
    ".wav",
    ".ogg",
    ".flac",
    ".aac",
    ".m4a",
    ".wma",
    ".opus",
    // Video
    ".mp4",
    ".mov",
    ".avi",
    ".webm",
    ".mkv",
    ".flv",
    ".wmv",
    ".m4v",
    ".3gp",
    ".ogv",
    // Archives
    ".zip",
    ".rar",
    ".7z",
  ]);

  /**
   * Validate file by checking magic numbers and MIME type
   * @param file - Multer file object
   * @param allowedMimeTypes - Optional array of allowed MIME types (if not provided, uses all supported types)
   * @returns Validation result
   */
  public static validateFile(
    file: Express.Multer.File,
    allowedMimeTypes?: string[]
  ): {
    isValid: boolean;
    error?: string;
    detectedMimeType?: string;
  } {
    try {
      // Check if file exists
      if (!file || !file.buffer) {
        return {
          isValid: false,
          error: "No file provided or file buffer is empty",
        };
      }

      // Check file size
      const maxSize = parseInt(process.env.MAX_FILE_SIZE || "52428800"); // 50MB default
      if (file.size > maxSize) {
        return {
          isValid: false,
          error: `File size ${file.size} exceeds maximum allowed size ${maxSize}`,
        };
      }

      // Get file extension
      const fileExtension = this.getFileExtension(file.originalname);
      if (!fileExtension) {
        return {
          isValid: false,
          error: "File must have a valid extension",
        };
      }

      // Check if extension is allowed
      if (!this.ALLOWED_EXTENSIONS.has(fileExtension.toLowerCase())) {
        return {
          isValid: false,
          error: `File extension ${fileExtension} is not allowed`,
        };
      }

      // Check if MIME type is allowed
      if (allowedMimeTypes && !allowedMimeTypes.includes(file.mimetype)) {
        return {
          isValid: false,
          error: `MIME type ${file.mimetype} is not allowed`,
        };
      }

      // Validate magic numbers
      const magicValidation = this.validateMagicNumbers(
        file.buffer,
        file.mimetype,
        allowedMimeTypes
      );
      if (!magicValidation.isValid) {
        return {
          isValid: false,
          error: magicValidation.error || "File type validation failed",
        };
      }

      // If MIME type was corrected, return the detected type
      if (
        magicValidation.detectedMimeType &&
        magicValidation.detectedMimeType !== file.mimetype
      ) {
        console.warn(
          `MIME type mismatch for ${file.originalname}: declared ${file.mimetype}, detected ${magicValidation.detectedMimeType}`
        );
      }

      return {
        isValid: true,
        detectedMimeType: magicValidation.detectedMimeType || file.mimetype,
      };
    } catch (error) {
      console.error("File validation error:", error);
      return {
        isValid: false,
        error: "File validation failed due to internal error",
      };
    }
  }

  /**
   * Validate file magic numbers against declared MIME type
   * @param buffer - File buffer
   * @param mimeType - Declared MIME type
   * @param allowedMimeTypes - Optional array of allowed MIME types
   * @returns Validation result
   */
  private static validateMagicNumbers(
    buffer: Buffer,
    mimeType: string,
    allowedMimeTypes?: string[]
  ): {
    isValid: boolean;
    error?: string;
    detectedMimeType?: string;
  } {
    // Get expected magic numbers for the MIME type
    const expectedMagicNumbers = this.MAGIC_NUMBERS[mimeType];

    if (!expectedMagicNumbers) {
      // For unknown MIME types, try to detect by magic numbers
      const detectedType = this.detectMimeTypeByMagicNumbers(buffer);
      if (detectedType) {
        // Check if the detected type is allowed
        if (allowedMimeTypes && !allowedMimeTypes.includes(detectedType)) {
          return {
            isValid: false,
            error: `Detected file type ${detectedType} is not allowed`,
            detectedMimeType: detectedType,
          };
        }
        return {
          isValid: true,
          detectedMimeType: detectedType,
        };
      }

      return {
        isValid: false,
        error: `Unsupported file type: ${mimeType}`,
      };
    }

    // Check if any of the expected magic number patterns match
    for (const magicPattern of expectedMagicNumbers) {
      if (this.checkMagicNumber(buffer, magicPattern)) {
        return { isValid: true };
      }
    }

    // Try to detect the actual MIME type
    const detectedType = this.detectMimeTypeByMagicNumbers(buffer);
    if (detectedType) {
      return {
        isValid: false,
        error: `File type mismatch: declared ${mimeType}, but file appears to be ${detectedType}`,
        detectedMimeType: detectedType,
      };
    }

    return {
      isValid: false,
      error: `File does not match expected format for ${mimeType}`,
    };
  }

  /**
   * Detect MIME type by checking magic numbers
   * @param buffer - File buffer
   * @returns Detected MIME type or null
   */
  private static detectMimeTypeByMagicNumbers(buffer: Buffer): string | null {
    for (const [mimeType, magicPatterns] of Object.entries(
      this.MAGIC_NUMBERS
    )) {
      for (const magicPattern of magicPatterns) {
        if (this.checkMagicNumber(buffer, magicPattern)) {
          return mimeType;
        }
      }
    }
    return null;
  }

  /**
   * Check if buffer starts with specific magic number pattern
   * @param buffer - File buffer
   * @param magicPattern - Magic number pattern to check
   * @returns True if pattern matches
   */
  private static checkMagicNumber(
    buffer: Buffer,
    magicPattern: number[]
  ): boolean {
    if (buffer.length < magicPattern.length) {
      return false;
    }

    for (let i = 0; i < magicPattern.length; i++) {
      if (buffer[i] !== magicPattern[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get file extension from filename
   * @param filename - Original filename
   * @returns File extension or null
   */
  private static getFileExtension(filename: string): string | null {
    if (!filename || typeof filename !== "string") {
      return null;
    }

    const lastDotIndex = filename.lastIndexOf(".");
    if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
      return null;
    }

    return filename.substring(lastDotIndex);
  }

  /**
   * Get allowed MIME types
   * @returns Array of allowed MIME types
   */
  public static getAllowedMimeTypes(): string[] {
    return Object.keys(this.MAGIC_NUMBERS);
  }

  /**
   * Get allowed file extensions
   * @returns Array of allowed file extensions
   */
  public static getAllowedExtensions(): string[] {
    return Array.from(this.ALLOWED_EXTENSIONS);
  }

  /**
   * Check if MIME type is supported
   * @param mimeType - MIME type to check
   * @returns True if supported
   */
  public static isMimeTypeSupported(mimeType: string): boolean {
    return mimeType in this.MAGIC_NUMBERS;
  }

  /**
   * Check if file extension is allowed
   * @param extension - File extension to check
   * @returns True if allowed
   */
  public static isExtensionAllowed(extension: string): boolean {
    return this.ALLOWED_EXTENSIONS.has(extension.toLowerCase());
  }
}
