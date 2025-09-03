import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import * as fs from "fs";
import * as path from "path";

export interface S3StorageConfig {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string; // For MinIO or other S3-compatible services
  forcePathStyle?: boolean; // For MinIO compatibility
  maxFileSize: number;
  allowedMimeTypes: string[];
  thumbnailQuality: number;
  cleanupInterval: number;
}

export interface S3StoredFile {
  id: string;
  originalName: string;
  storedName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
  s3Key: string;
  s3Url?: string;
}

export interface S3StorageStats {
  totalFiles: number;
  totalSize: number;
  byType: Record<string, { count: number; totalSize: number }>;
  oldestFile: Date | null;
  newestFile: Date | null;
}

export class S3StorageService {
  private s3Client: S3Client;
  private config: S3StorageConfig;
  private bucket: string;

  constructor(config: S3StorageConfig) {
    this.config = config;
    this.bucket = config.bucket;

    const clientConfig = {
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      ...(config.endpoint && { endpoint: config.endpoint }),
      ...(config.forcePathStyle && { forcePathStyle: config.forcePathStyle }),
    };

    this.s3Client = new S3Client(clientConfig);
  }

  /**
   * Store a file in S3
   */
  async storeFile(
    file: Express.Multer.File,
    category: "documents" | "thumbnails" | "temp" = "documents"
  ): Promise<S3StoredFile> {
    try {
      // Validate file
      this.validateFile(file);

      // Generate unique filename and S3 key
      const fileId = this.generateFileId();
      const fileExtension = path.extname(file.originalname);
      const storedName = `${fileId}${fileExtension}`;

      // Create S3 key with year/month structure
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = (now.getMonth() + 1).toString().padStart(2, "0");
      const s3Key = `${category}/${year}/${month}/${storedName}`;

      // Upload to S3
      const uploadParams = {
        Bucket: this.bucket,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          originalName: file.originalname,
          uploadedAt: now.toISOString(),
          category: category,
        },
      };

      await this.s3Client.send(new PutObjectCommand(uploadParams));

      // Create stored file record
      const storedFile: S3StoredFile = {
        id: fileId,
        originalName: file.originalname,
        storedName,
        filePath: s3Key, // Use S3 key as file path for compatibility
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedAt: now,
        s3Key,
      };

      console.log(
        `✅ File stored in S3: ${storedFile.originalName} -> s3://${this.bucket}/${s3Key}`
      );
      return storedFile;
    } catch (error) {
      throw new Error(
        `Failed to store file in S3: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Retrieve a file from S3
   */
  async retrieveFile(filePath: string): Promise<Buffer> {
    try {
      const getParams = {
        Bucket: this.bucket,
        Key: filePath,
      };

      const response = await this.s3Client.send(
        new GetObjectCommand(getParams)
      );

      if (!response.Body) {
        throw new Error(`File not found in S3: ${filePath}`);
      }

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      const stream = response.Body as Readable;

      return new Promise((resolve, reject) => {
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
      });
    } catch (error) {
      throw new Error(
        `Failed to retrieve file from S3: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const deleteParams = {
        Bucket: this.bucket,
        Key: filePath,
      };

      await this.s3Client.send(new DeleteObjectCommand(deleteParams));
      console.log(`✅ File deleted from S3: ${filePath}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to delete file from S3 ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Generate presigned URL for file access
   */
  async generatePresignedUrl(
    filePath: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: filePath,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      throw new Error(
        `Failed to generate presigned URL: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Check if file exists in S3
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      const headParams = {
        Bucket: this.bucket,
        Key: filePath,
      };

      await this.s3Client.send(new HeadObjectCommand(headParams));
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file metadata from S3
   */
  async getFileMetadata(filePath: string): Promise<{
    size: number;
    lastModified: Date;
    contentType: string;
    metadata: Record<string, string>;
  } | null> {
    try {
      const headParams = {
        Bucket: this.bucket,
        Key: filePath,
      };

      const response = await this.s3Client.send(
        new HeadObjectCommand(headParams)
      );

      return {
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        contentType: response.ContentType || "application/octet-stream",
        metadata: response.Metadata || {},
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate thumbnail (placeholder implementation)
   */
  async generateThumbnail(
    sourceFilePath: string,
    targetPath: string,
    options: { width?: number; height?: number; quality?: number } = {}
  ): Promise<string> {
    try {
      // For now, create a placeholder thumbnail
      // In production, you'd process the image and upload to S3
      const thumbnailContent = `Thumbnail placeholder for ${path.basename(
        sourceFilePath
      )}`;

      // Upload placeholder to S3
      const thumbnailBuffer = Buffer.from(thumbnailContent, "utf-8");
      const uploadParams = {
        Bucket: this.bucket,
        Key: targetPath,
        Body: thumbnailBuffer,
        ContentType: "text/plain",
        Metadata: {
          type: "thumbnail",
          sourceFile: sourceFilePath,
        },
      };

      await this.s3Client.send(new PutObjectCommand(uploadParams));

      console.log(`✅ Thumbnail generated in S3: ${targetPath}`);
      return targetPath;
    } catch (error) {
      throw new Error(
        `Failed to generate thumbnail in S3: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get storage statistics (estimated from S3)
   */
  async getStorageStats(): Promise<S3StorageStats> {
    // Note: This is a simplified implementation
    // For production, you might want to use S3 Inventory or CloudWatch metrics
    const stats: S3StorageStats = {
      totalFiles: 0,
      totalSize: 0,
      byType: {},
      oldestFile: null,
      newestFile: null,
    };

    try {
      // This would require listing objects in S3
      // For now, return placeholder stats
      console.log("⚠️  S3 storage stats not implemented (requires S3 listing)");

      return stats;
    } catch (error) {
      console.error("Failed to get S3 storage stats:", error);
      return stats;
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanupTempFiles(
    maxAge: number = 24 * 60 * 60 * 1000
  ): Promise<number> {
    try {
      // This would require listing objects in S3 and checking metadata
      // For now, return 0 as cleanup is not implemented
      console.log(
        "⚠️  S3 temp file cleanup not implemented (requires S3 listing)"
      );
      return 0;
    } catch (error) {
      console.error("Failed to cleanup S3 temp files:", error);
      return 0;
    }
  }

  /**
   * Validate file before storage
   */
  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new Error("No file provided");
    }

    if (file.size > this.config.maxFileSize) {
      throw new Error(
        `File size ${file.size} exceeds maximum allowed size ${this.config.maxFileSize}`
      );
    }

    if (!this.config.allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(`MIME type ${file.mimetype} is not allowed`);
    }
  }

  /**
   * Generate unique file ID
   */
  private generateFileId(): string {
    // Use timestamp + random for uniqueness
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Test S3 connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try to list objects (limit 1) to test connection
      const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        MaxKeys: 1,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      console.error("S3 connection test failed:", error);
      return false;
    }
  }
}
