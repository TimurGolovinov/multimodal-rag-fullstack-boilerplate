import { Document } from "../types";
import { ChromaClient, Collection } from "chromadb";
import { OpenAIEmbeddings } from "@langchain/openai";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { ChromaManager } from "./chromaManager";
import { DocumentPersistence } from "./documentPersistence";
import { ImageProcessingService } from "./imageProcessingService";
import { AudioProcessingService } from "./audioProcessingService";
import { VideoProcessingService } from "./videoProcessingService";

export class DocumentService {
  private client: ChromaClient;
  private collection!: Collection;
  private embeddings: OpenAIEmbeddings;
  private documents: Map<string, Document> = new Map();
  private chromaManager: ChromaManager;
  private persistence: DocumentPersistence;
  private imageProcessor: ImageProcessingService;
  private audioProcessor: AudioProcessingService;
  private videoProcessor: VideoProcessingService;

  constructor() {
    console.log(
      "Initializing DocumentService with persistent storage, image, audio, and video support..."
    );

    this.chromaManager = new ChromaManager();
    this.persistence = new DocumentPersistence();
    this.imageProcessor = new ImageProcessingService();
    this.audioProcessor = new AudioProcessingService();
    this.videoProcessor = new VideoProcessingService();
    this.client = new ChromaClient({
      host: "localhost",
      port: 8000,
      ssl: false,
    });

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
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

    // Extract thumbnail for video and image files
    let thumbnail: string | null = null;
    if (documentType === "video") {
      try {
        const videoResult = await this.videoProcessor.extractTextFromVideo(
          file.buffer,
          file.originalname
        );
        thumbnail = videoResult.thumbnail;
      } catch (error) {
        console.warn("Failed to extract video thumbnail:", error);
      }
    } else if (documentType === "image") {
      try {
        const imageResult = await this.imageProcessor.extractTextFromImage(
          file.buffer,
          file.originalname
        );
        thumbnail = imageResult.thumbnail;
      } catch (error) {
        console.warn("Failed to extract image thumbnail:", error);
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

  private async extractText(file: Express.Multer.File): Promise<string> {
    const buffer = file.buffer;

    // Handle images using GPT-4o
    if (file.mimetype.startsWith("image/")) {
      console.log(`Processing image "${file.originalname}" with GPT-4o...`);
      try {
        const imageResult = await this.imageProcessor.extractTextFromImage(
          buffer,
          file.originalname
        );
        console.log(`Image processing completed for "${file.originalname}"`);

        // Store thumbnail for later use
        const thumbnail = imageResult.thumbnail;

        return imageResult.content;
      } catch (error) {
        console.error(`Failed to process image "${file.originalname}":`, error);
        throw new Error(
          `Image processing failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    // Handle audio using Whisper
    if (
      file.mimetype.startsWith("audio/") ||
      this.audioProcessor.isAudioFile(file.originalname)
    ) {
      console.log(`Processing audio "${file.originalname}" with Whisper...`);
      try {
        const audioText = await this.audioProcessor.extractTextFromAudio(
          buffer,
          file.originalname
        );
        console.log(`Audio processing completed for "${file.originalname}"`);
        return audioText;
      } catch (error) {
        console.error(`Failed to process audio "${file.originalname}":`, error);
        throw new Error(
          `Audio processing failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    // Handle video using optimized pipeline
    if (
      file.mimetype.startsWith("video/") ||
      this.videoProcessor.isVideoFile(file.originalname)
    ) {
      console.log(
        `Processing video "${file.originalname}" with optimized pipeline...`
      );
      try {
        const videoResult = await this.videoProcessor.extractTextFromVideo(
          buffer,
          file.originalname
        );
        console.log(`Video processing completed for "${file.originalname}"`);

        // Store thumbnail for later use
        const thumbnail = videoResult.thumbnail;

        return videoResult.content;
      } catch (error) {
        console.error(`Failed to process video "${file.originalname}":`, error);
        throw new Error(
          `Video processing failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    // Handle existing text-based formats
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
