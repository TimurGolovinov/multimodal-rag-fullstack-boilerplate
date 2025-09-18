import { useCallback, useEffect, useRef, useState } from "react";
import type { Doc } from "../types";
import { API_BASE } from "../constants";
import { useAuth } from "../contexts/AuthContext";
import { enhancedVideoProcessor } from "../services/enhancedVideoProcessor";

export function KnowledgeHub() {
  const { isAuthenticated } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    stage: string;
    progress: number;
    message: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Helper function to create authenticated fetch headers
  const getAuthHeaders = useCallback(() => {
    const headers: Record<string, string> = {};

    // Add Authorization header if token exists
    const accessToken = localStorage.getItem("accessToken");
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    // Add CSRF token if exists
    const csrfToken = localStorage.getItem("csrfToken");
    if (csrfToken) {
      headers["x-csrf-token"] = csrfToken;
    }

    return headers;
  }, []);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      console.log("User not authenticated, skipping document load");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/documents`, {
        headers: getAuthHeaders(),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      setDocs(data.documents || []);
    } catch (error) {
      console.error("Failed to load documents:", error);
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, getAuthHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  const onUpload = useCallback(
    async (file: File) => {
      if (!isAuthenticated) {
        console.error("User not authenticated, cannot upload documents");
        return;
      }

      const form = new FormData();
      form.append("document", file);
      setUploading(true);
      setUploadProgress({
        stage: "uploading",
        progress: 0,
        message: "Starting upload...",
      });

      let retryCount = 0;
      const maxRetries = 3;

      const attemptUpload = async (): Promise<void> => {
        try {
          // Handle video files with client-side processing
          if (file.type.startsWith("video/")) {
            setUploadProgress({
              stage: "extracting",
              progress: 10,
              message:
                "Extracting frames from video. \n This may take a while...",
            });

            // Process video with hybrid processor (audio + visual)
            const videoResult = await enhancedVideoProcessor.processVideo(file);

            setUploadProgress({
              stage: "analyzing",
              progress: 50,
              message: `Analyzing ${videoResult.frameCount} frames and ${videoResult.audioSegmentCount} audio segments with AI...`,
            });

            // Send hybrid content to server for AI analysis
            const hybridFormData =
              enhancedVideoProcessor.prepareForUpload(videoResult);
            hybridFormData.append("originalVideoName", file.name);

            const videoResponse = await fetch(`${API_BASE}/api/video/process`, {
              method: "POST",
              headers: getAuthHeaders(),
              credentials: "include",
              body: hybridFormData,
            });

            if (!videoResponse.ok) {
              const errorText = await videoResponse.text();
              let errorMessage = `Video processing failed: ${videoResponse.status}`;

              try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.message || errorMessage;
              } catch {
                // Use default error message if parsing fails
              }

              throw new Error(errorMessage);
            }

            const videoData = await videoResponse.json();

            setUploadProgress({
              stage: "completed",
              progress: 100,
              message: `Video processed successfully! ${videoData.frameCount} frames and ${videoData.audioSegmentCount} audio segments analyzed.`,
            });

            // Reload documents to show the new video analysis
            await load();
            return;
          }

          // Handle non-video files
          const response = await fetch(`${API_BASE}/api/documents/upload`, {
            method: "POST",
            headers: getAuthHeaders(),
            credentials: "include",
            body: form,
          });

          if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `Upload failed: ${response.status}`;

            try {
              const errorData = JSON.parse(errorText);
              errorMessage = errorData.message || errorMessage;
            } catch {
              // Use default error message if parsing fails
            }

            throw new Error(errorMessage);
          }

          setUploadProgress({
            stage: "complete",
            progress: 100,
            message: "Upload complete!",
          });

          await load();
        } catch (error) {
          console.error("Upload error:", error);

          // Check if this is a retryable error
          const isRetryableError =
            error instanceof Error &&
            (error.message.includes("network") ||
              error.message.includes("timeout") ||
              error.message.includes("500") ||
              error.message.includes("502") ||
              error.message.includes("503") ||
              error.message.includes("504"));

          if (isRetryableError && retryCount < maxRetries) {
            retryCount++;
            setUploadProgress({
              stage: "retrying",
              progress: 0,
              message: `Upload failed, retrying... (${retryCount}/${maxRetries})`,
            });

            // Wait before retry (exponential backoff)
            await new Promise((resolve) =>
              setTimeout(resolve, Math.pow(2, retryCount) * 1000)
            );
            return attemptUpload();
          }

          // Determine user-friendly error message
          let userMessage = "Upload failed";
          if (error instanceof Error) {
            if (error.message.includes("413")) {
              userMessage = "File too large. Please choose a smaller file.";
            } else if (error.message.includes("415")) {
              userMessage =
                "Unsupported file type. Please choose a supported format.";
            } else if (error.message.includes("401")) {
              userMessage =
                "Authentication expired. Please refresh the page and try again.";
            } else if (
              error.message.includes("network") ||
              error.message.includes("fetch")
            ) {
              userMessage =
                "Network error. Please check your connection and try again.";
            } else {
              userMessage = error.message;
            }
          }

          setUploadProgress({
            stage: "error",
            progress: 0,
            message: userMessage,
          });
        }
      };

      try {
        await attemptUpload();
      } finally {
        setUploading(false);
        setTimeout(() => setUploadProgress(null), 5000); // Show error for 5 seconds
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [load, isAuthenticated, getAuthHeaders]
  );

  const onDelete = useCallback(
    async (id: string) => {
      if (!isAuthenticated) {
        console.error("User not authenticated, cannot delete documents");
        return;
      }

      setLoading(true);
      try {
        await fetch(`${API_BASE}/api/documents/${id}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
          credentials: "include",
        });
        await load();
      } catch (error) {
        console.error("Failed to delete document:", error);
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated, getAuthHeaders, load]
  );

  const getFileIcon = useCallback((filename: string, type: string) => {
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
  }, []);

  const getTypeLabel = useCallback((type: string) => {
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
  }, []);

  // Mobile collapsed view - just show toggle button
  if (isMobile && !isExpanded) {
    return (
      <div className="knowledge-hub-mobile-collapsed">
        <button
          onClick={toggleExpanded}
          className="knowledge-hub-toggle-button"
          aria-label="Open knowledge hub"
        >
          <span className="knowledge-hub-icon">📚</span>
          <span className="knowledge-hub-label">My Files</span>
        </button>
      </div>
    );
  }

  return (
    <section
      className={`panel multimodal-panel ${
        isMobile ? "knowledge-hub-mobile" : ""
      }`}
    >
      <div className="panel-header">
        <div className="brand">
          <div className="brand-text">
            <span className="brand-title">RAG Demo</span>
            {isMobile && (
              <button
                onClick={toggleExpanded}
                className="knowledge-hub-close-button"
                aria-label="Close knowledge hub"
              >
                ×
              </button>
            )}
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
              {/* Thumbnail for images */}
              {d.type === "image" && d.thumbnail ? (
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
