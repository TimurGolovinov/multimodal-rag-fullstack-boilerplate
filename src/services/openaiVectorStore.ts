import OpenAI from "openai";
import { DocumentChunk } from "../types";

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
  private chunks: Map<
    string,
    {
      content: string;
      metadata: Record<string, any>;
      embedding: number[];
      documentId: string;
    }
  > = new Map();
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
      this.isInitialized = true;
      console.log("OpenAI Vector Store (in-memory) initialized successfully");
    } catch (error) {
      console.error("Failed to initialize OpenAI Vector Store:", error);
      throw error;
    }
  }

  async addDocuments(documents: VectorStoreDocument[]): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("Vector store not initialized");
    }

    try {
      // Create embeddings and store in memory
      for (const doc of documents) {
        const embedding = await this.createEmbedding(doc.content);
        this.chunks.set(doc.id, {
          content: doc.content,
          metadata: doc.metadata,
          embedding: embedding,
          documentId: doc.id,
        });
      }

      console.log(`Added ${documents.length} documents to vector store`);
    } catch (error) {
      console.error("Failed to add documents to vector store:", error);
      throw error;
    }
  }

  /**
   * Add document chunks to the vector store
   */
  async addChunks(chunks: DocumentChunk[]): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("Vector store not initialized");
    }

    try {
      // Create embeddings for each chunk
      for (const chunk of chunks) {
        const embedding = await this.createEmbedding(chunk.content);
        this.chunks.set(chunk.id, {
          content: chunk.content,
          metadata: chunk.metadata,
          embedding: embedding,
          documentId: chunk.documentId,
        });
      }

      console.log(`Added ${chunks.length} chunks to vector store`);
    } catch (error) {
      console.error("Failed to add chunks to vector store:", error);
      throw error;
    }
  }

  async search(query: string, limit: number = 5): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      throw new Error("Vector store not initialized");
    }

    try {
      // Create query embedding
      const queryEmbedding = await this.createEmbedding(query);

      // Calculate cosine similarity for all chunks
      const results: Array<SearchResult & { similarity: number }> = [];

      for (const [id, chunk] of this.chunks) {
        const similarity = this.cosineSimilarity(
          queryEmbedding,
          chunk.embedding
        );
        results.push({
          id,
          content: chunk.content,
          metadata: chunk.metadata,
          score: similarity,
          similarity,
        });
      }

      // Sort by similarity and return top results
      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .map(({ similarity, ...result }) => result);
    } catch (error) {
      console.error("Failed to search vector store:", error);
      throw error;
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("Vector store not initialized");
    }

    try {
      // Delete all chunks belonging to this document
      const chunksToDelete: string[] = [];
      for (const [chunkId, chunk] of this.chunks) {
        if (chunk.documentId === documentId) {
          chunksToDelete.push(chunkId);
        }
      }

      chunksToDelete.forEach((chunkId) => this.chunks.delete(chunkId));
      console.log(
        `Deleted ${chunksToDelete.length} chunks for document ${documentId} from vector store`
      );
    } catch (error) {
      console.error("Failed to delete document from vector store:", error);
      throw error;
    }
  }

  async clearAll(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("Vector store not initialized");
    }

    try {
      this.chunks.clear();
      console.log("Vector store cleared");
    } catch (error) {
      console.error("Failed to clear vector store:", error);
      throw error;
    }
  }

  private async createEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error("Failed to create embedding:", error);
      throw error;
    }
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error("Vectors must have the same length");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  getDocumentCount(): number {
    return this.chunks.size;
  }

  getChunkCount(): number {
    return this.chunks.size;
  }

  getDocumentChunkCount(documentId: string): number {
    let count = 0;
    for (const chunk of this.chunks.values()) {
      if (chunk.documentId === documentId) {
        count++;
      }
    }
    return count;
  }
}
