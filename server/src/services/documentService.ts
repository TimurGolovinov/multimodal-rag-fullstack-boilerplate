import { Document, DocumentType, ProcessingStatus } from "../types";
import { DocumentDatabaseService } from "../database/services/documentService";
import { StorageFactory, StorageService } from "./storageFactory";
import { OpenAIVectorStore } from "./openaiVectorStore";

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
  private vectorStore?: OpenAIVectorStore;
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
      await this.dbService.testConnection();
    }
  }

  /**
   * Initialize vector store when needed
   */
  private async ensureVectorStore() {
    if (!this.vectorStore) {
      try {
        console.log("🔧 Initializing OpenAI Vector Store...");
        this.vectorStore = new OpenAIVectorStore();
        await this.vectorStore.initialize();
        console.log("✅ OpenAI Vector Store initialized successfully");

        // Check if vector store has any documents
        const docCount = await this.vectorStore.getDocumentCount();
        console.log(`📊 Vector store contains ${docCount} documents`);
      } catch (error) {
        console.warn("⚠️ Failed to initialize OpenAI Vector Store:", error);
        console.warn(
          "⚠️ Vector search will be disabled, falling back to text search"
        );
        this.vectorStore = undefined;
      }
    } else {
      // Check if vector store is still working
      try {
        const docCount = await this.vectorStore.getDocumentCount();
        console.log(`📊 Vector store contains ${docCount} documents`);
      } catch (error) {
        console.warn("⚠️ Vector store check failed:", error);
        this.vectorStore = undefined;
      }
    }
  }

  /**
   * Upload a new document
   */
  async uploadDocument(
    file: Express.Multer.File,
    userId: string
  ): Promise<Document> {
    try {
      console.log(`📤 Uploading document: ${file.originalname}`);
      console.log(`🔍 DocumentService debug - File size: ${file.size} bytes`);
      console.log(
        `🔍 DocumentService debug - Buffer length: ${file.buffer.length} bytes`
      );

      // Extract text content
      const content = await this.extractText(file);
      const documentType = this.getDocumentType(
        file.mimetype,
        file.originalname
      );

      // Store file in storage
      console.log(
        `🔍 Before storage - File size: ${file.size} bytes, Buffer length: ${file.buffer.length} bytes`
      );
      const storedFile = await this.storageService.storeFile(file, "documents");
      console.log(
        `🔍 After storage - Stored file size: ${storedFile.fileSize} bytes`
      );

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
        userId,
        metadata: {
          size: file.size,
          mimetype: file.mimetype,
          originalType: documentType,
          uploadedVia: "new-service",
        },
      });

      // Add document to vector store for semantic search
      let externalId: string | undefined;
      try {
        await this.ensureVectorStore();
        if (this.vectorStore && content.trim().length > 0) {
          // For binary files (PDFs, images, audio, video, office docs, archives),
          // pass the original file buffer to preserve the full file
          // For text files, use the extracted text content
          const isBinaryFile = this.isBinaryFileType(
            documentType,
            file.mimetype
          );
          const vectorContent = isBinaryFile ? file.buffer : content;

          await this.vectorStore.addDocument(document.id, vectorContent, {
            filename: document.filename,
            type: documentType,
            uploadedAt: document.uploadedAt.toISOString(),
            size: document.fileSize || file.size,
            mimetype: document.mimeType || file.mimetype,
            userId: userId,
          });

          // Get the external ID from the vector store
          // We need to find the file ID that was created
          const files = await this.vectorStore.getFilesByDocumentId(
            document.id
          );
          if (files.length > 0) {
            externalId = files[0].id;

            // Update the document with the external ID
            await this.dbService!.updateDocument(document.id, { externalId });
            document.externalId = externalId;
          }

          console.log(
            `✅ Document added to vector store: ${document.filename} (externalId: ${externalId})`
          );
        } else if (!this.vectorStore) {
          console.warn(
            "⚠️ Vector store not available, skipping vector indexing"
          );
        } else {
          console.warn(
            "⚠️ Document content is empty, skipping vector indexing"
          );
        }
      } catch (vectorError) {
        console.error(
          "❌ Failed to add document to vector store:",
          vectorError
        );
        console.error("❌ Vector error details:", {
          message:
            vectorError instanceof Error
              ? vectorError.message
              : "Unknown error",
          stack: vectorError instanceof Error ? vectorError.stack : undefined,
          name: vectorError instanceof Error ? vectorError.name : undefined,
        });
        console.warn(
          "⚠️ Document uploaded successfully but vector search will not work for this document"
        );
      }

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
  async getDocument(id: string, userId: string): Promise<Document | null> {
    try {
      await this.ensureDatabaseService();
      return await this.dbService!.getDocument(id, userId);
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
    userId: string,
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
        userId,
      });
    } catch (error) {
      console.error(`❌ Failed to list documents:`, error);
      throw error;
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(id: string, userId: string): Promise<boolean> {
    try {
      await this.ensureDatabaseService();
      // Get document info first
      const document = await this.dbService!.getDocument(id, userId);
      if (!document) {
        return false;
      }

      // Delete from database (this will also handle file cleanup)
      const deleted = await this.dbService!.deleteDocument(id, userId);

      if (deleted) {
        // Also delete from vector store
        try {
          await this.ensureVectorStore();
          if (this.vectorStore) {
            await this.vectorStore.deleteDocument(id);
            console.log(
              `✅ Document deleted from vector store: ${document.filename}`
            );
          }
        } catch (vectorError) {
          console.warn(
            "⚠️ Failed to delete document from vector store:",
            vectorError
          );
          // Don't fail the entire operation if vector store deletion fails
        }

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
    limit: number = 20,
    userId: string
  ): Promise<Document[]> {
    try {
      await this.ensureDatabaseService();

      // Try vector search first
      try {
        await this.ensureVectorStore();
        if (this.vectorStore) {
          console.log(
            `🔍 Performing optimized vector search for: "${query}" (userId: ${userId})`
          );

          // Get user's documents with external IDs first
          const userDocuments =
            await this.dbService!.getUserDocumentsWithExternalIds(userId);
          console.log(
            `🔍 Found ${userDocuments.length} user documents with external IDs`
          );

          if (userDocuments.length === 0) {
            console.log(
              "🔍 No documents with external IDs found, falling back to text search"
            );
            return await this.dbService!.searchDocuments(query, limit, userId);
          }

          // Extract external IDs for vector search
          const externalIds = userDocuments.map((doc) => doc.externalId);
          console.log(
            `🔍 Searching vector store with ${externalIds.length} file IDs`
          );

          const vectorResults = await this.vectorStore.search(
            query,
            limit,
            externalIds
          );

          console.log(
            "Searching results:",
            vectorResults,
            query,
            externalIds,
            limit
          );

          console.log("🔍 Vector results count:", vectorResults.length);
          console.log(
            "🔍 Vector results metadata:",
            vectorResults.map((r) => ({
              id: r.id,
              filename: r.metadata.filename,
              score: r.score,
            }))
          );

          if (vectorResults.length > 0) {
            // Convert vector store results to Document format
            const documents: Document[] = [];
            for (const result of vectorResults) {
              // Find the corresponding database document
              const userDoc = userDocuments.find(
                (doc) => doc.externalId === result.id
              );
              if (userDoc) {
                try {
                  const fullDoc = await this.dbService!.getDocument(
                    userDoc.id,
                    userId
                  );
                  if (fullDoc) {
                    documents.push(fullDoc);
                  }
                } catch (dbError) {
                  console.warn(
                    `⚠️ Could not fetch document ${userDoc.id} from database:`,
                    dbError
                  );
                }
              }
            }

            if (documents.length > 0) {
              console.log(
                `✅ Optimized vector search found ${documents.length} documents`
              );
              return documents;
            }
          }
        }
      } catch (vectorError) {
        console.error(
          "❌ Vector search failed, falling back to text search:",
          vectorError
        );
        console.error(
          "Vector error details:",
          JSON.stringify(vectorError, null, 2)
        );
      }

      // Fallback to text search
      console.warn("⚠️ Falling back to text-based search");
      console.log(`🔍 Database search for: "${query}" (userId: ${userId})`);
      const dbResults = await this.dbService!.searchDocuments(
        query,
        limit,
        userId
      );
      console.log(`🔍 Database results count: ${dbResults.length}`);
      console.log(
        `🔍 Database results:`,
        dbResults.map((d) => ({
          id: d.id,
          filename: d.filename,
          metadata: d.metadata,
        }))
      );
      return dbResults;
    } catch (error) {
      console.error(`❌ Failed to search documents:`, error);
      throw error;
    }
  }

  /**
   * Get document statistics
   */
  async getDocumentStats(userId: string) {
    try {
      await this.ensureDatabaseService();
      return await this.dbService!.getDocumentStats(userId);
    } catch (error) {
      console.error(`❌ Failed to get document stats:`, error);
      throw error;
    }
  }

  /**
   * Get vector store status and statistics
   */
  /**
   * Clean up failed files from vector store
   */
  async cleanupFailedFiles() {
    try {
      await this.ensureVectorStore();
      if (!this.vectorStore) {
        throw new Error("Vector store not available");
      }

      await this.vectorStore.cleanupFailedFiles();
      console.log("✅ Failed files cleaned up successfully");
    } catch (error) {
      console.error(`❌ Failed to cleanup failed files:`, error);
      throw error;
    }
  }

  async getVectorStoreStats() {
    try {
      await this.ensureVectorStore();
      if (!this.vectorStore) {
        return {
          available: false,
          message: "Vector store not available",
          documentCount: 0,
        };
      }

      const documentCount = await this.vectorStore.getDocumentCount();
      return {
        available: true,
        message: "Vector store is ready",
        documentCount,
      };
    } catch (error) {
      console.error(`❌ Failed to get vector store stats:`, error);
      return {
        available: false,
        message: `Vector store error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        documentCount: 0,
      };
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
   * Determine if a file type should use the original buffer instead of extracted text
   * @param documentType - The document type
   * @param mimeType - The MIME type
   * @returns True if the file should use the original buffer
   */
  private isBinaryFileType(
    documentType: DocumentType,
    mimeType: string
  ): boolean {
    // Text files should use extracted content
    if (documentType === "text") {
      return false;
    }

    // All other types are binary and should use original buffer
    // This includes: pdf, image, audio, video, word (office docs)
    return true;
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
      const dbTest = await this.dbService!.testConnection(); // Test database connection

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
