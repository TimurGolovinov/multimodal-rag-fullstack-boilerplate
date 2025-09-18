/**
 * React hook for enhanced video processing with progressive feedback
 * Provides real-time progress updates and error handling
 */

import { useState, useCallback, useRef } from "react";
import {
  enhancedVideoProcessor,
  VideoAnalysisResult,
  ProcessingProgress,
} from "../services/enhancedVideoProcessor";

export interface VideoProcessingState {
  isProcessing: boolean;
  progress: number;
  stage: ProcessingProgress["stage"];
  message: string;
  currentStep?: string;
  error: string | null;
  result: VideoAnalysisResult | null;
  isSupported: boolean;
}

export interface VideoProcessingOptions {
  maxFrames?: number;
  maxAudioSegments?: number;
  frameInterval?: number;
  audioSegmentDuration?: number;
  enableThumbnail?: boolean;
  enableMetadata?: boolean;
  onProgress?: (progress: ProcessingProgress) => void;
  onComplete?: (result: VideoAnalysisResult) => void;
  onError?: (error: Error) => void;
}

export function useEnhancedVideoProcessing(
  options: VideoProcessingOptions = {}
) {
  const [state, setState] = useState<VideoProcessingState>({
    isProcessing: false,
    progress: 0,
    stage: "initializing",
    message: "Ready to process video",
    error: null,
    result: null,
    isSupported: enhancedVideoProcessor.constructor.isSupported(),
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateProgress = useCallback(
    (progress: ProcessingProgress) => {
      setState((prev) => ({
        ...prev,
        progress: progress.progress,
        stage: progress.stage,
        message: progress.message,
        currentStep: progress.currentStep,
      }));

      // Call external progress callback
      options.onProgress?.(progress);
    },
    [options.onProgress]
  );

  const processVideo = useCallback(
    async (file: File): Promise<VideoAnalysisResult> => {
      // Check if processing is supported
      if (!state.isSupported) {
        const error = new Error(
          "Enhanced video processing not supported in this browser. Please use a modern browser with WebAssembly support."
        );
        setState((prev) => ({ ...prev, error: error.message }));
        options.onError?.(error);
        throw error;
      }

      // Reset state
      setState((prev) => ({
        ...prev,
        isProcessing: true,
        progress: 0,
        stage: "initializing",
        message: "Initializing video processing...",
        error: null,
        result: null,
      }));

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      // Set processing timeout (5 minutes)
      processingTimeoutRef.current = setTimeout(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          const error = new Error(
            "Video processing timeout - the video may be too large or complex"
          );
          setState((prev) => ({
            ...prev,
            error: error.message,
            isProcessing: false,
          }));
          options.onError?.(error);
        }
      }, 5 * 60 * 1000);

      try {
        // Configure processor with options
        const processor = new enhancedVideoProcessor.constructor({
          maxFrames: options.maxFrames,
          maxAudioSegments: options.maxAudioSegments,
          frameInterval: options.frameInterval,
          audioSegmentDuration: options.audioSegmentDuration,
          enableThumbnail: options.enableThumbnail,
          enableMetadata: options.enableMetadata,
        });

        // Process video with progress updates
        const result = await processor.processVideo(file, updateProgress);

        // Clear timeout
        if (processingTimeoutRef.current) {
          clearTimeout(processingTimeoutRef.current);
          processingTimeoutRef.current = null;
        }

        // Update final state
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          progress: 100,
          stage: "finalizing",
          message: "Video processing completed successfully!",
          result,
        }));

        // Call completion callback
        options.onComplete?.(result);

        return result;
      } catch (error) {
        // Clear timeout
        if (processingTimeoutRef.current) {
          clearTimeout(processingTimeoutRef.current);
          processingTimeoutRef.current = null;
        }

        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";

        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: errorMessage,
          message: "Video processing failed",
        }));

        const errorObj =
          error instanceof Error ? error : new Error(errorMessage);
        options.onError?.(errorObj);

        throw errorObj;
      }
    },
    [state.isSupported, options, updateProgress]
  );

  const cancelProcessing = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      isProcessing: false,
      message: "Processing cancelled",
      error: null,
    }));
  }, []);

  const reset = useCallback(() => {
    // Cancel any ongoing processing
    cancelProcessing();

    setState({
      isProcessing: false,
      progress: 0,
      stage: "initializing",
      message: "Ready to process video",
      error: null,
      result: null,
      isSupported: enhancedVideoProcessor.constructor.isSupported(),
    });
  }, [cancelProcessing]);

  const uploadToServer = useCallback(
    async (
      result: VideoAnalysisResult,
      originalVideoName: string
    ): Promise<any> => {
      try {
        setState((prev) => ({
          ...prev,
          message: "Uploading processed content to server...",
          stage: "finalizing",
        }));

        const formData = enhancedVideoProcessor.prepareForUpload(result);

        // Add metadata
        formData.append("originalVideoName", originalVideoName);
        formData.append("contentType", result.contentType);
        formData.append("recommendedProcessing", result.recommendedProcessing);
        formData.append("duration", result.duration.toString());

        if (result.thumbnail) {
          formData.append("thumbnail", result.thumbnail);
        }

        if (result.metadata) {
          formData.append("metadata", JSON.stringify(result.metadata));
        }

        // Upload to server
        const response = await fetch("/api/video/process", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(
            `Server upload failed: ${response.status} ${response.statusText}`
          );
        }

        const serverResult = await response.json();

        setState((prev) => ({
          ...prev,
          message: "Video processing and upload completed successfully!",
          progress: 100,
        }));

        return serverResult;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Upload failed";

        setState((prev) => ({
          ...prev,
          error: errorMessage,
          message: "Upload to server failed",
        }));

        throw error;
      }
    },
    []
  );

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    cancelProcessing();
    // Dispose of processor resources
    enhancedVideoProcessor.dispose().catch(console.warn);
  }, [cancelProcessing]);

  return {
    ...state,
    processVideo,
    cancelProcessing,
    reset,
    uploadToServer,
    cleanup,
  };
}

// Export types for external use
export type { VideoAnalysisResult, ProcessingProgress };
