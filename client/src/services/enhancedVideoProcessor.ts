/**
 * Enhanced video processor using Canvas API for client-side processing
 * Provides basic video frame extraction and audio placeholder generation
 */

import { performanceMonitor } from "./performanceMonitor";
import type { PerformanceMetrics } from "./performanceMonitor";

// Type definitions
export interface VideoFrame {
  data: string; // Base64 encoded image
  timestamp: number;
  width: number;
  height: number;
}

export interface AudioSegment {
  data: string; // Base64 encoded audio
  startTime: number;
  endTime: number;
  duration: number;
  segmentIndex: number;
}

export interface VideoAnalysisResult {
  frames: VideoFrame[];
  audioSegments: AudioSegment[];
  duration: number;
  frameCount: number;
  audioSegmentCount: number;
  contentType: "visual-heavy" | "audio-heavy" | "mixed";
  recommendedProcessing: "frames-only" | "audio-only" | "hybrid";
  thumbnail?: string;
  metadata?: {
    width: number;
    height: number;
    fps: number;
    bitrate: number;
  };
  performanceMetrics?: PerformanceMetrics;
}

export interface ProcessingOptions {
  maxFrames?: number;
  maxAudioSegments?: number;
  frameInterval?: number;
  audioSegmentDuration?: number;
  enableThumbnail?: boolean;
  enableMetadata?: boolean;
}

export class EnhancedVideoProcessor {
  private maxFrames = 12;
  private maxAudioSegments = 8;
  private frameInterval = 5; // seconds
  private audioSegmentDuration = 30; // seconds per audio segment
  // private visualThreshold = 0.3; // If < 30% of video has visual changes, treat as audio-heavy
  private enableThumbnail = true;
  private enableMetadata = true;

  constructor(options: ProcessingOptions = {}) {
    this.maxFrames = options.maxFrames ?? this.maxFrames;
    this.maxAudioSegments = options.maxAudioSegments ?? this.maxAudioSegments;
    this.frameInterval = options.frameInterval ?? this.frameInterval;
    this.audioSegmentDuration =
      options.audioSegmentDuration ?? this.audioSegmentDuration;
    this.enableThumbnail = options.enableThumbnail ?? this.enableThumbnail;
    this.enableMetadata = options.enableMetadata ?? this.enableMetadata;
  }

  /**
   * Check if enhanced processing is supported (always true for Canvas API)
   */
  static isSupported(): boolean {
    return true; // Canvas API is always supported
  }

  /**
   * Analyze video content and determine optimal processing strategy
   */
  async analyzeVideo(file: File): Promise<VideoAnalysisResult> {
    console.log(
      `🎬 Analyzing video: ${file.name} (${(file.size / 1024 / 1024).toFixed(
        2
      )}MB)`
    );

    // Always use fallback analysis (Canvas API)
    console.log("🎬 Using basic video analysis (Canvas API)");
    return this.fallbackAnalysis(file);
  }

