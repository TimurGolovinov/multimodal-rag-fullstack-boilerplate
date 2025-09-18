/**
 * Enhanced video controller focused on AI processing only
 * Handles pre-processed video content from frontend FFmpeg processing
 */

import { Request, Response } from "express";
import { DocumentService } from "../services/documentService";
import { ImageProcessingService } from "../services/imageProcessingService";
import { AudioProcessingService } from "../services/audioProcessingService";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

interface ProcessedVideoRequest {
  contentType: "visual-heavy" | "audio-heavy" | "mixed";
  recommendedProcessing: "frames-only" | "audio-only" | "hybrid";
  duration: number;
  originalVideoName: string;
  thumbnail?: string;
  metadata?: {
    width: number;
    height: number;
    fps: number;
    bitrate: number;
  };
}

interface ProcessingResult {
  success: boolean;
  document?: {
    id: string;
    filename: string;
    type: string;
  };
  analysis?: {
    frames: any[];
    audio: any[];
  };
  summary?: {
    frameCount: number;
    audioSegmentCount: number;
    successfulFrames: number;
    successfulAudio: number;
    processingTime: number;
  };
  warnings?: string[];
  error?: string;
}

export class EnhancedVideoController {
  private documentService: DocumentService;
  private imageService: ImageProcessingService;
  private audioService: AudioProcessingService;

  constructor(documentService: DocumentService) {
    this.documentService = documentService;
    this.imageService = new ImageProcessingService();
    this.audioService = new AudioProcessingService();
  }

