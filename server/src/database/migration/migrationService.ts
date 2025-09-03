import * as fs from "fs";
import * as path from "path";
import { dbConnection } from "../config";
import { DocumentDatabaseService } from "../services/documentService";
import { FileStorageService } from "../../services/fileStorageService";
import { Document, DocumentType } from "../../types";

export interface MigrationResult {
  success: boolean;
  documentsMigrated: number;
  filesMigrated: number;
  errors: string[];
  warnings: string[];
  executionTime: number;
}

export interface MigrationProgress {
  stage:
    | "preparing"
    | "migrating-documents"
    | "migrating-files"
    | "verifying"
    | "cleanup"
    | "completed";
  progress: number;
  message: string;
  currentDocument?: string;
}

export class MigrationService {
  private dbService: DocumentDatabaseService;
  private fileStorage: FileStorageService;
  private backupPath: string;
  private oldDataPath: string;

  constructor() {
    this.dbService = new DocumentDatabaseService();
    this.fileStorage = new FileStorageService();
    this.backupPath = path.join(process.cwd(), "backups");
    this.oldDataPath = path.join(process.cwd(), "data", "documents.json");
  }

  /**
   * Execute the complete migration process
   */
  async migrateFromJson(
    progressCallback?: (progress: MigrationProgress) => void
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      success: false,
      documentsMigrated: 0,
      filesMigrated: 0,
      errors: [],
      warnings: [],
      executionTime: 0,
    };

    try {
      // Stage 1: Preparation
      await this.updateProgress(progressCallback, {
        stage: "preparing",
        progress: 0,
        message: "Preparing migration...",
      });

      await this.prepareMigration();

      // Stage 2: Migrate documents to database
      await this.updateProgress(progressCallback, {
        stage: "migrating-documents",
        progress: 25,
        message: "Migrating documents to database...",
      });

      const documents = await this.loadOldDocuments();
      await this.migrateDocumentsToDatabase(documents, progressCallback);

      // Stage 3: Migrate files to new storage structure
      await this.updateProgress(progressCallback, {
        stage: "migrating-files",
        progress: 50,
        message: "Migrating files to new storage structure...",
      });

      await this.migrateFilesToNewStructure(documents, progressCallback);

      // Stage 4: Verification
      await this.updateProgress(progressCallback, {
        stage: "verifying",
        progress: 75,
        message: "Verifying migration...",
      });

      await this.verifyMigration();

      // Stage 5: Cleanup
      await this.updateProgress(progressCallback, {
        stage: "cleanup",
        progress: 90,
        message: "Cleaning up old files...",
      });

      await this.cleanupOldFiles();

      // Stage 6: Complete
      await this.updateProgress(progressCallback, {
        stage: "completed",
        progress: 100,
        message: "Migration completed successfully!",
      });

      result.success = true;
      result.documentsMigrated = documents.length;
      result.filesMigrated = documents.length;
    } catch (error) {
      result.errors.push(
        `Migration failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      console.error("Migration failed:", error);

      // Attempt rollback
      await this.attemptRollback();
    } finally {
      result.executionTime = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Prepare migration environment
   */
  private async prepareMigration(): Promise<void> {
    console.log("🔧 Preparing migration environment...");

    // Ensure backup directory exists
    if (!fs.existsSync(this.backupPath)) {
      fs.mkdirSync(this.backupPath, { recursive: true });
    }

    // Create backup of old data
    if (fs.existsSync(this.oldDataPath)) {
      const backupFile = path.join(
        this.backupPath,
        `documents_backup_${Date.now()}.json`
      );
      fs.copyFileSync(this.oldDataPath, backupFile);
      console.log(`✅ Backup created: ${backupFile}`);
    }

    // Ensure database is connected
    await dbConnection.connect();

    // Run database migrations
    await dbConnection.runMigrations();

    console.log("✅ Migration environment prepared");
  }

  /**
   * Load old documents from JSON file
   */
  private async loadOldDocuments(): Promise<Document[]> {
    console.log("📖 Loading old documents from JSON...");

    if (!fs.existsSync(this.oldDataPath)) {
      console.log("⚠️  No old documents found, starting fresh");
      return [];
    }

    try {
      const data = fs.readFileSync(this.oldDataPath, "utf-8");
      const documents = JSON.parse(data) as Document[];

      // Validate and clean documents
      const validDocuments = documents.filter((doc) =>
        this.validateDocument(doc)
      );

      console.log(
        `✅ Loaded ${validDocuments.length} valid documents from JSON`
      );
      return validDocuments;
    } catch (error) {
      throw new Error(
        `Failed to load old documents: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Validate document structure
   */
  private validateDocument(doc: any): doc is Document {
    return (
      doc &&
      typeof doc.id === "string" &&
      typeof doc.filename === "string" &&
      typeof doc.content === "string" &&
      doc.uploadedAt &&
      doc.type &&
      ["text", "image", "audio", "video", "pdf", "word"].includes(doc.type)
    );
  }

  /**
   * Migrate documents to database
   */
  private async migrateDocumentsToDatabase(
    documents: Document[],
    progressCallback?: (progress: MigrationProgress) => void
  ): Promise<void> {
    console.log("🗄️  Migrating documents to database...");

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];

      await this.updateProgress(progressCallback, {
        stage: "migrating-documents",
        progress: 25 + (i / documents.length) * 25,
        message: `Migrating document ${i + 1} of ${documents.length}`,
        currentDocument: doc.filename,
      });

      try {
        // Convert old document format to new format
        const newDoc = await this.convertDocumentFormat(doc);

        // Store in database
        await this.dbService.createDocument({
          filename: newDoc.filename,
          originalFilename: newDoc.filename,
          content: newDoc.content,
          filePath:
            newDoc.filePath ||
            `documents/${new Date().getFullYear()}/${(new Date().getMonth() + 1)
              .toString()
              .padStart(2, "0")}/${newDoc.id}.txt`,
          fileSize: newDoc.fileSize || newDoc.content.length,
          mimeType: newDoc.mimeType || "text/plain",
          documentType: newDoc.type,
          thumbnailPath: newDoc.thumbnail || undefined,
          metadata: newDoc.metadata || {},
        });

        console.log(`✅ Migrated document: ${doc.filename}`);
      } catch (error) {
        console.error(`❌ Failed to migrate document ${doc.filename}:`, error);
        throw error;
      }
    }

    console.log("✅ All documents migrated to database");
  }

