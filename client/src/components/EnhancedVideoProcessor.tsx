/**
 * Enhanced video processor component with progressive loading and user feedback
 * Provides video processing using Canvas API
 */

import React, { useState, useCallback, useRef } from "react";
import {
  useEnhancedVideoProcessing,
  VideoProcessingOptions,
} from "../hooks/useEnhancedVideoProcessing";
import "./EnhancedVideoProcessor.css";

interface EnhancedVideoProcessorProps {
  onVideoProcessed?: (result: any) => void;
  onError?: (error: Error) => void;
  className?: string;
  options?: VideoProcessingOptions;
}

export function EnhancedVideoProcessor({
  onVideoProcessed,
  onError,
  className = "",
  options = {},
}: EnhancedVideoProcessorProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    isProcessing,
    progress,
    stage,
    message,
    currentStep,
    error,
    result,
    isSupported,
    processVideo,
    cancelProcessing,
    reset,
    uploadToServer,
  } = useEnhancedVideoProcessing({
    ...options,
    onComplete: (result) => {
      console.log("Video processing completed:", result);
    },
    onError: (error) => {
      console.error("Video processing error:", error);
      onError?.(error);
    },
  });

  const handleFileSelect = useCallback(
    (file: File) => {
      // Validate file type
      const validTypes = [
        "video/mp4",
        "video/webm",
        "video/ogg",
        "video/avi",
        "video/mov",
        "video/quicktime",
      ];
      if (!validTypes.includes(file.type)) {
        onError?.(
          new Error(
            "Please select a valid video file (MP4, WebM, OGG, AVI, MOV)"
          )
        );
        return;
      }

      // Validate file size (500MB limit)
      const maxSize = 500 * 1024 * 1024; // 500MB
      if (file.size > maxSize) {
        onError?.(
          new Error(
            "Video file too large. Please select a file smaller than 500MB"
          )
        );
        return;
      }

      setSelectedFile(file);
      reset(); // Reset previous state
    },
    [onError, reset]
  );

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);

      const file = event.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(true);
    },
    []
  );

  const handleDragLeave = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
    },
    []
  );

  const handleProcessVideo = useCallback(async () => {
    if (!selectedFile) return;

    try {
      const processingResult = await processVideo(selectedFile);

      // Upload to server
      const serverResult = await uploadToServer(
        processingResult,
        selectedFile.name
      );

      onVideoProcessed?.(serverResult);
    } catch (error) {
      console.error("Video processing failed:", error);
      onError?.(error as Error);
    }
  }, [selectedFile, processVideo, uploadToServer, onVideoProcessed, onError]);

  const handleCancel = useCallback(() => {
    cancelProcessing();
  }, [cancelProcessing]);

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    reset();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [reset]);

  const handleRetry = useCallback(() => {
    if (selectedFile) {
      handleProcessVideo();
    }
  }, [selectedFile, handleProcessVideo]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getStageIcon = (stage: string): string => {
    switch (stage) {
      case "initializing":
        return "🚀";
      case "extracting":
        return "📸";
      case "processing":
        return "🤖";
      case "finalizing":
        return "✅";
      default:
        return "🎬";
    }
  };

  const getProgressColor = (stage: string): string => {
    switch (stage) {
      case "initializing":
        return "#3b82f6";
      case "extracting":
        return "#8b5cf6";
      case "processing":
        return "#f59e0b";
      case "finalizing":
        return "#10b981";
      default:
        return "#6b7280";
    }
  };

  if (!isSupported) {
    return (
      <div className={`enhanced-video-processor unsupported ${className}`}>
        <div className="unsupported-message">
          <h3>⚠️ Enhanced Video Processing Not Supported</h3>
          <p>
            Your browser doesn't support the advanced video processing features.
            Please use a modern browser with WebAssembly support (Chrome,
            Firefox, Safari, Edge).
          </p>
          <div className="browser-requirements">
            <h4>Required Features:</h4>
            <ul>
              <li>WebAssembly support</li>
              <li>SharedArrayBuffer support</li>
              <li>Modern JavaScript features</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`enhanced-video-processor ${className}`}>
      <div className="processor-header">
        <h2>🎬 Enhanced Video Processor</h2>
        <p>
          Upload a video for AI-powered analysis with client-side processing
        </p>
      </div>

      {!selectedFile ? (
        <div
          className={`file-drop-zone ${dragActive ? "drag-active" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileInputChange}
            style={{ display: "none" }}
          />
          <div className="drop-zone-content">
            <div className="drop-zone-icon">📁</div>
            <h3>Drop your video here or click to browse</h3>
            <p>Supports MP4, WebM, OGG, AVI, MOV (max 500MB)</p>
            <div className="supported-formats">
              <span>MP4</span>
              <span>WebM</span>
              <span>OGG</span>
              <span>AVI</span>
              <span>MOV</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="video-processing-container">
          <div className="file-info">
            <div className="file-details">
              <h3>📹 {selectedFile.name}</h3>
              <p>{formatFileSize(selectedFile.size)}</p>
            </div>
            <button
              className="change-file-btn"
              onClick={handleReset}
              disabled={isProcessing}
            >
              Change File
            </button>
          </div>

          {!isProcessing && !result && !error && (
            <div className="processing-options">
              <h4>Processing Options</h4>
              <div className="options-grid">
                <div className="option-item">
                  <label>Max Frames:</label>
                  <span>{options.maxFrames || 12}</span>
                </div>
                <div className="option-item">
                  <label>Max Audio Segments:</label>
                  <span>{options.maxAudioSegments || 8}</span>
                </div>
                <div className="option-item">
                  <label>Frame Interval:</label>
                  <span>{options.frameInterval || 5}s</span>
                </div>
                <div className="option-item">
                  <label>Audio Segment Duration:</label>
                  <span>{options.audioSegmentDuration || 30}s</span>
                </div>
              </div>
              <button className="process-btn" onClick={handleProcessVideo}>
                Start Processing
              </button>
            </div>
          )}

          {isProcessing && (
            <div className="processing-status">
              <div className="progress-container">
                <div className="progress-header">
                  <span className="stage-icon">{getStageIcon(stage)}</span>
                  <span className="stage-text">{message}</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${progress}%`,
                      backgroundColor: getProgressColor(stage),
                    }}
                  />
                </div>
                <div className="progress-details">
                  <span className="progress-percentage">
                    {Math.round(progress)}%
                  </span>
                  {currentStep && (
                    <span className="current-step">{currentStep}</span>
                  )}
                </div>
              </div>
              <button className="cancel-btn" onClick={handleCancel}>
                Cancel Processing
              </button>
            </div>
          )}

          {error && (
            <div className="error-status">
              <div className="error-message">
                <span className="error-icon">❌</span>
                <h4>Processing Failed</h4>
                <p>{error}</p>
              </div>
              <div className="error-actions">
                <button className="retry-btn" onClick={handleRetry}>
                  Retry Processing
                </button>
                <button className="reset-btn" onClick={handleReset}>
                  Start Over
                </button>
              </div>
            </div>
          )}

          {result && !isProcessing && (
            <div className="success-status">
              <div className="success-message">
                <span className="success-icon">✅</span>
                <h4>Processing Complete!</h4>
                <div className="result-summary">
                  <p>📸 Frames: {result.frameCount}</p>
                  <p>🎵 Audio Segments: {result.audioSegmentCount}</p>
                  <p>⏱️ Duration: {Math.round(result.duration)}s</p>
                  <p>📊 Type: {result.contentType}</p>
                  <p>🎯 Strategy: {result.recommendedProcessing}</p>
                </div>
              </div>
              <div className="success-actions">
                <button className="process-another-btn" onClick={handleReset}>
                  Process Another Video
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
