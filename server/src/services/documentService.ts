import { Document, DocumentType, ProcessingStatus } from "../types";
import { DocumentDatabaseService } from "../database/services/documentService";
import { StorageFactory, StorageService } from "./storageFactory";

export interface DocumentProcessor {
  canProcess(mimetype: string, filename: string): boolean;
  extractText(
    buffer: Buffer,
    filename: string
  ): Promise<{ content: string; thumbnail?: string }>;
}

export interface DocumentServiceConfig {
  imageProcessor?: DocumentProcessor;
  audioProcessor?: DocumentProcessor;
  videoProcessor?: DocumentProcessor;
  pdfProcessor?: DocumentProcessor;
  wordProcessor?: DocumentProcessor;
}

export class DocumentService {
  private dbService?: DocumentDatabaseService;
  private storageService: StorageService;
  private processors: DocumentProcessor[] = [];

  constructor(config?: DocumentServiceConfig) {
    console.log(
      "Initializing new DocumentService with database and storage..."
    );

    // Initialize storage service
    this.storageService = StorageFactory.createStorageService();

    // Add configured processors
    if (config?.imageProcessor) this.processors.push(config.imageProcessor);
    if (config?.audioProcessor) this.processors.push(config.audioProcessor);
    if (config?.videoProcessor) this.processors.push(config.videoProcessor);
    if (config?.pdfProcessor) this.processors.push(config.pdfProcessor);
    if (config?.wordProcessor) this.processors.push(config.wordProcessor);

    console.log("✅ New DocumentService initialized successfully");
  }

  /**
   * Initialize database service when needed
   */
  private async ensureDatabaseService() {
    if (!this.dbService) {
      this.dbService = new DocumentDatabaseService();
      // Ensure database is connected
      await this.dbService.getDocumentStats(); // This will trigger connection
    }
  }

