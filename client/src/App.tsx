import { useEffect, useRef, useState } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

type Doc = {
  id: string;
  filename: string;
  uploadedAt: string;
  type: "text" | "image" | "audio" | "video" | "pdf" | "word";
  metadata?: Record<string, unknown>;
  thumbnail?: string | null;
};

type ChatResponse = {
  success: boolean;
  message: string;
  sources: Doc[];
};

function App() {
  return (
    <div className="container">
      <div className="background-glow" />
      <header className="header">
        <div className="brand">
          <div className="brand-text">
            <span className="brand-title">RAG Demo</span>
            <span className="formats-title">✨ Supported Content Types</span>
            <div className="formats-grid">
              <div className="format-category">
                <div className="format-icon">📄</div>
                <div className="format-info">
                  <span className="format-name">Documents</span>
                  <span className="format-extensions">PDF, Word, Text</span>
                </div>
              </div>
              <div className="format-category">
                <div className="format-icon">🖼️</div>
                <div className="format-info">
                  <span className="format-name">Images</span>
                  <span className="format-extensions">
                    JPG, PNG, GIF, WebP, SVG
                  </span>
                </div>
              </div>
              <div className="format-category">
                <div className="format-icon">🎵</div>
                <div className="format-info">
                  <span className="format-name">Audio</span>
                  <span className="format-extensions">
                    MP3, WAV, M4A, OGG, FLAC, AAC
                  </span>
                </div>
              </div>
              <div className="format-category">
                <div className="format-icon">🎬</div>
                <div className="format-info">
                  <span className="format-name">Video</span>
                  <span className="format-extensions">
                    MP4, MOV, AVI, WebM, MKV, FLV
                  </span>
                </div>
              </div>
            </div>

            {/* <div className="supported-formats-header">
              <div
                className="expandable-header"
                onClick={() => setIsFormatsExpanded(!isFormatsExpanded)}
              >
                <div className="header-content">
                  <span className="formats-subtitle">
                    AI-powered analysis for every format
                  </span>
                </div>
                <div
                  className={`expand-icon ${
                    isFormatsExpanded ? "expanded" : ""
                  }`}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6,9 12,15 18,9"></polyline>
                  </svg>
                </div>
              </div>
              
            </div> */}
          </div>
        </div>
      </header>
      <div className="grid">
        <ChatPanel />
        <DocumentsPanel />
      </div>
    </div>
  );
}

