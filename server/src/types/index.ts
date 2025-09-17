export interface Document {
  id: string;
  filename: string;
  content: string;
  uploadedAt: Date;
  type: DocumentType;
  metadata?: Record<string, any>;
  thumbnail?: string | null;

  // New fields for database storage
  filePath?: string;
  fileSize?: number;
  mimeType?: string;
  processingStatus?: ProcessingStatus;
  errorMessage?: string;
  externalId?: string; // OpenAI vector store file ID
}

export type DocumentType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "pdf"
  | "word";

export type ProcessingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

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
  thumbnail?: string | null;
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
  documentIds?: string[];
  metadata?: Record<string, any>;
}

export interface ChatRequest {
  message: string;
  documentIds?: string[];
  sessionId?: string;
}

export interface ChatResponse {
  message: string;
  sources: Document[];
  sessionId?: string;
  messageId?: string;
}

export interface UploadResponse {
  success: boolean;
  document: Document;
  message?: string;
}

export interface ListDocumentsResponse {
  documents: Document[];
  total: number;
  hasMore: boolean;
}

export interface DocumentStats {
  totalDocuments: number;
  totalSize: number;
  byType: Record<string, { count: number; totalSize: number }>;
  byStatus: Record<string, number>;
}

export interface SearchResponse {
  documents: Document[];
  query: string;
  total: number;
  executionTime: number;
}

// Database-specific types
export interface DatabaseDocument {
  id: string;
  filename: string;
  original_filename: string;
  content: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  document_type: DocumentType;
  thumbnail_path?: string;
  uploaded_at: Date;
  updated_at: Date;
  metadata: Record<string, any>;
  processing_status: ProcessingStatus;
  error_message?: string;
  external_id?: string; // OpenAI vector store file ID
}

export interface FileStorageRecord {
  id: string;
  file_path: string;
  file_type: "document" | "thumbnail" | "temp";
  file_size: number;
  last_accessed: Date;
  created_at: Date;
  is_deleted: boolean;
}
