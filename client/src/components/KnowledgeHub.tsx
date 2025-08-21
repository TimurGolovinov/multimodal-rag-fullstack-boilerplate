import { useEffect, useRef, useState } from "react";
import type { Doc } from "../types";
import { API_BASE } from "../constants";

export function KnowledgeHub() {
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
        <div className="brand">
          <div className="brand-text">
            <span className="brand-title">RAG Demo</span>
          </div>
        </div>
        <div className="panel-subtitle">
          Supported formats: text, images, videos, audio
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
                {/* Document content preview - 3 rows with ellipsis */}
                <div className="document-content-3rows" title={d.content}>
                  {d.content.length > 300
                    ? `${d.content.substring(0, 300)}...`
                    : d.content}
                </div>
              </div>
            </div>
            <button
              className="delete-button"
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