function ChatPanel() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/chat/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data: ChatResponse = await res.json();
      const answer = data.success ? data.message : `Error: ${data.message}`;
      setMessages((m) => [...m, { role: "assistant", content: answer }]);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Error: ${errorMessage}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel chat-panel">
      <div className="panel-header">
        <h2>💬 Chat</h2>
        <div className="panel-subtitle">Ask questions about your documents</div>
      </div>
      <div className="chat-box">
        {messages.length === 0 && (
          <div className="chat-placeholder">
            <div className="placeholder-icon">💭</div>
            <div className="placeholder-text">
              Start a conversation about your documents
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="msg assistant loading">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
      </div>
      <div className="input-container">
        <div className="input-wrapper">
          <input
            placeholder="Ask about your documents..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            className="chat-input"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="send-button primary"
          >
            <span className="button-icon">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function DocumentsPanel() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    stage: string;
    progress: number;
    message: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/documents`);
      const data = await res.json();
      setDocs(data.documents || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onUpload = async (file: File) => {
    const form = new FormData();
    form.append("document", file);
    setUploading(true);
    setUploadProgress({
      stage: "uploading",
      progress: 0,
      message: "Starting upload...",
    });

    try {
      // Simulate progress for video files
      if (file.type.startsWith("video/")) {
        setUploadProgress({
          stage: "extracting",
          progress: 10,
          message: "Processing video...",
        });

        // Simulate frame extraction progress
        for (let i = 1; i <= 5; i++) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          setUploadProgress({
            stage: "extracting",
            progress: 10 + i * 8,
            message: `Extracting frames... ${i}/5`,
          });
        }

        setUploadProgress({
          stage: "analyzing",
          progress: 50,
          message: "Analyzing with AI...",
        });

        // Simulate AI analysis
        for (let i = 1; i <= 3; i++) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          setUploadProgress({
            stage: "analyzing",
            progress: 50 + i * 15,
            message: `AI analysis... ${i}/3`,
          });
        }

        setUploadProgress({
          stage: "synthesizing",
          progress: 95,
          message: "Finalizing...",
        });
      }

      await fetch(`${API_BASE}/api/documents/upload`, {
        method: "POST",
        body: form,
      });

      setUploadProgress({
        stage: "complete",
        progress: 100,
        message: "Upload complete!",
      });

      await load();
    } catch (error) {
      setUploadProgress({
        stage: "error",
        progress: 0,
        message: `Upload failed: ${error}`,
      });
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(null), 2000);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onDelete = async (id: string) => {
    setLoading(true);
    try {
      await fetch(`${API_BASE}/api/documents/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (filename: string, type: string) => {
    if (type === "image") {
      const ext = filename.split(".").pop()?.toLowerCase();
      switch (ext) {
        case "jpg":
        case "jpeg":
          return "🖼️";
        case "png":
          return "🖼️";
        case "gif":
          return "🎬";
        case "webp":
          return "🖼️";
        case "svg":
          return "🎨";
        default:
          return "🖼️";
      }
    }

    if (type === "audio") {
      const ext = filename.split(".").pop()?.toLowerCase();
      switch (ext) {
        case "mp3":
          return "🎵";
        case "wav":
          return "🎵";
        case "m4a":
          return "🎵";
        case "ogg":
          return "🎵";
        case "flac":
          return "🎵";
        case "aac":
          return "🎵";
        default:
          return "🎵";
      }
    }

    if (type === "video") {
      const ext = filename.split(".").pop()?.toLowerCase();
      switch (ext) {
        case "mp4":
          return "🎥";
        case "mov":
          return "🎥";
        case "avi":
          return "🎥";
        case "webm":
          return "🎥";
        case "mkv":
          return "🎥";
        case "flv":
          return "🎥";
        default:
          return "🎥";
      }
    }

    // Fallback to type-based icons
    switch (type) {
      case "image":
        return "🖼️";
      case "audio":
        return "🎵";
      case "video":
        return "🎥";
      case "pdf":
        return "📄";
      case "word":
        return "📝";
      case "text":
        return "📄";
      default:
        return "📁";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "image":
        return "Image";
      case "audio":
        return "Audio";
      case "video":
        return "Video";
      case "pdf":
        return "PDF";
      case "word":
        return "Word";
      case "text":
        return "Text";
      default:
        return "Document";
    }
  };

  return (
    <section className="panel multimodal-panel">
      <div className="panel-header">
        <h2>🚀 Knowledge Hub</h2>
        <div className="panel-subtitle">
          Upload & analyze any type of content
        </div>
      </div>
      <div className="upload-section">
        <div className="upload-area">
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.svg,.mp3,.wav,.m4a,.ogg,.flac,.aac,.mp4,.mov,.avi,.webm,.mkv,.flv,.wmv,.m4v,.3gp,.ogv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
            }}
            className="file-input"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={loading || uploading}
            className="upload-button primary"
          >
            <span className="button-icon">{uploading ? "⏳" : "📁"}</span>
            {uploading ? "Processing..." : "Upload File"}
          </button>
        </div>

        {/* Progress Bar */}
        {uploadProgress && (
          <div className="upload-progress">
            <div className="progress-header">
              <span className="progress-stage">{uploadProgress.stage}</span>
              <span className="progress-message">{uploadProgress.message}</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${uploadProgress.progress}%` }}
              />
            </div>
            <div className="progress-percentage">
              {uploadProgress.progress}%
            </div>
          </div>
        )}
      </div>
      <div className="documents-list">
        {loading && (
          <div className="loading-state">
            <div className="loading-spinner" />
            <span>Loading documents...</span>
          </div>
        )}
        {!loading && docs.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🚀</div>
            <div className="empty-text">No content uploaded yet</div>
            <div className="empty-subtext">
              Upload your first image, video, audio, or document to get started
            </div>
          </div>
        )}
        {docs.map((d) => (
          <div key={d.id} className="document-item">
            <div className="document-info">
              {/* Thumbnail for videos and images */}
              {(d.type === "video" || d.type === "image") && d.thumbnail ? (
                <div className="document-thumbnail">
                  <img
                    src={`data:image/png;base64,${d.thumbnail}`}
                    alt={`${d.filename} thumbnail`}
                    className="thumbnail-image"
                  />
                </div>
              ) : (
                <div className="document-icon">
                  {getFileIcon(d.filename, d.type)}
                </div>
              )}

              <div className="document-details">
                <div className="document-name">{d.filename}</div>
                <div className="document-meta">
                  <span className="document-type">{getTypeLabel(d.type)}</span>
                  <span className="document-separator">•</span>
                  {new Date(d.uploadedAt).toLocaleDateString()} •{" "}
                  {new Date(d.uploadedAt).toLocaleTimeString()}
                </div>
              </div>
            </div>
            <button
              className="delete-button danger"
              onClick={() => onDelete(d.id)}
              title="Delete document"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 6h18"></path>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export default App;
