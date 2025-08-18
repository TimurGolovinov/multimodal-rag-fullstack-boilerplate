export interface Document {
  id: string;
  filename: string;
  content: string;
  uploadedAt: Date;
  type: "text" | "image" | "audio" | "video" | "pdf" | "word";
  metadata?: Record<string, any>;
  thumbnail?: string | null; // Base64 encoded thumbnail for videos/images
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  startChar: number;
  endChar: number;
  metadata: Record<string, any>;
  embedding?: number[];
}

export interface ChunkingConfig {
  maxChunkSize: number;
  overlapSize: number;
  separator: string;
  minChunkSize: number;
}

export interface ImageAnalysis {
  description: string;
  extractedText?: string;
  chartData?: any;
  confidence: number;
}

export interface AudioAnalysis {
  transcript: string;
  language?: string;
  duration?: number;
  confidence: number;
}

export interface VideoAnalysis {
  visualSummary: string;
  audioTranscript: string;
  keyMoments: string[];
  duration: number;
  frameCount: number;
  combinedContent: string;
  confidence: number;
  thumbnail?: string | null; // Base64 encoded thumbnail
}

export interface ProcessingProgress {
  stage: "extracting" | "analyzing" | "synthesizing";
  progress: number;
  message: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface ChatRequest {
  message: string;
  documentIds?: string[];
}

export interface ChatResponse {
  message: string;
  sources: Document[];
}

export interface UploadResponse {
  success: boolean;
  document: Document;
  message?: string;
}

export interface ListDocumentsResponse {
  documents: Document[];
  total: number;
}
