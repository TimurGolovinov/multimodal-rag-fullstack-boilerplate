export interface Document {
  id: string;
  filename: string;
  content: string;
  uploadedAt: Date;
  metadata?: Record<string, any>;
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