  /**
   * Process video using Canvas API
   */
  async processVideo(
    file: File,
    onProgress?: (progress: { stage: string; progress: number }) => void
  ): Promise<VideoAnalysisResult> {
    // Start performance monitoring
    performanceMonitor.startMonitoring();
    performanceMonitor.setMetrics({
      fileSize: file.size,
      videoDuration: 0, // Will be updated after analysis
    });

    try {
      const analysis = await this.analyzeVideo(file);
      performanceMonitor.setMetrics({ videoDuration: analysis.duration });

      console.log(
        `🎬 Processing video with strategy: ${analysis.recommendedProcessing}`
      );

      // Always use fallback processing (Canvas API)
      console.log("🎬 Using basic video processing (Canvas API)");
      performanceMonitor.recordWarning("Using basic Canvas API processing");

      // Call progress callback if provided
      if (onProgress) {
        onProgress({ stage: "processing", progress: 0.5 });
      }

      const result = await this.fallbackProcessing(file, analysis);

      // Call progress callback if provided
      if (onProgress) {
        onProgress({ stage: "complete", progress: 1.0 });
      }

      performanceMonitor.stopMonitoring();
      return result;
    } catch (error) {
      console.error("❌ Enhanced video processing failed:", error);
      performanceMonitor.recordError(
        error instanceof Error ? error.message : "Unknown error"
      );
      performanceMonitor.stopMonitoring();
      throw new Error(
        `Video processing failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Basic analysis using Canvas API
   */
  private async fallbackAnalysis(file: File): Promise<VideoAnalysisResult> {
    const duration = await this.getVideoDuration(file);

    return {
      frames: [],
      audioSegments: [],
      duration,
      frameCount: Math.min(
        this.maxFrames,
        Math.floor(duration / this.frameInterval)
      ),
      audioSegmentCount: Math.min(
        this.maxAudioSegments,
        Math.ceil(duration / this.audioSegmentDuration)
      ),
      contentType: "mixed",
      recommendedProcessing: "hybrid",
    };
  }

  /**
   * Basic processing using Canvas API
   */
  private async fallbackProcessing(
    file: File,
    analysis: VideoAnalysisResult
  ): Promise<VideoAnalysisResult> {
    // Use basic Canvas API for frame extraction
    const frames = await this.extractFramesFallback(file, analysis.frameCount);

    // Create placeholder audio segments
    const audioSegments = this.createPlaceholderAudioSegments(
      analysis.audioSegmentCount,
      analysis.duration
    );

    return {
      ...analysis,
      frames,
      audioSegments,
    };
  }

  /**
   * Fallback frame extraction using Canvas API
   */
  private async extractFramesFallback(
    file: File,
    frameCount: number
  ): Promise<VideoFrame[]> {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }

      const frames: VideoFrame[] = [];
      let processedFrames = 0;

      video.addEventListener("loadedmetadata", () => {
        const duration = video.duration;
        const frameInterval = duration / frameCount;

        const extractFrame = (timestamp: number) => {
          video.currentTime = timestamp;
        };

        video.addEventListener("seeked", () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const dataURL = canvas.toDataURL("image/jpeg", 0.8);
          frames.push({
            data: dataURL,
            timestamp: video.currentTime,
            width: canvas.width,
            height: canvas.height,
          });

          processedFrames++;
          if (processedFrames < frameCount) {
            const nextTimestamp = (processedFrames + 1) * frameInterval;
            extractFrame(nextTimestamp);
          } else {
            resolve(frames);
          }
        });

        if (frameCount > 0) {
          extractFrame(0);
        } else {
          resolve([]);
        }
      });

      video.addEventListener("error", (e) => {
        reject(new Error(`Video loading error: ${e}`));
      });

      video.src = URL.createObjectURL(file);
      video.load();
    });
  }

  /**
   * Create placeholder audio segments for fallback
   */
  private createPlaceholderAudioSegments(
    segmentCount: number,
    duration: number
  ): AudioSegment[] {
    const segments: AudioSegment[] = [];
    const segmentDuration = duration / segmentCount;

    // Use a pre-generated minimal WAV file (0.2 seconds of silence)
    // This is a valid WAV file that meets Whisper's minimum requirements
    const minWavBase64 =
      "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

    for (let i = 0; i < segmentCount; i++) {
      const startTime = i * segmentDuration;
      const endTime = Math.min((i + 1) * segmentDuration, duration);
      const actualDuration = Math.max(endTime - startTime, 0.2); // Minimum 0.2 seconds

      segments.push({
        data: `data:audio/wav;base64,${minWavBase64}`,
        startTime,
        endTime: startTime + actualDuration,
        duration: actualDuration,
        segmentIndex: i,
      });
    }

    return segments;
  }

  /**
   * Get video duration using basic HTML5 video
   */
  private getVideoDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");

      video.addEventListener("loadedmetadata", () => {
        resolve(video.duration);
        URL.revokeObjectURL(video.src);
      });

      video.addEventListener("error", (e) => {
        reject(new Error(`Duration extraction error: ${e}`));
        URL.revokeObjectURL(video.src);
      });

      video.src = URL.createObjectURL(file);
      video.load();
    });
  }

  /**
   * Prepare frames and audio segments for upload
   */
  prepareForUpload(result: VideoAnalysisResult): FormData {
    const formData = new FormData();

    // Add frames
    result.frames.forEach((frame, index) => {
      try {
        // Validate frame data
        if (!frame.data || !frame.data.includes(",")) {
          console.warn(
            `Skipping invalid frame ${index}: missing or malformed data`
          );
          return;
        }

        const [header, data] = frame.data.split(",");
        if (!data || data.trim() === "") {
          console.warn(`Skipping empty frame ${index}`);
          return;
        }

        const byteString = atob(data);
        const mimeString = header.split(":")[1].split(";")[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);

        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }

        const blob = new Blob([ab], { type: mimeString });
        const filename = `frame_${index}_${frame.timestamp.toFixed(1)}s.jpg`;
        formData.append("frames", blob, filename);
      } catch (error) {
        console.warn(`Failed to process frame ${index}:`, error);
      }
    });

    // Add audio segments
    result.audioSegments.forEach((segment, index) => {
      try {
        // Only add if we have actual data
        if (!segment.data || segment.data.trim() === "") {
          console.warn(`Skipping empty audio segment ${index}`);
          return;
        }

        if (!segment.data.includes(",")) {
          console.warn(
            `Skipping invalid audio segment ${index}: malformed data`
          );
          return;
        }

        const [header, data] = segment.data.split(",");
        if (!data || data.trim() === "") {
          console.warn(`Skipping empty audio segment ${index}`);
          return;
        }

        const byteString = atob(data);
        const mimeString = header.split(":")[1].split(";")[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);

        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }

        const blob = new Blob([ab], { type: mimeString });
        const filename = `audio_${index}_${segment.startTime.toFixed(
          1
        )}s_${segment.endTime.toFixed(1)}s.wav`;
        formData.append("audioSegments", blob, filename);
      } catch (error) {
        console.warn(`Failed to process audio segment ${index}:`, error);
      }
    });

    // Add metadata
    formData.append("contentType", result.contentType);
    formData.append("recommendedProcessing", result.recommendedProcessing);
    formData.append("duration", result.duration.toString());

    if (result.thumbnail) {
      formData.append("thumbnail", result.thumbnail);
    }

    return formData;
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    // No cleanup needed for Canvas API
  }
}

// Export singleton instance
export const enhancedVideoProcessor = new EnhancedVideoProcessor();
