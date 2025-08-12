import { Document } from "../types";
import { ChromaClient, Collection } from "chromadb";
import { OpenAIEmbeddings } from "@langchain/openai";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { ChromaManager } from "./chromaManager";

export class DocumentService {
  private client: ChromaClient;
  private collection!: Collection;
  private embeddings: OpenAIEmbeddings;
  private documents: Map<string, Document> = new Map();
  private chromaManager: ChromaManager;

  constructor() {
    console.log(
      "Initializing DocumentService with persistent ChromaDB storage..."
    );

    this.chromaManager = new ChromaManager();
    this.client = new ChromaClient({
      host: "localhost",
      port: 8000,
      ssl: false,
    });

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    this.initializeCollection();
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
    const document: Document = {
      id: uuidv4(),
      filename: file.originalname,
      content,
      uploadedAt: new Date(),
      metadata: {
        size: file.size,
        mimetype: file.mimetype,
      },
    };

    // Store document in memory
    this.documents.set(document.id, document);

    // Create embeddings and store in vector database
    try {
      const embedding = await this.embeddings.embedQuery(content);

      await this.collection.add({
        ids: [document.id],
        embeddings: [embedding],
        metadatas: [
          {
            filename: document.filename,
            uploadedAt: document.uploadedAt.toISOString(),
          },
        ],
        documents: [content],
      });

      console.log(`Document "${document.filename}" indexed with embeddings`);
    } catch (error) {
      console.error("Failed to index document with embeddings:", error);
      console.log(
        `Document "${document.filename}" stored without vector indexing`
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

      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit,
      });

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

  private async extractText(file: Express.Multer.File): Promise<string> {
    const buffer = file.buffer;

    if (file.mimetype === "text/plain") {
      return buffer.toString("utf-8");
    }

    if (file.mimetype === "application/pdf") {
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(buffer);
      return data.text;
    }

    if (file.mimetype.includes("word") || file.mimetype.includes("docx")) {
      const mammoth = require("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    throw new Error(`Unsupported file type: ${file.mimetype}`);
  }
}