  /**
   * Convert old document format to new format
   */
  private async convertDocumentFormat(oldDoc: Document): Promise<Document> {
    // Create new file path for the document
    const fileExtension = this.getFileExtension(oldDoc.type);
    const fileName = `${oldDoc.id}${fileExtension}`;

    // Determine file size (estimate if not available)
    const fileSize = oldDoc.fileSize || oldDoc.content.length;

    // Determine MIME type
    const mimeType = this.getMimeType(oldDoc.type);

    return {
      ...oldDoc,
      filePath: `documents/${new Date().getFullYear()}/${(
        new Date().getMonth() + 1
      )
        .toString()
        .padStart(2, "0")}/${fileName}`,
      fileSize,
      mimeType,
    };
  }

  /**
   * Get file extension for document type
   */
  private getFileExtension(type: DocumentType): string {
    const extensions: Record<DocumentType, string> = {
      text: ".txt",
      pdf: ".pdf",
      word: ".docx",
      image: ".jpg",
      audio: ".mp3",
      video: ".mp4",
    };
    return extensions[type] || ".txt";
  }

  /**
   * Get MIME type for document type
   */
  private getMimeType(type: DocumentType): string {
    const mimeTypes: Record<DocumentType, string> = {
      text: "text/plain",
      pdf: "application/pdf",
      word: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      image: "image/jpeg",
      audio: "audio/mpeg",
      video: "video/mp4",
    };
    return mimeTypes[type] || "text/plain";
  }

  /**
   * Migrate files to new storage structure
   */
  private async migrateFilesToNewStructure(
    documents: Document[],
    progressCallback?: (progress: MigrationProgress) => void
  ): Promise<void> {
    console.log("📁 Migrating files to new storage structure...");

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];

      await this.updateProgress(progressCallback, {
        stage: "migrating-files",
        progress: 50 + (i / documents.length) * 25,
        message: `Migrating file ${i + 1} of ${documents.length}`,
        currentDocument: doc.filename,
      });