  /**
   * Upload a new document
   */
  async uploadDocument(file: Express.Multer.File): Promise<Document> {
    try {
      console.log(`📤 Uploading document: ${file.originalname}`);

      // Extract text content
      const content = await this.extractText(file);
      const documentType = this.getDocumentType(
        file.mimetype,
        file.originalname
      );

      // Store file in storage
      const storedFile = await this.storageService.storeFile(file, "documents");

      // Extract thumbnail if available
      let thumbnailPath: string | undefined;
      const processor = this.findProcessor(file.mimetype, file.originalname);
      if (processor) {
        try {
          const result = await processor.extractText(
            file.buffer,
            file.originalname
          );
          if (result.thumbnail) {
            // Store thumbnail
            const thumbnailFile = {
              ...file,
              buffer: Buffer.from(result.thumbnail, "utf-8"),
              mimetype: "text/plain",
              originalname: `${file.originalname}.thumbnail`,
            };
            const storedThumbnail = await this.storageService.storeFile(
              thumbnailFile,
              "thumbnails"
            );
            thumbnailPath = storedThumbnail.filePath;
          }
        } catch (error) {
          console.warn(
            `Failed to extract thumbnail from ${documentType}:`,
            error
          );
        }
      }

      // Create document in database
      await this.ensureDatabaseService();
      const document = await this.dbService!.createDocument({
        filename: file.originalname,
        originalFilename: file.originalname,
        content,
        filePath: storedFile.filePath,
        fileSize: file.size,
        mimeType: file.mimetype,
        documentType,
        thumbnailPath,
        metadata: {
          size: file.size,
          mimetype: file.mimetype,
          originalType: documentType,
          uploadedVia: "new-service",
        },
      });

      console.log(`✅ Document uploaded successfully: ${document.filename}`);
      return document;
    } catch (error) {
      console.error(`❌ Failed to upload document:`, error);
      throw new Error(
        `Failed to upload document: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get a document by ID
   */
  async getDocument(id: string): Promise<Document | null> {
    try {
      await this.ensureDatabaseService();
      return await this.dbService!.getDocument(id);
    } catch (error) {
      console.error(`❌ Failed to get document ${id}:`, error);
      throw error;
    }
  }

  /**
   * List documents with pagination
   */
  async listDocuments(
    page: number = 1,
    limit: number = 20,
    documentType?: DocumentType,
    processingStatus?: ProcessingStatus
  ): Promise<{ documents: Document[]; total: number; hasMore: boolean }> {
    try {
      await this.ensureDatabaseService();
      const offset = (page - 1) * limit;
      return await this.dbService!.listDocuments({
        limit,
        offset,
        documentType,
        processingStatus,
      });
    } catch (error) {
      console.error(`❌ Failed to list documents:`, error);
      throw error;
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(id: string): Promise<boolean> {
    try {
      await this.ensureDatabaseService();
      // Get document info first
      const document = await this.dbService!.getDocument(id);
      if (!document) {
        return false;
      }

      // Delete from database (this will also handle file cleanup)
      const deleted = await this.dbService!.deleteDocument(id);

      if (deleted) {
        console.log(`✅ Document deleted successfully: ${document.filename}`);
      }

      return deleted;
    } catch (error) {
      console.error(`❌ Failed to delete document ${id}:`, error);
      throw error;
    }
  }

  /**
   * Search documents by content
   */
  async searchDocuments(
    query: string,
    limit: number = 20
  ): Promise<Document[]> {
    try {
      await this.ensureDatabaseService();
      return await this.dbService!.searchDocuments(query, limit);
    } catch (error) {
      console.error(`❌ Failed to search documents:`, error);
      throw error;
    }
  }

  /**
   * Get document statistics
   */
  async getDocumentStats() {
    try {
      await this.ensureDatabaseService();
      return await this.dbService!.getDocumentStats();
    } catch (error) {
      console.error(`❌ Failed to get document stats:`, error);
      throw error;
    }
  }

  /**
   * Extract text content from file
   */
  private async extractText(file: Express.Multer.File): Promise<string> {
    const processor = this.findProcessor(file.mimetype, file.originalname);

    if (processor) {
      try {
        const result = await processor.extractText(
          file.buffer,
          file.originalname
        );
        return result.content;
      } catch (error) {
        console.warn(
          `Processor failed for ${file.originalname}, falling back to basic extraction:`,
          error
        );
      }
    }

    // Fallback: return basic text for text files
    if (file.mimetype.startsWith("text/")) {
      return file.buffer.toString("utf-8");
    }

    // For other file types, return a placeholder
    return `[${file.mimetype} file: ${file.originalname}]`;
  }

  /**
   * Find appropriate processor for file type
   */
  private findProcessor(
    mimetype: string,
    filename: string
  ): DocumentProcessor | undefined {
    return this.processors.find((processor) =>
      processor.canProcess(mimetype, filename)
    );
  }

  /**
   * Determine document type from MIME type and filename
   */
  private getDocumentType(mimetype: string, filename: string): DocumentType {
    if (mimetype.startsWith("text/")) return "text";
    if (mimetype.startsWith("image/")) return "image";
    if (mimetype.startsWith("audio/")) return "audio";
    if (mimetype.startsWith("video/")) return "video";
    if (mimetype === "application/pdf") return "pdf";
    if (
      mimetype.includes("word") ||
      filename.endsWith(".doc") ||
      filename.endsWith(".docx")
    )
      return "word";

    return "text"; // Default fallback
  }

  /**
   * Get storage information
   */
  getStorageInfo() {
    if ("getStorageInfo" in this.storageService) {
      return (this.storageService as any).getStorageInfo();
    }
    return {
      type: "unknown",
      description: "Storage service info not available",
    };
  }

  /**
   * Test storage and database connections
   */
  async testConnections() {
    try {
      const storageTest = await StorageFactory.testStorageConfiguration();
      await this.ensureDatabaseService();
      const dbTest = await this.dbService!.getDocumentStats(); // This will test DB connection

      return {
        storage: storageTest.success,
        database: true,
        details: {
          storage: storageTest,
          database: "Connected successfully",
        },
      };
    } catch (error) {
      return {
        storage: false,
        database: false,
        details: {
          storage: "Test failed",
          database: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }
}
