import OpenAI from "openai";

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
    content: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      if (!this.isInitialized || !this.vectorStoreId) {
        throw new Error("Vector store not initialized");
      }

      // Create a file first, then add to vector store (simpler approach)
      const file = await this.openai.files.create({
        file: new File([content], metadata.filename, { type: "text/plain" }),
        purpose: "assistants",
      });

      // Add file to vector store with metadata and chunking strategy
      await this.openai.vectorStores.files.create(this.vectorStoreId!, {
        file_id: file.id,
        attributes: {
          document_id: documentId,
          filename: metadata.filename,
          type: metadata.type,
          uploaded_at: metadata.uploadedAt,
          size: metadata.size,
          mimetype: metadata.mimetype,
        },
        // Optional: customize chunking strategy (using OpenAI defaults)
        chunking_strategy: {
          type: "static",
          static: {
            max_chunk_size_tokens: 800, // OpenAI default
            chunk_overlap_tokens: 400, // OpenAI default
          },
        },
      });
    } catch (error) {
      console.error("Failed to add document:", error);
      throw error;
    }
  }

  async search(query: string, limit: number = 5): Promise<SearchResult[]> {
    if (!this.isInitialized || !this.vectorStoreId) {
      throw new Error("Vector store not initialized");
    }

    try {
      // Search with OpenAI's built-in features for better results
      const searchResults = await this.openai.vectorStores.search(
        this.vectorStoreId,
        {
          query,
          max_num_results: limit,
          // Enable query rewriting for better search results
          rewrite_query: true,
        }
      );

      // OpenAI already provides the content in the right format
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
      console.error("Failed to search OpenAI vector store:", error);
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

  // OpenAI handles embeddings automatically when files are added to vector store

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
