import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { FileValidationService } from "./fileValidationService";

export interface FileStorageConfig {
  basePath: string;
  maxFileSize: number;
  allowedMimeTypes: string[];
  thumbnailQuality: number;
  cleanupInterval: number; // in milliseconds
}

export interface StoredFile {
  id: string;
  originalName: string;
  storedName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
}

export interface StorageStats {
  totalFiles: number;
  totalSize: number;
  byType: Record<string, { count: number; totalSize: number }>;
  oldestFile: Date | null;
  newestFile: Date | null;
}

export class FileStorageService {
  private config: FileStorageConfig;
  private basePath: string;

  constructor(config: Partial<FileStorageConfig> = {}) {
    this.config = {
      basePath: config.basePath || path.join(process.cwd(), "uploads"),
      maxFileSize: config.maxFileSize || 100 * 1024 * 1024, // 100MB
      allowedMimeTypes: config.allowedMimeTypes || [
        "text/plain",
        "text/csv",
        "text/html",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "audio/mpeg",
        "audio/wav",
        "audio/ogg",
        "video/mp4",
        "video/webm",
        "video/ogg",
      ],
      thumbnailQuality: config.thumbnailQuality || 80,
      cleanupInterval: config.cleanupInterval || 24 * 60 * 60 * 1000, // 24 hours
    };

    this.basePath = this.config.basePath;
    this.ensureDirectoryStructure();
    this.startCleanupScheduler();
  }

