import { FileStorageService } from "./fileStorageService";
import { S3StorageService, S3StorageConfig } from "./s3StorageService";
import { StoredFile, StorageStats } from "./fileStorageService";

export interface HybridStorageConfig {
  storageType: "local" | "s3" | "hybrid";
  local: {
    basePath: string;
    maxFileSize: number;
    allowedMimeTypes: string[];
    thumbnailQuality: number;
    cleanupInterval: number;
  };
  s3: S3StorageConfig;
  fallbackToLocal: boolean; // Whether to fallback to local if S3 fails
}

export class HybridStorageService {
  private localStorage: FileStorageService;
  private s3Storage: S3StorageService | null = null;
  private config: HybridStorageConfig;
  private isS3Available: boolean = false;

  constructor(config: HybridStorageConfig) {
    this.config = config;

    // Initialize local storage
    this.localStorage = new FileStorageService({
      basePath: config.local.basePath,
      maxFileSize: config.local.maxFileSize,
      allowedMimeTypes: config.local.allowedMimeTypes,
      thumbnailQuality: config.local.thumbnailQuality,
      cleanupInterval: config.local.cleanupInterval,
    });

    // Initialize S3 storage if configured
    if (config.storageType === "s3" || config.storageType === "hybrid") {
      this.initializeS3Storage();
    }
  }

  /**
   * Initialize S3 storage and test connection
   */
  private async initializeS3Storage(): Promise<void> {
    try {
      this.s3Storage = new S3StorageService(this.config.s3);

      // Test S3 connection
      this.isS3Available = await this.s3Storage.testConnection();

      if (this.isS3Available) {
        console.log("✅ S3 storage initialized successfully");
      } else {
        console.warn(
          "⚠️  S3 storage connection failed, will use local storage"
        );
      }
    } catch (error) {
      console.error("❌ Failed to initialize S3 storage:", error);
      this.isS3Available = false;
    }
  }

