import { Document } from "../types";
import { ChromaClient, Collection } from "chromadb";
import { OpenAIEmbeddings } from "@langchain/openai";
import { v4 as uuidv4 } from "uuid";
import { ChromaManager } from "./chromaManager";
import { DocumentPersistence } from "./documentPersistence";

// Define interfaces for document processors
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
  private client: ChromaClient;
  private collection!: Collection;
  private embeddings: OpenAIEmbeddings;
  private documents: Map<string, Document> = new Map();
  private chromaManager: ChromaManager;
  private persistence: DocumentPersistence;

  // Document processors injected via constructor
  private processors: DocumentProcessor[] = [];

  constructor(config?: DocumentServiceConfig) {
    console.log(
      "Initializing DocumentService with persistent storage and configurable processors..."
    );

    this.chromaManager = new ChromaManager();
    this.persistence = new DocumentPersistence();

    // Add configured processors
    if (config?.imageProcessor) this.processors.push(config.imageProcessor);
    if (config?.audioProcessor) this.processors.push(config.audioProcessor);
    if (config?.videoProcessor) this.processors.push(config.videoProcessor);
    if (config?.pdfProcessor) this.processors.push(config.pdfProcessor);
    if (config?.wordProcessor) this.processors.push(config.wordProcessor);

    this.client = new ChromaClient({
      host: "localhost",
      port: 8000,
      ssl: false,
    });

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "text-embedding-3-small",
    });

    this.initializeCollection();
    this.loadPersistedDocuments();
  }

  private loadPersistedDocuments(): void {
    this.documents = this.persistence.loadDocuments();
  }

  private async initializeCollection() {
    try {
      // Ensure ChromaDB server is running
      const chromaReady = await this.chromaManager.ensureChromaRunning();
      if (!chromaReady) {
        throw new Error("Failed to start ChromaDB server");
      }

      this.collection = await this.client.getOrCreateCollection({
        name: "documents",
        metadata: { "hnsw:space": "cosine" },
      });

      console.log("ChromaDB collection initialized successfully");
    } catch (error) {
      console.error("Failed to initialize ChromaDB collection:", error);
      console.log("Server will continue without vector search capabilities");
    }
  }

  async uploadDocument(file: Express.Multer.File): Promise<Document> {
    const content = await this.extractText(file);
    const documentType = this.getDocumentType(file.mimetype, file.originalname);
    console.log("Document type", documentType);

    // Extract thumbnail if available
    let thumbnail: string | null = null;
    const processor = this.findProcessor(file.mimetype, file.originalname);
    if (processor) {
      try {
        const result = await processor.extractText(
          file.buffer,
          file.originalname
        );
        thumbnail = result.thumbnail || null;
      } catch (error) {
        console.warn(
          `Failed to extract thumbnail from ${documentType}:`,
          error
        );
      }
    }

    const document: Document = {
      id: uuidv4(),
      filename: file.originalname,
      content,
      uploadedAt: new Date(),
      type: documentType,
      metadata: {
        size: file.size,
        mimetype: file.mimetype,
        originalType: documentType,
      },
      thumbnail,
    };

    // Store document in memory and persist to disk
    this.documents.set(document.id, document);
    this.persistence.saveDocuments(this.documents);

    // Create embeddings and store in vector database
    try {
      const embedding = await this.embeddings.embedQuery(content);
      console.log("Embedding", embedding);
      await this.collection.add({
        ids: [document.id],
        embeddings: [embedding],
        metadatas: [
          {
            filename: document.filename,
            uploadedAt: document.uploadedAt.toISOString(),
            type: documentType,
          },
        ],
        documents: [content],
      });

      console.log(
        `Document "${document.filename}" (${documentType}) indexed with embeddings and persisted`
      );
    } catch (error) {
      console.error("Failed to index document with embeddings:", error);
      console.log(
        `Document "${document.filename}" stored without vector indexing but persisted to disk`
      );
    }

    return document;
  }

  async listDocuments(): Promise<Document[]> {
    return Array.from(this.documents.values());
  }

  async searchDocuments(query: string, limit: number = 5): Promise<Document[]> {
    try {
      if (!this.collection) {
        console.log("Vector search disabled - returning all documents");
        return Array.from(this.documents.values()).slice(0, limit);
      }

      const queryEmbedding = await this.embeddings.embedQuery(query);
      console.log("Query embedding", queryEmbedding);
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit,
      });
      console.log("Results", results);
      if (!results.ids || results.ids.length === 0) {
        return [];
      }

      const documentIds = results.ids[0] as string[];
      return documentIds
        .map((id) => this.documents.get(id))
        .filter((doc): doc is Document => doc !== undefined);
    } catch (error) {
      console.error(
        "Vector search failed, falling back to all documents:",
        error
      );
      return Array.from(this.documents.values()).slice(0, limit);
    }
  }

  async getDocument(id: string): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async deleteDocument(id: string): Promise<boolean> {
    const existing = this.documents.get(id);
    if (!existing) {
      return false;
    }

    // Remove from in-memory and persist
    this.documents.delete(id);
    this.persistence.saveDocuments(this.documents);

    // Try to remove from vector store
    try {
      if (this.collection) {
        await this.collection.delete({ ids: [id] });
      }
    } catch (error) {
      console.error("Failed to delete document from ChromaDB:", error);
    }

    return true;
  }

  private getDocumentType(
    mimetype: string,
    filename: string
  ): "text" | "image" | "audio" | "video" | "pdf" | "word" {
    if (mimetype.startsWith("image/")) {
      return "image";
    }
    if (mimetype.startsWith("audio/")) {
      return "audio";
    }
    if (mimetype.startsWith("video/")) {
      return "video";
    }
    if (mimetype === "application/pdf") {
      return "pdf";
    }
    if (mimetype.includes("word") || mimetype.includes("docx")) {
      return "word";
    }
    if (mimetype === "text/plain") {
      return "text";
    }

    // Fallback based on file extension
    const ext = filename.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext || "")) {
      return "image";
    }
    if (
      ["mp3", "wav", "m4a", "ogg", "flac", "aac", "wma", "opus"].includes(
        ext || ""
      )
    ) {
      return "audio";
    }
    if (
      [
        "mp4",
        "mov",
        "avi",
        "webm",
        "mkv",
        "flv",
        "wmv",
        "m4v",
        "3gp",
        "ogv",
      ].includes(ext || "")
    ) {
      return "video";
    }

    return "text"; // default fallback
  }

  private findProcessor(
    mimetype: string,
    filename: string
  ): DocumentProcessor | undefined {
    return this.processors.find((processor) =>
      processor.canProcess(mimetype, filename)
    );
  }

  private async extractText(file: Express.Multer.File): Promise<string> {
    const buffer = file.buffer;
    console.log("Extracting text for file", file);

    // Find appropriate processor
    const processor = this.findProcessor(file.mimetype, file.originalname);
    if (processor) {
      try {
        const result = await processor.extractText(buffer, file.originalname);
        console.log(`Processing completed for "${file.originalname}"`);
        return result.content;
      } catch (error) {
        console.error(`Failed to process "${file.originalname}":`, error);
        throw new Error(
          `Processing failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    // Handle text-based formats directly
    if (file.mimetype === "text/plain") {
      return buffer.toString("utf-8");
    }

    throw new Error(`Unsupported file type: ${file.mimetype}`);
  }
}