  /**
   * Ensure all necessary directories exist
   */
  private ensureDirectoryStructure(): void {
    const directories = [
      this.basePath,
      path.join(this.basePath, "documents"),
      path.join(this.basePath, "thumbnails"),
      path.join(this.basePath, "temp"),
    ];

    directories.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    });
  }

  /**
   * Store a file with proper organization
   */
  async storeFile(
    file: Express.Multer.File,
    category: "documents" | "thumbnails" | "temp" = "documents"
  ): Promise<StoredFile> {
    try {
      // Validate file
      await this.validateFile(file);

      // Generate unique filename
      const fileId = uuidv4();
      const fileExtension = path.extname(file.originalname);
      const storedName = `${fileId}${fileExtension}`;

      // Create year/month directory structure
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = (now.getMonth() + 1).toString().padStart(2, "0");

      const categoryPath = path.join(this.basePath, category);
      const yearPath = path.join(categoryPath, year);
      const monthPath = path.join(yearPath, month);

      // Ensure directories exist
      [yearPath, monthPath].forEach((dir) => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      });

      // Final file path
      const filePath = path.join(monthPath, storedName);

      // Write file
      console.log(
        `🔍 FileStorageService debug - Writing file: ${file.originalname}`
      );
      console.log(
        `🔍 FileStorageService debug - Input buffer length: ${file.buffer.length} bytes`
      );
      console.log(
        `🔍 FileStorageService debug - Input file size: ${file.size} bytes`
      );
      await this.writeFile(filePath, file.buffer);

      // Verify the written file size
      const stats = fs.statSync(filePath);
      console.log(
        `🔍 FileStorageService debug - Written file size: ${stats.size} bytes`
      );

      // Create stored file record
      const storedFile: StoredFile = {
        id: fileId,
        originalName: file.originalname,
        storedName,
        filePath: path.relative(this.basePath, filePath),
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedAt: now,
      };

      console.log(
        `File stored successfully: ${storedFile.originalName} -> ${storedFile.filePath}`
      );
      return storedFile;
    } catch (error) {
      throw new Error(
        `Failed to store file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Retrieve a file by path
   */
  async retrieveFile(filePath: string): Promise<Buffer> {
    try {
      const fullPath = path.join(this.basePath, filePath);

      if (!fs.existsSync(fullPath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Update last accessed time
      this.updateLastAccessed(fullPath);

      return fs.readFileSync(fullPath);
    } catch (error) {
      throw new Error(
        `Failed to retrieve file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.basePath, filePath);

      if (!fs.existsSync(fullPath)) {
        return false;
      }

      // Remove file
      fs.unlinkSync(fullPath);
      console.log(`File deleted: ${filePath}`);

      // Try to remove empty directories
      this.cleanupEmptyDirectories(path.dirname(fullPath));

      return true;
    } catch (error) {
      console.error(`Failed to delete file ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Generate thumbnail for supported file types
   */
  async generateThumbnail(
    sourceFilePath: string,
    targetPath: string,
    options: { width?: number; height?: number; quality?: number } = {}
  ): Promise<string> {
    try {
      const {
        width = 300,
        height = 300,
        quality = this.config.thumbnailQuality,
      } = options;
      const fullSourcePath = path.join(this.basePath, sourceFilePath);

      if (!fs.existsSync(fullSourcePath)) {
        throw new Error(`Source file not found: ${sourceFilePath}`);
      }

      // For now, we'll create a placeholder thumbnail
      // In production, you'd use libraries like sharp, jimp, or ffmpeg
      const thumbnailContent = `Thumbnail placeholder for ${path.basename(
        sourceFilePath
      )}`;
      const thumbnailPath = path.join(this.basePath, targetPath);

      // Ensure thumbnail directory exists
      const thumbnailDir = path.dirname(thumbnailPath);
      if (!fs.existsSync(thumbnailDir)) {
        fs.mkdirSync(thumbnailDir, { recursive: true });
      }

      // Write placeholder thumbnail
      fs.writeFileSync(thumbnailPath, thumbnailContent);

      console.log(`Thumbnail generated: ${targetPath}`);
      return targetPath;
    } catch (error) {
      throw new Error(
        `Failed to generate thumbnail: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    try {
      const stats = await this.calculateStorageStats(this.basePath);
      return stats;
    } catch (error) {
      throw new Error(
        `Failed to get storage stats: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanupTempFiles(
    maxAge: number = 24 * 60 * 60 * 1000
  ): Promise<number> {
    try {
      const tempPath = path.join(this.basePath, "temp");
      if (!fs.existsSync(tempPath)) {
        return 0;
      }

      let deletedCount = 0;
      const now = Date.now();

      const cleanupDirectory = (dirPath: string): void => {
        const items = fs.readdirSync(dirPath);

        items.forEach((item) => {
          const itemPath = path.join(dirPath, item);
          const stat = fs.statSync(itemPath);

          if (stat.isDirectory()) {
            cleanupDirectory(itemPath);
          } else if (stat.isFile()) {
            const fileAge = now - stat.mtime.getTime();
            if (fileAge > maxAge) {
              try {
                fs.unlinkSync(itemPath);
                deletedCount++;
                console.log(`Cleaned up temp file: ${itemPath}`);
              } catch (error) {
                console.error(`Failed to delete temp file ${itemPath}:`, error);
              }
            }
          }
        });
      };

      cleanupDirectory(tempPath);

      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} temporary files`);
      }

      return deletedCount;
    } catch (error) {
      console.error("Failed to cleanup temp files:", error);
      return 0;
    }
  }

  /**
   * Validate file before storage using magic number checking
   */
  private async validateFile(file: Express.Multer.File): Promise<void> {
    if (!file) {
      throw new Error("No file provided");
    }

    // Use the new file validation service
    const validation = await FileValidationService.validateFile(file, {
      allowedMimeTypes: this.config.allowedMimeTypes,
    });
    if (!validation.isValid) {
      throw new Error(validation.errors.join(", ") || "File validation failed");
    }

    // Additional size check (redundant but kept for clarity)
    if (file.size > this.config.maxFileSize) {
      throw new Error(
        `File size ${file.size} exceeds maximum allowed size ${this.config.maxFileSize}`
      );
    }
  }

  /**
   * Write file to disk
   */
  private async writeFile(filePath: string, buffer: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, buffer, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Update last accessed time
   */
  private updateLastAccessed(filePath: string): void {
    try {
      const now = new Date();
      fs.utimesSync(filePath, now, now);
    } catch (error) {
      // Ignore errors for last accessed update
      console.warn(
        `Failed to update last accessed time for ${filePath}:`,
        error
      );
    }
  }

  /**
   * Clean up empty directories
   */
  private cleanupEmptyDirectories(dirPath: string): void {
    try {
      if (dirPath === this.basePath) {
        return; // Don't delete base directory
      }

      const items = fs.readdirSync(dirPath);
      if (items.length === 0) {
        fs.rmdirSync(dirPath);
        console.log(`Removed empty directory: ${dirPath}`);

        // Try to clean up parent directory
        this.cleanupEmptyDirectories(path.dirname(dirPath));
      }
    } catch (error) {
      // Ignore errors for directory cleanup
      console.warn(`Failed to cleanup empty directory ${dirPath}:`, error);
    }
  }

  /**
   * Calculate storage statistics recursively
   */
  private async calculateStorageStats(dirPath: string): Promise<StorageStats> {
    const stats: StorageStats = {
      totalFiles: 0,
      totalSize: 0,
      byType: {},
      oldestFile: null,
      newestFile: null,
    };

    try {
      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          const subStats = await this.calculateStorageStats(itemPath);
          stats.totalFiles += subStats.totalFiles;
          stats.totalSize += subStats.totalSize;

          // Merge type statistics
          Object.entries(subStats.byType).forEach(([type, typeStats]) => {
            if (!stats.byType[type]) {
              stats.byType[type] = { count: 0, totalSize: 0 };
            }
            stats.byType[type].count += typeStats.count;
            stats.byType[type].totalSize += typeStats.totalSize;
          });

          // Update oldest/newest
          if (
            subStats.oldestFile &&
            (!stats.oldestFile || subStats.oldestFile < stats.oldestFile)
          ) {
            stats.oldestFile = subStats.oldestFile;
          }
          if (
            subStats.newestFile &&
            (!stats.newestFile || subStats.newestFile > stats.newestFile)
          ) {
            stats.newestFile = subStats.newestFile;
          }
        } else if (stat.isFile()) {
          stats.totalFiles++;
          stats.totalSize += stat.size;

          // Categorize by file extension
          const ext = path.extname(item).toLowerCase();
          const type = this.getFileType(ext);

          if (!stats.byType[type]) {
            stats.byType[type] = { count: 0, totalSize: 0 };
          }
          stats.byType[type].count++;
          stats.byType[type].totalSize += stat.size;

          // Update oldest/newest
          if (!stats.oldestFile || stat.mtime < stats.oldestFile) {
            stats.oldestFile = stat.mtime;
          }
          if (!stats.newestFile || stat.mtime > stats.newestFile) {
            stats.newestFile = stat.mtime;
          }
        }
      }
    } catch (error) {
      console.error(
        `Failed to calculate stats for directory ${dirPath}:`,
        error
      );
    }

    return stats;
  }

  /**
   * Get file type from extension
   */
  private getFileType(extension: string): string {
    const typeMap: Record<string, string> = {
      ".txt": "text",
      ".pdf": "pdf",
      ".doc": "word",
      ".docx": "word",
      ".jpg": "image",
      ".jpeg": "image",
      ".png": "image",
      ".gif": "image",
      ".mp3": "audio",
      ".wav": "audio",
      ".mp4": "video",
      ".avi": "video",
    };

    return typeMap[extension] || "other";
  }

  /**
   * Start cleanup scheduler
   */
  private startCleanupScheduler(): void {
    setInterval(() => {
      this.cleanupTempFiles().catch((error) => {
        console.error("Scheduled cleanup failed:", error);
      });
    }, this.config.cleanupInterval);
  }
}
