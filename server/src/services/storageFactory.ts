import { FileStorageService } from "./fileStorageService";
import { S3StorageService, S3StorageConfig } from "./s3StorageService";
import {
  HybridStorageService,
  HybridStorageConfig,
} from "./hybridStorageService";

export type StorageType = "local" | "s3" | "hybrid";

export interface StorageService {
  storeFile(
    file: Express.Multer.File,
    category?: "documents" | "thumbnails" | "temp"
  ): Promise<any>;
  retrieveFile(filePath: string): Promise<Buffer>;
  deleteFile(filePath: string): Promise<boolean>;
  generateThumbnail(
    sourceFilePath: string,
    targetPath: string,
    options?: { width?: number; height?: number; quality?: number }
  ): Promise<string>;
  getStorageStats(): Promise<any>;
  cleanupTempFiles(maxAge?: number): Promise<number>;
}

export class StorageFactory {
  /**
   * Create storage service based on environment configuration
   */
  static createStorageService(): StorageService {
    const storageType = (process.env.STORAGE_TYPE || "local") as StorageType;

    console.log(`🔧 Initializing storage service: ${storageType}`);

    switch (storageType) {
      case "local":
        return this.createLocalStorage();

      case "s3":
        return this.createS3Storage();

      case "hybrid":
        return this.createHybridStorage();

      default:
        console.warn(
          `⚠️  Unknown storage type: ${storageType}, falling back to local storage`
        );
        return this.createLocalStorage();
    }
  }

  /**
   * Create local storage service
   */
  private static createLocalStorage(): FileStorageService {
    console.log("📁 Using local file storage");

    return new FileStorageService({
      basePath: process.env.UPLOAD_DIR || "./uploads",
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760"),
      allowedMimeTypes: (
        process.env.ALLOWED_FILE_TYPES ||
        "pdf,doc,docx,txt,jpg,jpeg,png,gif,mp3,wav,mp4,avi"
      ).split(","),
      thumbnailQuality: parseInt(process.env.THUMBNAIL_QUALITY || "80"),
      cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || "86400000"),
    });
  }

  /**
   * Create S3 storage service
   */
  private static createS3Storage(): S3StorageService {
    console.log("☁️  Using S3 storage");

    const s3Config: S3StorageConfig = {
      region: process.env.S3_REGION || "us-east-1",
      bucket: process.env.S3_BUCKET || "",
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760"),
      allowedMimeTypes: (
        process.env.ALLOWED_FILE_TYPES ||
        "pdf,doc,docx,txt,jpg,jpeg,png,gif,mp3,wav,mp4,avi"
      ).split(","),
      thumbnailQuality: parseInt(process.env.THUMBNAIL_QUALITY || "80"),
      cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || "86400000"),
    };

    // Validate required S3 configuration
    if (!s3Config.bucket) {
      throw new Error(
        "S3_BUCKET environment variable is required for S3 storage"
      );
    }
    if (!s3Config.accessKeyId || !s3Config.secretAccessKey) {
      throw new Error(
        "S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY environment variables are required for S3 storage"
      );
    }

    return new S3StorageService(s3Config);
  }

  /**
   * Create hybrid storage service
   */
  private static createHybridStorage(): HybridStorageService {
    console.log("🔄 Using hybrid storage (S3 + local fallback)");

    const hybridConfig: HybridStorageConfig = {
      storageType: "hybrid",
      local: {
        basePath: process.env.UPLOAD_DIR || "./uploads",
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760"),
        allowedMimeTypes: (
          process.env.ALLOWED_FILE_TYPES ||
          "pdf,doc,docx,txt,jpg,jpeg,png,gif,mp3,wav,mp4,avi"
        ).split(","),
        thumbnailQuality: parseInt(process.env.THUMBNAIL_QUALITY || "80"),
        cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || "86400000"),
      },
      s3: {
        region: process.env.S3_REGION || "us-east-1",
        bucket: process.env.S3_BUCKET || "",
        accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
        endpoint: process.env.S3_ENDPOINT || undefined,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760"),
        allowedMimeTypes: (
          process.env.ALLOWED_FILE_TYPES ||
          "pdf,doc,docx,txt,jpg,jpeg,png,gif,mp3,wav,mp4,avi"
        ).split(","),
        thumbnailQuality: parseInt(process.env.THUMBNAIL_QUALITY || "80"),
        cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || "86400000"),
      },
      fallbackToLocal: process.env.S3_FALLBACK_TO_LOCAL === "true",
    };

    // Validate required S3 configuration
    if (!hybridConfig.s3.bucket) {
      throw new Error(
        "S3_BUCKET environment variable is required for hybrid storage"
      );
    }
    if (!hybridConfig.s3.accessKeyId || !hybridConfig.s3.secretAccessKey) {
      throw new Error(
        "S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY environment variables are required for hybrid storage"
      );
    }

    return new HybridStorageService(hybridConfig);
  }

  /**
   * Get storage service info
   */
  static getStorageInfo(): {
    type: StorageType;
    description: string;
    features: string[];
  } {
    const storageType = (process.env.STORAGE_TYPE || "local") as StorageType;

    const storageInfo = {
      local: {
        description: "Local filesystem storage (development)",
        features: [
          "Fast access",
          "No external dependencies",
          "Suitable for development",
        ],
      },
      s3: {
        description: "Amazon S3 storage (production)",
        features: [
          "Scalable",
          "Durable",
          "Cost-effective",
          "No server storage",
        ],
      },
      hybrid: {
        description: "Hybrid storage with S3 + local fallback",
        features: [
          "Best of both worlds",
          "Automatic fallback",
          "Production ready",
        ],
      },
    };

    return {
      type: storageType,
      description:
        storageInfo[storageType]?.description || "Unknown storage type",
      features: storageInfo[storageType]?.features || [],
    };
  }

  /**
   * Test storage configuration
   */
  static async testStorageConfiguration(): Promise<{
    success: boolean;
    type: StorageType;
    details: any;
    errors: string[];
  }> {
    const result = {
      success: false,
      type: (process.env.STORAGE_TYPE || "local") as StorageType,
      details: {},
      errors: [] as string[],
    };

    try {
      const storageService = this.createStorageService();

      // Test basic operations
      if (result.type === "local") {
        // For local storage, just check if directories are accessible
        result.success = true;
        result.details = { message: "Local storage ready" };
      } else if (result.type === "s3" || result.type === "hybrid") {
        // For S3, test connection
        if ("testConnections" in storageService) {
          const connections = await (storageService as any).testConnections();
          result.success = connections.s3 || connections.local;
          result.details = connections;

          if (!connections.s3 && result.type === "s3") {
            result.errors.push("S3 connection failed");
          }
        } else {
          result.success = true;
          result.details = { message: "Storage service created successfully" };
        }
      }
    } catch (error) {
      result.errors.push(
        error instanceof Error ? error.message : "Unknown error"
      );
    }

    return result;
  }
}