  /**
   * Process pre-processed video content with AI analysis
   * Frontend handles all video processing, backend only does AI
   */
  async processVideo(req: AuthenticatedRequest, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: "Unauthorized",
          message: "User authentication required",
        });
        return;
      }

      // Validate and parse request
      const requestData = this.validateRequest(req);
      if (!requestData.success) {
        res.status(400).json(requestData);
        return;
      }

      const {
        contentType,
        recommendedProcessing,
        duration,
        originalVideoName,
        thumbnail,
        metadata,
      } = requestData.data!;
      const files = req.files as
        | Express.Multer.File[]
        | { [fieldname: string]: Express.Multer.File[] };

      // Handle both array format and object format from multer
      let filesArray: Express.Multer.File[];
      if (Array.isArray(files)) {
        filesArray = files;
      } else if (files && typeof files === "object") {
        // Convert object format to array
        filesArray = Object.values(files).flat();
      } else {
        filesArray = [];
      }

      console.log(
        `🤖 AI Processing: ${
          filesArray.filter((f) => f.fieldname === "frames").length
        } frames, ${
          filesArray.filter((f) => f.fieldname === "audioSegments").length
        } audio segments`
      );
      console.log(
        `📊 Content type: ${contentType}, strategy: ${recommendedProcessing}`
      );

      // Process content based on strategy
      const result = await this.processContent(
        filesArray,
        contentType,
        recommendedProcessing,
        duration
      );

      if (!result.success) {
        res.status(422).json(result);
        return;
      }

      // Create document with processed content
      const document = await this.createDocument(
        result.analysis!,
        originalVideoName,
        duration,
        contentType,
        thumbnail,
        metadata,
        userId
      );

      const processingTime = Date.now() - startTime;

      res.json({
        success: true,
        message: "AI video processing completed successfully",
        document: {
          id: document.id,
          filename: document.filename,
          type: document.type,
        },
        summary: {
          frameCount: filesArray.filter((f) => f.fieldname === "frames").length,
          audioSegmentCount: filesArray.filter(
            (f) => f.fieldname === "audioSegments"
          ).length,
          successfulFrames: result.analysis!.frames.filter(
            (f) => f.confidence > 0
          ).length,
          successfulAudio: result.analysis!.audio.filter(
            (a) => a.confidence > 0
          ).length,
          processingTime,
        },
        analysis: result.analysis,
        warnings: result.warnings,
        metadata: {
          contentType,
          recommendedProcessing,
          duration: this.formatDuration(duration),
          thumbnail: !!thumbnail,
        },
      });
    } catch (error) {
      console.error("❌ AI video processing failed:", error);

      const processingTime = Date.now() - startTime;
      const errorResponse = this.handleProcessingError(error, processingTime);

      res.status(errorResponse.statusCode).json(errorResponse);
    }
  }

  /**
   * Validate incoming request
   */
  private validateRequest(req: AuthenticatedRequest): {
    success: boolean;
    data?: ProcessedVideoRequest;
    error?: string;
  } {
    const contentType = req.body.contentType || "mixed";
    const recommendedProcessing = req.body.recommendedProcessing || "hybrid";
    const duration = parseFloat(req.body.duration) || 0;
    const originalVideoName = req.body.originalVideoName;

    if (!originalVideoName) {
      return {
        success: false,
        error: "Missing required field: originalVideoName",
      };
    }

    const files = req.files as
      | Express.Multer.File[]
      | { [fieldname: string]: Express.Multer.File[] };

    // Handle both array format and object format from multer
    let filesArray: Express.Multer.File[];
    if (Array.isArray(files)) {
      filesArray = files;
    } else if (files && typeof files === "object") {
      // Convert object format to array
      filesArray = Object.values(files).flat();
    } else {
      return {
        success: false,
        error: "No processed content provided",
      };
    }

    if (filesArray.length === 0) {
      return {
        success: false,
        error: "No processed content provided",
      };
    }

    const audioFiles = filesArray.filter(
      (f) => f.fieldname === "audioSegments"
    );
    const frameFiles = filesArray.filter((f) => f.fieldname === "frames");

    if (frameFiles.length === 0 && audioFiles.length === 0) {
      return {
        success: false,
        error: "No valid processed content found",
      };
    }

    return {
      success: true,
      data: {
        contentType,
        recommendedProcessing,
        duration,
        originalVideoName,
        thumbnail: req.body.thumbnail,
        metadata: req.body.metadata ? JSON.parse(req.body.metadata) : undefined,
      },
    };
  }

  /**
   * Process content with AI services
   */
  private async processContent(
    files: Express.Multer.File[],
    contentType: string,
    recommendedProcessing: string,
    duration: number
  ): Promise<ProcessingResult> {
    const audioFiles = files.filter((f) => f.fieldname === "audioSegments");
    const frameFiles = files.filter((f) => f.fieldname === "frames");

    let frameAnalyses: any[] = [];
    let audioAnalyses: any[] = [];
    let processingErrors: string[] = [];

    // Process frames if present
    if (frameFiles.length > 0) {
      const frameResults = await this.processFrames(frameFiles);
      frameAnalyses = frameResults.analyses;
      processingErrors.push(...frameResults.errors);
    }

    // Process audio if present
    if (audioFiles.length > 0) {
      const audioResults = await this.processAudio(audioFiles);
      audioAnalyses = audioResults.analyses;
      processingErrors.push(...audioResults.errors);
    }

    // Check if we have any successful processing
    const successfulFrames = frameAnalyses.filter((f) => f.confidence > 0);
    const successfulAudio = audioAnalyses.filter((a) => a.confidence > 0);

    if (successfulFrames.length === 0 && successfulAudio.length === 0) {
      return {
        success: false,
        error: "All AI processing failed",
        warnings: processingErrors,
      };
    }

    return {
      success: true,
      analysis: {
        frames: frameAnalyses,
        audio: audioAnalyses,
      },
      warnings: processingErrors.length > 0 ? processingErrors : undefined,
    };
  }

  /**
   * Process frames with AI analysis
   */
  private async processFrames(
    files: Express.Multer.File[]
  ): Promise<{ analyses: any[]; errors: string[] }> {
    const analyses: any[] = [];
    const errors: string[] = [];

    const results = await Promise.allSettled(
      files.map(async (file, index) => {
        try {
          // Validate frame file
          if (!file.buffer || file.buffer.length === 0) {
            throw new Error("Empty frame file");
          }

          if (file.size > 10 * 1024 * 1024) {
            // 10MB limit
            throw new Error("Frame file too large");
          }

          const analysis = await this.imageService.analyzeImage(
            file.buffer,
            file.originalname
          );

          return {
            frameIndex: index,
            filename: file.originalname,
            analysis: analysis.description,
            extractedText: analysis.extractedText,
            confidence: analysis.confidence,
            type: "visual",
          };
        } catch (error) {
          const errorMessage = `Frame ${index + 1} AI analysis failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`;
          errors.push(errorMessage);

          return {
            frameIndex: index,
            filename: file.originalname,
            analysis: "AI analysis failed",
            extractedText: "",
            confidence: 0,
            type: "visual",
            error: errorMessage,
          };
        }
      })
    );

    results.forEach((result) => {
      analyses.push(
        result.status === "fulfilled" ? result.value : result.reason
      );
    });

    return { analyses, errors };
  }

  /**
   * Process audio segments with AI transcription
   */
  private async processAudio(
    files: Express.Multer.File[]
  ): Promise<{ analyses: any[]; errors: string[] }> {
    const analyses: any[] = [];
    const errors: string[] = [];

    const results = await Promise.allSettled(
      files.map(async (file, index) => {
        try {
          // Validate audio file
          if (!file.buffer || file.buffer.length === 0) {
            throw new Error("Empty audio file");
          }

          if (file.size > 50 * 1024 * 1024) {
            // 50MB limit
            throw new Error("Audio file too large");
          }

          const analysis = await this.audioService.transcribeAudio(
            file.buffer,
            file.originalname
          );

          return {
            segmentIndex: index,
            filename: file.originalname,
            transcription: analysis.transcript,
            confidence: analysis.confidence,
            type: "audio",
          };
        } catch (error) {
          const errorMessage = `Audio segment ${
            index + 1
          } AI transcription failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`;
          errors.push(errorMessage);

          return {
            segmentIndex: index,
            filename: file.originalname,
            transcription: "AI transcription failed",
            confidence: 0,
            type: "audio",
            error: errorMessage,
          };
        }
      })
    );

    results.forEach((result) => {
      analyses.push(
        result.status === "fulfilled" ? result.value : result.reason
      );
    });

    return { analyses, errors };
  }

  /**
   * Create document with processed content
   */
  private async createDocument(
    analysis: { frames: any[]; audio: any[] },
    originalVideoName: string,
    duration: number,
    contentType: string,
    thumbnail: string | undefined,
    metadata: any,
    userId: string
  ) {
    const combinedContent = this.generateContentReport(
      analysis,
      duration,
      contentType,
      metadata
    );

    // Create text document with the combined content
    const textFile: Express.Multer.File = {
      fieldname: "document",
      originalname: originalVideoName.replace(/\.[^/.]+$/, ".txt"),
      encoding: "7bit",
      mimetype: "text/plain",
      buffer: Buffer.from(combinedContent, "utf-8"),
      size: Buffer.byteLength(combinedContent, "utf-8"),
    } as Express.Multer.File;

    // Upload the text document
    const document = await this.documentService.uploadDocument(
      textFile,
      userId
    );

    // Update document type to video for UI display
    await this.documentService.updateDocumentType(document.id, "video");

    return document;
  }

  /**
   * Generate comprehensive content report
   */
  private generateContentReport(
    analysis: { frames: any[]; audio: any[] },
    duration: number,
    contentType: string,
    metadata: any
  ): string {
    let content = `ENHANCED VIDEO ANALYSIS REPORT\n`;
    content += `Generated: ${new Date().toISOString()}\n`;
    content += `Duration: ${this.formatDuration(duration)}\n`;
    content += `Content Type: ${contentType}\n`;
    content += `Visual Frames: ${analysis.frames.length}\n`;
    content += `Audio Segments: ${analysis.audio.length}\n`;

    if (metadata) {
      content += `Resolution: ${metadata.width}x${metadata.height}\n`;
      content += `FPS: ${metadata.fps}\n`;
      content += `Bitrate: ${metadata.bitrate} bps\n`;
    }

    content += `\n=== AI ANALYSIS SUMMARY ===\n\n`;

    // Visual analysis summary
    if (analysis.frames.length > 0) {
      content += `VISUAL CONTENT:\n`;
      const successfulFrames = analysis.frames.filter((f) => f.confidence > 0);
      content += `Successfully analyzed: ${successfulFrames.length}/${analysis.frames.length} frames\n\n`;

      successfulFrames.forEach((frame, index) => {
        const timestamp = frame.frameIndex * 5; // Assuming 5-second intervals
        content += `[${this.formatTime(timestamp)}] Frame ${index + 1}:\n`;
        content += `${frame.analysis}\n`;
        if (frame.extractedText) {
          content += `Extracted Text: ${frame.extractedText}\n`;
        }
        content += `Confidence: ${frame.confidence}\n\n`;
      });
    }

    // Audio analysis summary
    if (analysis.audio.length > 0) {
      content += `AUDIO CONTENT:\n`;
      const successfulAudio = analysis.audio.filter((a) => a.confidence > 0);
      content += `Successfully transcribed: ${successfulAudio.length}/${analysis.audio.length} segments\n\n`;

      successfulAudio.forEach((segment, index) => {
        const timestamp = segment.segmentIndex * 30; // Assuming 30-second segments
        content += `[${this.formatTime(timestamp)}] Audio Segment ${
          index + 1
        }:\n`;
        content += `${segment.transcription}\n`;
        content += `Confidence: ${segment.confidence}\n\n`;
      });
    }

    content += `=== PROCESSING NOTES ===\n`;
    content += `This content was processed using client-side FFmpeg.wasm for video extraction\n`;
    content += `and server-side AI services for analysis and transcription.\n`;
    content += `Processing strategy: ${
      contentType === "audio-heavy"
        ? "Audio-focused"
        : contentType === "visual-heavy"
        ? "Visual-focused"
        : "Hybrid"
    }\n`;

    return content.trim();
  }

  /**
   * Handle processing errors
   */
  private handleProcessingError(
    error: any,
    processingTime: number
  ): {
    statusCode: number;
    success: boolean;
    error: string;
    message: string;
    processingTime: number;
  } {
    let statusCode = 500;
    let errorMessage = "Internal server error";

    if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        statusCode = 408;
        errorMessage = "AI processing timeout - content may be too complex";
      } else if (error.message.includes("memory")) {
        statusCode = 413;
        errorMessage = "Content too large for AI processing";
      } else if (error.message.includes("API")) {
        statusCode = 502;
        errorMessage = "AI service unavailable";
      }
    }

    return {
      statusCode,
      success: false,
      error: "AI processing failed",
      message: errorMessage,
      processingTime,
    };
  }

  /**
   * Format duration in MM:SS format
   */
  private formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }

  /**
   * Format time in MM:SS format
   */
  private formatTime(seconds: number): string {
    return this.formatDuration(seconds);
  }
}
