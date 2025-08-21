export type Doc = {
  id: string;
  filename: string;
  content: string;
  uploadedAt: string;
  type: "text" | "image" | "audio" | "video" | "pdf" | "word";
  metadata?: Record<string, unknown>;
  thumbnail?: string | null;
};

export type ChatResponse = {
  success: boolean;
  message: string;
  sources: Doc[];
};
