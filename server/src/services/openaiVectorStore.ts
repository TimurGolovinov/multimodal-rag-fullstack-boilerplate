import OpenAI from "openai";
import { File } from "node:buffer";

// Set global File for OpenAI SDK compatibility with Node 18
if (!globalThis.File) {
  globalThis.File = File;
}

export interface VectorStoreDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
}

export interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, any>;
  score: number;
}

export class OpenAIVectorStore {
  private openai: OpenAI;
  private vectorStoreId: string | null = null;
  private isInitialized: boolean = false;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }

    this.openai = new OpenAI({ apiKey });
  }

  async initialize(): Promise<void> {
    try {
      // Check if we have an existing vector store
      const vectorStores = await this.openai.vectorStores.list();

      if (vectorStores.data.length > 0) {
        // Use the first available vector store
        this.vectorStoreId = vectorStores.data[0].id;
        console.log(`Using existing vector store: ${this.vectorStoreId}`);
      } else {
        // Create a new vector store
        const vectorStore = await this.openai.vectorStores.create({
          name: "rag-documents",
          expires_after: {
            anchor: "last_active_at",
            days: 30,
          },
          metadata: {
            description: "Vector store for RAG document retrieval",
            created_at: new Date().toISOString(),
          },
        });

        this.vectorStoreId = vectorStore.id;
        console.log(`Created new vector store: ${this.vectorStoreId}`);
      }

      this.isInitialized = true;
      console.log("OpenAI Vector Store initialized successfully");
    } catch (error) {
      console.error("Failed to initialize OpenAI Vector Store:", error);
      throw error;
    }
  }

  // OpenAI vector store handles document addition through addChunks method

  /**
   * Add a document to the vector store (OpenAI handles everything automatically)
   */
  async addDocument(
    documentId: string,
    content: string | Buffer,
    metadata: Record<string, any>
  ): Promise<void> {
    let file: any = null;

    try {
      if (!this.isInitialized || !this.vectorStoreId) {
        throw new Error("Vector store not initialized");
      }

      // Validate content length
      const contentLength = content.length;
      if (contentLength === 0) {
        throw new Error("Document content is empty");
      }

      const contentType = Buffer.isBuffer(content) ? "bytes" : "characters";
      console.log(
        `Adding document "${metadata.filename}" with ${contentLength} ${contentType}`
      );

      // Show a preview of the content for debugging
      let contentPreview: string;
      if (Buffer.isBuffer(content)) {
        // For binary content (like PDFs), show a hex preview
        const previewLength = Math.min(50, content.length);
        contentPreview = content.subarray(0, previewLength).toString("hex");
        console.log(`Content preview (hex): "${contentPreview}..."`);
      } else {
        // For text content, show the actual text
        contentPreview = content.substring(0, Math.min(200, content.length));
        console.log(`Content preview: "${contentPreview}..."`);
      }

      // Create a file first, then add to vector store (simpler approach)
      // For media files (images, videos, audio), we need to use a .txt extension since we're storing text content
      const filename =
        metadata.mimetype?.startsWith("image/") ||
        metadata.mimetype?.startsWith("video/") ||
        metadata.mimetype?.startsWith("audio/")
          ? `${metadata.filename.replace(/\.[^/.]+$/, "")}.txt`
          : metadata.filename;

      if (filename !== metadata.filename) {
        console.log(
          `Converting media file "${metadata.filename}" to text file "${filename}" for OpenAI Files API`
        );
      } else {
        console.log(
          `Using original filename "${filename}" for OpenAI Files API`
        );
      }

      // Create a proper File object using Node.js File constructor
      // Use the correct MIME type for better processing
      const mimeType = metadata.mimetype || "text/plain";

      // Handle both string content and Buffer content
      let fileBuffer: Buffer;
      if (Buffer.isBuffer(content)) {
        // Content is already a Buffer (e.g., PDF file)
        fileBuffer = content;
        console.log(
          `📁 Using original file buffer for ${filename}, size: ${fileBuffer.length} bytes`
        );
      } else {
        // Content is a string (e.g., extracted text)
        fileBuffer = Buffer.from(content, "utf-8");
        console.log(
          `📁 Converting text content to buffer for ${filename}, size: ${fileBuffer.length} bytes`
        );
      }

      const fileObject = new File([fileBuffer], filename, {
        type: mimeType,
      });

      console.log(
        `📁 Creating file with OpenAI API - Filename: ${filename}, Size: ${fileBuffer.length} bytes, MIME: ${mimeType}`
      );

      file = await this.openai.files.create({
        file: fileObject,
        purpose: "assistants",
      });

      console.log(
        `📁 File created with ID: ${file.id}, status: ${file.status}, size: ${file.bytes} bytes`
      );

      // Wait for file processing to complete
      await this.waitForFileProcessing(file.id);

      // Add file to vector store with metadata and chunking strategy
      const fileInVectorStore = await this.openai.vectorStores.files.create(
        this.vectorStoreId!,
        {
          file_id: file.id,
          attributes: {
            document_id: documentId,
            filename: metadata.filename,
            type: metadata.type,
            uploaded_at: metadata.uploadedAt,
            size: metadata.size,
            mimetype: metadata.mimetype,
            user_id: metadata.userId,
          },
          // Optional: customize chunking strategy (using OpenAI defaults)
          chunking_strategy: {
            type: "static",
            static: {
              max_chunk_size_tokens: 800, // OpenAI default
              chunk_overlap_tokens: 400, // OpenAI default
            },
          },
        }
      );

      console.log("File in vector store:", fileInVectorStore);

      console.log(
        `Successfully added document "${metadata.filename}" to vector store`
      );
    } catch (error) {
      console.error("Failed to add document:", error);

      // Clean up the file if vector store creation fails
      if (file) {
        try {
          await this.openai.files.delete(file.id);
          console.log(
            `Cleaned up file ${file.id} after vector store creation failure`
          );
        } catch (cleanupError) {
          console.error(
            "Failed to clean up file after vector store creation failure:",
            cleanupError
          );
        }
      }

      throw error;
    }
  }

  async search(
    query: string,
    limit: number = 5,
    fileIds?: string[]
  ): Promise<SearchResult[]> {
    if (!this.isInitialized || !this.vectorStoreId) {
      throw new Error("Vector store not initialized");
    }

    try {
      // If fileIds are provided, we need to search more broadly and filter
      // since the API doesn't support file_ids parameter in search
      const searchLimit = fileIds && fileIds.length > 0 ? limit * 3 : limit;

      // Search with OpenAI's built-in features for better results
      const searchResults = await this.openai.vectorStores.search(
        this.vectorStoreId,
        {
          query,
          max_num_results: searchLimit,
          // Enable query rewriting for better search results
          rewrite_query: true,
        }
      );
      console.log(
        "Search results:",
        searchResults,
        query,
        fileIds,
        searchLimit
      );

      // Filter results by file IDs if provided
      let filteredResults = searchResults.data;
      if (fileIds && fileIds.length > 0) {
        filteredResults = searchResults.data.filter(
          (result) => result.file_id && fileIds.includes(result.file_id)
        );

        // Limit to requested number of results after filtering
        filteredResults = filteredResults.slice(0, limit);
      }

      // OpenAI already provides the content in the right format
      return filteredResults.map((result) => ({
        id: result.file_id || "",
        content: result.content?.map((c: any) => c.text).join("\n") || "",
        metadata: {
          ...result.attributes,
          filename: result.filename,
          score: result.score,
        },
        score: result.score || 0,
      }));
    } catch (error) {
      console.error("Failed to search OpenAI vector store:", error);
      throw error;
    }
  }

  /**
   * Wait for file processing to complete
   */
  private async waitForFileProcessing(
    fileId: string,
    maxRetries: number = 30
  ): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const file = await this.openai.files.retrieve(fileId);
        console.log(`📁 File ${fileId} status: ${file.status}`);

        const status = file.status as string;
        switch (status) {
          case "processed":
            console.log(`✅ File ${fileId} processing completed successfully`);
            return;
          case "error":
            console.error(
              `❌ File ${fileId} processing failed with status: ${status}`
            );
            console.error(`❌ File details:`, {
              id: file.id,
              filename: file.filename,
              bytes: file.bytes,
              status: status,
              status_details: file.status_details,
            });
            throw new Error(
              `File ${fileId} processing failed: ${
                file.status_details || "Unknown error"
              }`
            );
          case "cancelled":
            console.error(`❌ File ${fileId} processing was cancelled`);
            throw new Error(`File ${fileId} processing was cancelled`);
          case "uploaded":
          case "processing":
            console.log(
              `⏳ File ${fileId} still processing, status: ${status} (attempt ${
                i + 1
              }/${maxRetries})`
            );
            break;
          default:
            console.log(
              `⏳ File ${fileId} unknown status: ${status} (attempt ${
                i + 1
              }/${maxRetries})`
            );
            break;
        }

        // Wait 2 seconds before checking again
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Error checking file status: ${error}`);
        throw error;
      }
    }

    throw new Error(
      `File ${fileId} processing timed out after ${maxRetries} retries`
    );
  }

  /**
   * Clean up failed files from vector store
   */
  async cleanupFailedFiles(): Promise<void> {
    if (!this.isInitialized || !this.vectorStoreId) {
      throw new Error("Vector store not initialized");
    }

    try {
      const files = await this.openai.vectorStores.files.list(
        this.vectorStoreId
      );
      const failedFiles = files.data.filter((file) => file.status === "failed");

      console.log(`🧹 Found ${failedFiles.length} failed files to clean up`);

      for (const file of failedFiles) {
        try {
          // First, delete from vector store
          await this.openai.vectorStores.files.delete(file.id, {
            vector_store_id: this.vectorStoreId,
          });

          // Then, delete the underlying file from OpenAI Files API
          await this.openai.files.delete(file.id);

          console.log(`🗑️ Removed failed file: ${file.id}`);
        } catch (error) {
          console.error(`Failed to remove file ${file.id}:`, error);
        }
      }
    } catch (error) {
      console.error("Failed to cleanup failed files:", error);
      throw error;
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    if (!this.isInitialized || !this.vectorStoreId) {
      throw new Error("Vector store not initialized");
    }

    try {
      // List all files in the vector store
      const files = await this.openai.vectorStores.files.list(
        this.vectorStoreId
      );

      // Find files that belong to this document
      const filesToDelete: string[] = [];
      for (const file of files.data) {
        if (file.attributes?.document_id === documentId) {
          filesToDelete.push(file.id);
        }
      }

      // Delete files from vector store AND from OpenAI Files API
      for (const fileId of filesToDelete) {
        try {
          // First, delete from vector store
          await this.openai.vectorStores.files.delete(fileId, {
            vector_store_id: this.vectorStoreId,
          });

          // Then, delete the underlying file from OpenAI Files API
          await this.openai.files.delete(fileId);

          console.log(
            `Deleted file ${fileId} from both vector store and Files API`
          );
        } catch (fileError) {
          console.error(`Failed to delete file ${fileId}:`, fileError);
          // Continue with other files even if one fails
        }
      }

      console.log(
        `Deleted ${filesToDelete.length} files for document ${documentId} from OpenAI vector store and Files API`
      );
    } catch (error) {
      console.error(
        "Failed to delete document from OpenAI vector store:",
        error
      );
      throw error;
    }
  }

  async clearAll(): Promise<void> {
    if (!this.isInitialized || !this.vectorStoreId) {
      throw new Error("Vector store not initialized");
    }

    try {
      // List all files in the vector store
      const files = await this.openai.vectorStores.files.list(
        this.vectorStoreId
      );

      // Delete all files from both vector store and Files API
      for (const file of files.data) {
        try {
          // First, delete from vector store
          await this.openai.vectorStores.files.delete(file.id, {
            vector_store_id: this.vectorStoreId,
          });

          // Then, delete the underlying file from OpenAI Files API
          await this.openai.files.delete(file.id);

          console.log(
            `Deleted file ${file.id} from both vector store and Files API`
          );
        } catch (fileError) {
          console.error(`Failed to delete file ${file.id}:`, fileError);
          // Continue with other files even if one fails
        }
      }

      console.log("OpenAI vector store and Files API cleared");
    } catch (error) {
      console.error("Failed to clear OpenAI vector store:", error);
      throw error;
    }
  }

  // OpenAI handles embeddings and vectorization automatically when files are added to vector store

  isReady(): boolean {
    return this.isInitialized;
  }

  async getDocumentCount(): Promise<number> {
    if (!this.isInitialized || !this.vectorStoreId) {
      return 0;
    }

    try {
      const files = await this.openai.vectorStores.files.list(
        this.vectorStoreId
      );
      return files.data.length;
    } catch (error) {
      console.error("Failed to get document count:", error);
      return 0;
    }
  }

  async getChunkCount(): Promise<number> {
    return this.getDocumentCount();
  }

  async getDocumentChunkCount(documentId: string): Promise<number> {
    if (!this.isInitialized || !this.vectorStoreId) {
      return 0;
    }

    try {
      const files = await this.openai.vectorStores.files.list(
        this.vectorStoreId
      );
      let count = 0;
      for (const file of files.data) {
        if (file.attributes?.document_id === documentId) {
          count++;
        }
      }
      return count;
    } catch (error) {
      console.error("Failed to get document chunk count:", error);
      return 0;
    }
  }

  /**
   * Get files by document ID
   */
  async getFilesByDocumentId(
    documentId: string
  ): Promise<{ id: string; filename: string }[]> {
    if (!this.isInitialized || !this.vectorStoreId) {
      return [];
    }

    try {
      const files = await this.openai.vectorStores.files.list(
        this.vectorStoreId
      );

      return files.data
        .filter((file) => file.attributes?.document_id === documentId)
        .map((file) => ({
          id: file.id,
          filename: String(file.attributes?.filename || "unknown"),
        }));
    } catch (error) {
      console.error("Failed to get files by document ID:", error);
      return [];
    }
  }

  /**
   * Advanced search with additional options
   */
  async searchAdvanced(
    query: string,
    options: {
      limit?: number;
      rewriteQuery?: boolean;
    } = {}
  ): Promise<SearchResult[]> {
    if (!this.isInitialized || !this.vectorStoreId) {
      throw new Error("Vector store not initialized");
    }

    try {
      const searchResults = await this.openai.vectorStores.search(
        this.vectorStoreId,
        {
          query,
          max_num_results: options.limit || 5,
          rewrite_query: options.rewriteQuery !== false, // Default to true
        }
      );

      console.log("Search results:", searchResults, query);

      return searchResults.data.map((result) => ({
        id: result.file_id || "",
        content: result.content?.map((c: any) => c.text).join("\n") || "",
        metadata: {
          ...result.attributes,
          filename: result.filename,
          score: result.score,
        },
        score: result.score || 0,
      }));
    } catch (error) {
      console.error("Failed to perform advanced search:", error);
      throw error;
    }
  }

  // OpenAI vector store handles persistence automatically
}