  /**
   * Store a file using the appropriate storage backend
   */
  async storeFile(
    file: Express.Multer.File,
    category: "documents" | "thumbnails" | "temp" = "documents"
  ): Promise<StoredFile> {
    try {
      // Determine storage backend
      const useS3 = this.shouldUseS3();

      if (useS3 && this.s3Storage && this.isS3Available) {
        try {
          // Try S3 first
          const s3Result = await this.s3Storage.storeFile(file, category);

          // Convert S3 result to StoredFile format for compatibility
          return {
            id: s3Result.id,
            originalName: s3Result.originalName,
            storedName: s3Result.storedName,
            filePath: s3Result.filePath,
            fileSize: s3Result.fileSize,
            mimeType: s3Result.mimeType,
            uploadedAt: s3Result.uploadedAt,
          };
        } catch (s3Error) {
          console.warn(
            "⚠️  S3 storage failed, falling back to local:",
            s3Error
          );

          if (this.config.fallbackToLocal) {
            return await this.localStorage.storeFile(file, category);
          } else {
            throw s3Error;
          }
        }
      } else {
        // Use local storage
        return await this.localStorage.storeFile(file, category);
      }
    } catch (error) {
      throw new Error(
        `Failed to store file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Retrieve a file from the appropriate storage backend
   */
  async retrieveFile(filePath: string): Promise<Buffer> {
    try {
      // Determine storage backend based on file path or configuration
      const useS3 = this.shouldUseS3() && this.isS3Available && this.s3Storage;

      if (useS3) {
        try {
          return await this.s3Storage!.retrieveFile(filePath);
        } catch (s3Error) {
          console.warn(
            "⚠️  S3 retrieval failed, trying local storage:",
            s3Error
          );

          if (this.config.fallbackToLocal) {
            return await this.localStorage.retrieveFile(filePath);
          } else {
            throw s3Error;
          }
        }
      } else {
        return await this.localStorage.retrieveFile(filePath);
      }
    } catch (error) {
      throw new Error(
        `Failed to retrieve file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Delete a file from the appropriate storage backend
   */
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const useS3 = this.shouldUseS3() && this.isS3Available && this.s3Storage;

      if (useS3) {
        try {
          return await this.s3Storage!.deleteFile(filePath);
        } catch (s3Error) {
          console.warn(
            "⚠️  S3 deletion failed, trying local storage:",
            s3Error
          );

          if (this.config.fallbackToLocal) {
            return await this.localStorage.deleteFile(filePath);
          } else {
            throw s3Error;
          }
        }
      } else {
        return await this.localStorage.deleteFile(filePath);
      }
    } catch (error) {
      console.error(`Failed to delete file ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Generate thumbnail using the appropriate storage backend
   */
  async generateThumbnail(
    sourceFilePath: string,
    targetPath: string,
    options: { width?: number; height?: number; quality?: number } = {}
  ): Promise<string> {
    try {
      const useS3 = this.shouldUseS3() && this.isS3Available && this.s3Storage;

      if (useS3) {
        try {
          return await this.s3Storage!.generateThumbnail(
            sourceFilePath,
            targetPath,
            options
          );
        } catch (s3Error) {
          console.warn(
            "⚠️  S3 thumbnail generation failed, trying local storage:",
            s3Error
          );

          if (this.config.fallbackToLocal) {
            return await this.localStorage.generateThumbnail(
              sourceFilePath,
              targetPath,
              options
            );
          } else {
            throw s3Error;
          }
        }
      } else {
        return await this.localStorage.generateThumbnail(
          sourceFilePath,
          targetPath,
          options
        );
      }
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
      if (
        this.config.storageType === "hybrid" &&
        this.isS3Available &&
        this.s3Storage
      ) {
        // For hybrid mode, combine local and S3 stats
        const [localStats, s3Stats] = await Promise.all([
          this.localStorage.getStorageStats(),
          this.s3Storage.getStorageStats(),
        ]);

        // Merge stats (simplified - in production you'd want more sophisticated merging)
        return {
          totalFiles: localStats.totalFiles + s3Stats.totalFiles,
          totalSize: localStats.totalSize + s3Stats.totalSize,
          byType: this.mergeStatsByType(localStats.byType, s3Stats.byType),
          oldestFile: this.getOldestFile(
            localStats.oldestFile,
            s3Stats.oldestFile
          ),
          newestFile: this.getNewestFile(
            localStats.newestFile,
            s3Stats.newestFile
          ),
        };
      } else if (this.shouldUseS3() && this.isS3Available && this.s3Storage) {
        // S3-only mode
        return await this.s3Storage.getStorageStats();
      } else {
        // Local-only mode
        return await this.localStorage.getStorageStats();
      }
    } catch (error) {
      console.error("Failed to get storage stats:", error);

      // Fallback to local stats
      return await this.localStorage.getStorageStats();
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanupTempFiles(
    maxAge: number = 24 * 60 * 60 * 1000
  ): Promise<number> {
    try {
      let totalCleaned = 0;

      // Clean local storage
      const localCleaned = await this.localStorage.cleanupTempFiles(maxAge);
      totalCleaned += localCleaned;

      // Clean S3 storage if available
      if (this.shouldUseS3() && this.isS3Available && this.s3Storage) {
        try {
          const s3Cleaned = await this.s3Storage.cleanupTempFiles(maxAge);
          totalCleaned += s3Cleaned;
        } catch (s3Error) {
          console.warn("⚠️  S3 cleanup failed:", s3Error);
        }
      }

      return totalCleaned;
    } catch (error) {
      console.error("Failed to cleanup temp files:", error);
      return 0;
    }
  }

  /**
   * Determine whether to use S3 storage
   */
  private shouldUseS3(): boolean {
    return (
      this.config.storageType === "s3" ||
      (this.config.storageType === "hybrid" && this.isS3Available)
    );
  }

  /**
   * Merge storage statistics by file type
   */
  private mergeStatsByType(
    localTypes: Record<string, { count: number; totalSize: number }>,
    s3Types: Record<string, { count: number; totalSize: number }>
  ): Record<string, { count: number; totalSize: number }> {
    const merged: Record<string, { count: number; totalSize: number }> = {};

    // Add local stats
    Object.entries(localTypes).forEach(([type, stats]) => {
      merged[type] = { ...stats };
    });

    // Add S3 stats
    Object.entries(s3Types).forEach(([type, stats]) => {
      if (merged[type]) {
        merged[type].count += stats.count;
        merged[type].totalSize += stats.totalSize;
      } else {
        merged[type] = { ...stats };
      }
    });

    return merged;
  }

  /**
   * Get the oldest file date
   */
  private getOldestFile(
    localDate: Date | null,
    s3Date: Date | null
  ): Date | null {
    if (!localDate && !s3Date) return null;
    if (!localDate) return s3Date;
    if (!s3Date) return localDate;
    return localDate < s3Date ? localDate : s3Date;
  }

  /**
   * Get the newest file date
   */
  private getNewestFile(
    localDate: Date | null,
    s3Date: Date | null
  ): Date | null {
    if (!localDate && !s3Date) return null;
    if (!localDate) return s3Date;
    if (!s3Date) return localDate;
    return localDate > s3Date ? localDate : s3Date;
  }

  /**
   * Get storage type information
   */
  getStorageInfo(): {
    type: string;
    s3Available: boolean;
    localAvailable: boolean;
    fallbackEnabled: boolean;
  } {
    return {
      type: this.config.storageType,
      s3Available: this.isS3Available,
      localAvailable: true, // Local storage is always available
      fallbackEnabled: this.config.fallbackToLocal,
    };
  }

  /**
   * Test storage connections
   */
  async testConnections(): Promise<{
    local: boolean;
    s3: boolean;
  }> {
    const results = {
      local: true, // Local storage is always available
      s3: false,
    };

    try {
      if (this.s3Storage) {
        results.s3 = await this.s3Storage.testConnection();
      }
    } catch (error) {
      console.error("S3 connection test failed:", error);
    }

    return results;
  }
}
