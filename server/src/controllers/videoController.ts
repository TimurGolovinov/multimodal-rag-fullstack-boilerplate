import { Request, Response } from "express";
import { DocumentService } from "../services/documentService";
import { ImageProcessingService } from "../services/imageProcessingService";
import { AudioProcessingService } from "../services/audioProcessingService";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

export class VideoController {
  private documentService: DocumentService;
  private imageService: ImageProcessingService;
  private audioService: AudioProcessingService;

  constructor(documentService: DocumentService) {
    this.documentService = documentService;
    this.imageService = new ImageProcessingService();
    this.audioService = new AudioProcessingService();
  }

  /**
   * Process video content (frames + audio segments) with timecodes
   */
  async processVideo(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      // Validate request body
      const contentType = req.body.contentType || "mixed";
      const recommendedProcessing = req.body.recommendedProcessing || "hybrid";
      const duration = parseFloat(req.body.duration) || 0;
      const originalVideoName = req.body.originalVideoName;

      if (!originalVideoName) {
        res.status(400).json({
          success: false,
          error: "Missing required field",
          message: "originalVideoName is required",
        });
        return;
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
        res.status(400).json({
          success: false,
          error: "No files provided",
          message: "At least one frame or audio segment is required",
        });
        return;
      }

      if (filesArray.length === 0) {
        res.status(400).json({
          success: false,
          error: "No files provided",
          message: "At least one frame or audio segment is required",
        });
        return;
      }

      const audioFiles = filesArray.filter(
        (f) => f.fieldname === "audioSegments"
      );
      const frameFiles = filesArray.filter((f) => f.fieldname === "frames");

      if (frameFiles.length === 0 && audioFiles.length === 0) {
        res.status(400).json({
          success: false,
          error: "Invalid file types",
          message: "Only frame and audio segment files are allowed",
        });
        return;
      }

      console.log(
        `🎬 Processing hybrid video: ${frameFiles.length} frames, ${audioFiles.length} audio segments`
      );
      console.log(
        `📊 Content type: ${contentType}, processing: ${recommendedProcessing}`
      );

      let frameAnalyses: any[] = [];
      let audioAnalyses: any[] = [];
      let processingErrors: string[] = [];

      // Process frames if present
      if (frameFiles.length > 0) {
        const frameResults = await Promise.allSettled(
          frameFiles.map(async (file, index) => {
            try {
              // Validate frame file
              if (!file.buffer || file.buffer.length === 0) {
                throw new Error("Empty frame file");
              }

              if (file.size > 10 * 1024 * 1024) {
                // 10MB limit per frame
                throw new Error("Frame file too large");
              }

              const analysis = await this.imageService.analyzeImage(
                file.buffer,
                file.originalname
              );

              console.log(
                `📸 Processed frame ${index + 1}/${frameFiles.length}`
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
              const errorMessage = `Frame ${index + 1} processing failed: ${
                error instanceof Error ? error.message : "Unknown error"
              }`;
              console.error(`❌ ${errorMessage}`);
              processingErrors.push(errorMessage);

              return {
                frameIndex: index,
                filename: file.originalname,
                analysis: "Frame analysis failed",
                extractedText: "",
                confidence: 0,
                type: "visual",
                error: errorMessage,
              };
            }
          })
        );

        frameAnalyses = frameResults.map((result) =>
          result.status === "fulfilled" ? result.value : result.reason
        );
      }

      // Process audio segments if present
      if (audioFiles.length > 0) {
        const audioResults = await Promise.allSettled(
          audioFiles.map(async (file, index) => {
            try {
              // Validate audio file
              if (!file.buffer || file.buffer.length === 0) {
                throw new Error("Empty audio file");
              }

              if (file.size > 50 * 1024 * 1024) {
                // 50MB limit per audio segment
                throw new Error("Audio file too large");
              }

              const analysis = await this.audioService.transcribeAudio(
                file.buffer,
                file.originalname
              );

              console.log(
                `🎵 Processed audio segment ${index + 1}/${audioFiles.length}`
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
              } processing failed: ${
                error instanceof Error ? error.message : "Unknown error"
              }`;
              console.error(`❌ ${errorMessage}`);
              processingErrors.push(errorMessage);

              return {
                segmentIndex: index,
                filename: file.originalname,
                transcription: "Audio transcription failed",
                confidence: 0,
                type: "audio",
                error: errorMessage,
              };
            }
          })
        );

        audioAnalyses = audioResults.map((result) =>
          result.status === "fulfilled" ? result.value : result.reason
        );
      }

      // Check if we have any successful processing
      const successfulFrames = frameAnalyses.filter((f) => f.confidence > 0);
      const successfulAudio = audioAnalyses.filter((a) => a.confidence > 0);

      if (successfulFrames.length === 0 && successfulAudio.length === 0) {
        res.status(422).json({
          success: false,
          error: "Processing failed",
          message: "All frame and audio processing failed",
          details: processingErrors,
        });
        return;
      }

      // Combine all analyses into a single text content
      const combinedContent = this.combineHybridAnalyses(
        frameAnalyses,
        audioAnalyses,
        contentType,
        duration
      );

      // Create a text document with the combined content but preserve video metadata
      const textFile: Express.Multer.File = {
        fieldname: "document",
        originalname: originalVideoName.replace(/\.[^/.]+$/, ".txt"),
        encoding: "7bit",
        mimetype: "text/plain",
        buffer: Buffer.from(combinedContent, "utf-8"),
        size: Buffer.byteLength(combinedContent, "utf-8"),
      } as Express.Multer.File;

      // Upload the text document to the document service
      const document = await this.documentService.uploadDocument(
        textFile,
        userId
      );

      // Update the document to show as video type in UI while keeping text content
      await this.documentService.updateDocumentType(document.id, "video");

      res.json({
        success: true,
        message: "Hybrid video processing completed successfully",
        document: {
          id: document.id,
          filename: document.filename,
          type: document.type,
        },
        frameCount: frameFiles.length,
        audioSegmentCount: audioFiles.length,
        successfulFrames: successfulFrames.length,
        successfulAudio: successfulAudio.length,
        contentType,
        recommendedProcessing,
        analysis: {
          frames: frameAnalyses,
          audio: audioAnalyses,
        },
        warnings: processingErrors.length > 0 ? processingErrors : undefined,
      });
    } catch (error) {
      console.error("❌ Hybrid video processing failed:", error);

      // Determine appropriate error response
      let statusCode = 500;
      let errorMessage = "Internal server error";

      if (error instanceof Error) {
        if (error.message.includes("timeout")) {
          statusCode = 408;
          errorMessage =
            "Processing timeout - video may be too large or complex";
        } else if (error.message.includes("memory")) {
          statusCode = 413;
          errorMessage = "Video too large for processing";
        } else if (error.message.includes("format")) {
          statusCode = 415;
          errorMessage = "Unsupported video format";
        }
      }

      res.status(statusCode).json({
        success: false,
        error: "Hybrid video processing failed",
        message: errorMessage,
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private combineHybridAnalyses(
    frameAnalyses: any[],
    audioAnalyses: any[],
    contentType: string,
    duration: number
  ): string {
    let content = `VIDEO ANALYSIS REPORT\n`;
    content += `Duration: ${this.formatTime(duration)}\n`;
    content += `Content Type: ${contentType}\n`;
    content += `Visual Frames: ${frameAnalyses.length}\n`;
    content += `Audio Segments: ${audioAnalyses.length}\n\n`;

    // Create a timeline by combining all content with timecodes
    const timeline: Array<{
      timestamp: number;
      type: "visual" | "audio";
      content: string;
      confidence: number;
      filename: string;
    }> = [];

    // Add frame analyses with timecodes
    frameAnalyses.forEach((frame, index) => {
      // Estimate timestamp based on frame index (assuming 5-second intervals)
      const timestamp = frame.frameIndex * 5;
      timeline.push({
        timestamp,
        type: "visual",
        content:
          frame.analysis +
          (frame.extractedText
            ? `\nExtracted Text: ${frame.extractedText}`
            : ""),
        confidence: frame.confidence,
        filename: frame.filename,
      });
    });

    // Add audio analyses with timecodes
    audioAnalyses.forEach((segment, index) => {
      // Use actual segment timing if available, otherwise estimate
      const timestamp = segment.segmentIndex * 30; // Assuming 30-second segments
      timeline.push({
        timestamp,
        type: "audio",
        content: segment.transcription,
        confidence: segment.confidence,
        filename: segment.filename,
      });
    });

    // Sort timeline by timestamp
    timeline.sort((a, b) => a.timestamp - b.timestamp);

    // Generate timeline content
    content += `=== TIMELINE ===\n\n`;
    timeline.forEach((item, index) => {
      const timeStr = this.formatTime(item.timestamp);
      content += `[${timeStr}] ${item.type.toUpperCase()}: ${item.filename}\n`;
      content += `${item.content}\n`;
      content += `Confidence: ${item.confidence}\n\n`;
    });

    // Add detailed sections for reference
    if (contentType === "audio-heavy" || contentType === "mixed") {
      content += `=== AUDIO TRANSCRIPTION DETAILS ===\n\n`;
      audioAnalyses.forEach((segment, index) => {
        const timeStr = this.formatTime(segment.segmentIndex * 30);
        content += `[${timeStr}] Audio Segment ${index + 1}:\n`;
        content += `${segment.transcription}\n`;
        content += `Confidence: ${segment.confidence}\n\n`;
      });
    }

    if (contentType === "visual-heavy" || contentType === "mixed") {
      content += `=== VISUAL ANALYSIS DETAILS ===\n\n`;
      frameAnalyses.forEach((frame, index) => {
        const timeStr = this.formatTime(frame.frameIndex * 5);
        content += `[${timeStr}] Frame ${index + 1}:\n`;
        content += `${frame.analysis}\n`;
        if (frame.extractedText) {
          content += `Extracted Text: ${frame.extractedText}\n`;
        }
        content += `Confidence: ${frame.confidence}\n\n`;
      });
    }

    // Add summary
    content += `=== SUMMARY ===\n`;
    content += `Total duration: ${this.formatTime(duration)}\n`;
    content += `Content type: ${contentType}\n`;
    content += `Processing strategy: ${
      frameAnalyses.length > 0 && audioAnalyses.length > 0
        ? "Hybrid (Visual + Audio)"
        : frameAnalyses.length > 0
        ? "Visual-only"
        : "Audio-only"
    }\n`;
    content += `Timeline entries: ${timeline.length}\n`;

    return content.trim();
  }

  /**
   * Format time in MM:SS format
   */
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
}