      try {
        // Create file content from document
        const fileContent = Buffer.from(doc.content, "utf-8");

        // Create a mock file object for the storage service
        const mockFile: Express.Multer.File = {
          fieldname: "document",
          originalname: doc.filename,
          encoding: "7bit",
          mimetype: this.getMimeType(doc.type),
          size: fileContent.length,
          destination: "",
          filename: doc.filename,
          path: "",
          buffer: fileContent,
          stream: null as any,
        };

        // Store file in new structure
        await this.fileStorage.storeFile(mockFile, "documents");

        console.log(`✅ Migrated file: ${doc.filename}`);
      } catch (error) {
        console.error(`❌ Failed to migrate file ${doc.filename}:`, error);
        throw error;
      }
    }

    console.log("✅ All files migrated to new storage structure");
  }

  /**
   * Verify migration was successful
   */
  private async verifyMigration(): Promise<void> {
    console.log("🔍 Verifying migration...");

    // Check database connection
    const isConnected = await dbConnection.testConnection();
    if (!isConnected) {
      throw new Error("Database connection failed during verification");
    }

    // Check if documents exist in database
    const dbStats = await this.dbService.getDocumentStats();
    if (dbStats.totalDocuments === 0) {
      throw new Error("No documents found in database after migration");
    }

    // Check file storage
    const storageStats = await this.fileStorage.getStorageStats();
    if (storageStats.totalFiles === 0) {
      throw new Error("No files found in storage after migration");
    }

    console.log("✅ Migration verification successful");
    console.log(`📊 Database: ${dbStats.totalDocuments} documents`);
    console.log(`📁 Storage: ${storageStats.totalFiles} files`);
  }

  /**
   * Clean up old files
   */
  private async cleanupOldFiles(): Promise<void> {
    console.log("🧹 Cleaning up old files...");

    try {
      // Move old JSON file to backup
      if (fs.existsSync(this.oldDataPath)) {
        const backupFile = path.join(
          this.backupPath,
          `documents_final_${Date.now()}.json`
        );
        fs.renameSync(this.oldDataPath, backupFile);
        console.log(`✅ Moved old data to backup: ${backupFile}`);
      }

      // Remove old data directory if empty
      const dataDir = path.dirname(this.oldDataPath);
      if (fs.existsSync(dataDir)) {
        const items = fs.readdirSync(dataDir);
        if (items.length === 0) {
          fs.rmdirSync(dataDir);
          console.log("✅ Removed empty data directory");
        }
      }

      console.log("✅ Cleanup completed");
    } catch (error) {
      console.warn("⚠️  Cleanup failed (non-critical):", error);
    }
  }

  /**
   * Attempt rollback on failure
   */
  private async attemptRollback(): Promise<void> {
    console.log("🔄 Attempting rollback...");

    try {
      // Restore backup if available
      const backupFiles = fs
        .readdirSync(this.backupPath)
        .filter((file) => file.startsWith("documents_backup_"))
        .sort()
        .reverse();

      if (backupFiles.length > 0) {
        const latestBackup = path.join(this.backupPath, backupFiles[0]);
        const restorePath = path.join(process.cwd(), "data", "documents.json");

        // Ensure data directory exists
        const dataDir = path.dirname(restorePath);
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }

        // Restore backup
        fs.copyFileSync(latestBackup, restorePath);
        console.log(`✅ Rollback completed: restored ${latestBackup}`);
      } else {
        console.log("⚠️  No backup found for rollback");
      }
    } catch (error) {
      console.error("❌ Rollback failed:", error);
    }
  }

  /**
   * Update progress callback
   */
  private async updateProgress(
    callback: ((progress: MigrationProgress) => void) | undefined,
    progress: MigrationProgress
  ): Promise<void> {
    if (callback) {
      try {
        callback(progress);
      } catch (error) {
        console.warn("Progress callback failed:", error);
      }
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<{
    hasOldData: boolean;
    backupExists: boolean;
    databaseReady: boolean;
    oldDataCount: number;
  }> {
    const hasOldData = fs.existsSync(this.oldDataPath);
    const backupExists =
      fs.existsSync(this.backupPath) &&
      fs.readdirSync(this.backupPath).length > 0;
    const databaseReady = await dbConnection.testConnection();

    let oldDataCount = 0;
    if (hasOldData) {
      try {
        const data = fs.readFileSync(this.oldDataPath, "utf-8");
        const documents = JSON.parse(data);
        oldDataCount = Array.isArray(documents) ? documents.length : 0;
      } catch (error) {
        oldDataCount = 0;
      }
    }

    return {
      hasOldData,
      backupExists,
      databaseReady,
      oldDataCount,
    };
  }
}
