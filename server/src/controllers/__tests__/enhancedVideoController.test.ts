/**
 * Tests for EnhancedVideoController
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Request, Response } from "express";
import { EnhancedVideoController } from "../enhancedVideoController";
import { DocumentService } from "../../services/documentService";
import { ImageProcessingService } from "../../services/imageProcessingService";
import { AudioProcessingService } from "../../services/audioProcessingService";

// Mock services
vi.mock("../../services/documentService");
vi.mock("../../services/imageProcessingService");
vi.mock("../../services/audioProcessingService");

describe("EnhancedVideoController", () => {
  let controller: EnhancedVideoController;
  let mockDocumentService: any;
  let mockImageService: any;
  let mockAudioService: any;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock services
    mockDocumentService = {
      uploadDocument: vi.fn(),
      updateDocumentType: vi.fn(),
    };

    mockImageService = {
      analyzeImage: vi.fn(),
    };

    mockAudioService = {
      transcribeAudio: vi.fn(),
    };

    // Mock service constructors
    (DocumentService as any).mockImplementation(() => mockDocumentService);
    (ImageProcessingService as any).mockImplementation(() => mockImageService);
    (AudioProcessingService as any).mockImplementation(() => mockAudioService);

    controller = new EnhancedVideoController(mockDocumentService as any);

    // Mock request
    mockReq = {
      user: { userId: "test-user-id" },
      body: {
        contentType: "mixed",
        recommendedProcessing: "hybrid",
        duration: "60",
        originalVideoName: "test.mp4",
      },
      files: [
        {
          fieldname: "frames",
          originalname: "frame_0.jpg",
          buffer: Buffer.from("frame data"),
          size: 1024,
        },
        {
          fieldname: "audioSegments",
          originalname: "audio_0.wav",
          buffer: Buffer.from("audio data"),
          size: 2048,
        },
      ] as any,
    };

    // Mock response
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("processVideo", () => {
    it("should process video successfully", async () => {
      // Mock successful processing
      mockImageService.analyzeImage.mockResolvedValue({
        description: "Test frame analysis",
        extractedText: "Test text",
        confidence: 0.9,
      });

      mockAudioService.transcribeAudio.mockResolvedValue({
        transcript: "Test audio transcript",
        confidence: 0.8,
      });

      mockDocumentService.uploadDocument.mockResolvedValue({
        id: "doc-123",
        filename: "test.txt",
        type: "text",
      });

      await controller.processVideo(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "AI video processing completed successfully",
          document: {
            id: "doc-123",
            filename: "test.txt",
            type: "text",
          },
          summary: expect.objectContaining({
            frameCount: 1,
            audioSegmentCount: 1,
            successfulFrames: 1,
            successfulAudio: 1,
            processingTime: expect.any(Number),
          }),
        })
      );
    });

    it("should handle missing authentication", async () => {
      mockReq.user = undefined;

      await controller.processVideo(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Unauthorized",
        message: "User authentication required",
      });
    });

    it("should handle missing originalVideoName", async () => {
      mockReq.body = {
        contentType: "mixed",
        recommendedProcessing: "hybrid",
        duration: "60",
      };

      await controller.processVideo(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Missing required field: originalVideoName",
      });
    });

    it("should handle no files provided", async () => {
      mockReq.files = [];

      await controller.processVideo(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "No processed content provided",
      });
    });

    it("should handle invalid file types", async () => {
      mockReq.files = [
        {
          fieldname: "invalid",
          originalname: "test.txt",
          buffer: Buffer.from("data"),
          size: 1024,
        },
      ] as any;

      await controller.processVideo(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "No valid processed content found",
      });
    });

    it("should handle frame processing errors", async () => {
      mockImageService.analyzeImage.mockRejectedValue(
        new Error("Frame analysis failed")
      );
      mockAudioService.transcribeAudio.mockResolvedValue({
        transcript: "Test audio transcript",
        confidence: 0.8,
      });

      mockDocumentService.uploadDocument.mockResolvedValue({
        id: "doc-123",
        filename: "test.txt",
        type: "text",
      });

      await controller.processVideo(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          summary: expect.objectContaining({
            successfulFrames: 0,
            successfulAudio: 1,
          }),
          warnings: expect.arrayContaining([
            expect.stringContaining("Frame 1 AI analysis failed"),
          ]),
        })
      );
    });

    it("should handle audio processing errors", async () => {
      mockImageService.analyzeImage.mockResolvedValue({
        description: "Test frame analysis",
        extractedText: "Test text",
        confidence: 0.9,
      });
      mockAudioService.transcribeAudio.mockRejectedValue(
        new Error("Audio transcription failed")
      );

      mockDocumentService.uploadDocument.mockResolvedValue({
        id: "doc-123",
        filename: "test.txt",
        type: "text",
      });

      await controller.processVideo(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          summary: expect.objectContaining({
            successfulFrames: 1,
            successfulAudio: 0,
          }),
          warnings: expect.arrayContaining([
            expect.stringContaining("Audio segment 1 AI transcription failed"),
          ]),
        })
      );
    });

    it("should handle all processing failures", async () => {
      mockImageService.analyzeImage.mockRejectedValue(
        new Error("Frame analysis failed")
      );
      mockAudioService.transcribeAudio.mockRejectedValue(
        new Error("Audio transcription failed")
      );

      await controller.processVideo(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(422);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "All AI processing failed",
        warnings: expect.arrayContaining([
          expect.stringContaining("Frame 1 AI analysis failed"),
          expect.stringContaining("Audio segment 1 AI transcription failed"),
        ]),
      });
    });

    it("should handle document upload errors", async () => {
      mockImageService.analyzeImage.mockResolvedValue({
        description: "Test frame analysis",
        extractedText: "Test text",
        confidence: 0.9,
      });

      mockAudioService.transcribeAudio.mockResolvedValue({
        transcript: "Test audio transcript",
        confidence: 0.8,
      });

      mockDocumentService.uploadDocument.mockRejectedValue(
        new Error("Upload failed")
      );

      await controller.processVideo(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "AI processing failed",
          message: "Internal server error",
        })
      );
    });

    it("should handle timeout errors", async () => {
      mockImageService.analyzeImage.mockRejectedValue(
        new Error("timeout occurred")
      );

      await controller.processVideo(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(408);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "AI processing failed",
          message: "AI processing timeout - content may be too complex",
        })
      );
    });

    it("should handle memory errors", async () => {
      mockImageService.analyzeImage.mockRejectedValue(
        new Error("memory limit exceeded")
      );

      await controller.processVideo(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(413);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "AI processing failed",
          message: "Content too large for AI processing",
        })
      );
    });

    it("should handle API errors", async () => {
      mockImageService.analyzeImage.mockRejectedValue(
        new Error("API service unavailable")
      );

      await controller.processVideo(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(502);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "AI processing failed",
          message: "AI service unavailable",
        })
      );
    });

    it("should process frames-only content", async () => {
      mockReq.files = [
        {
          fieldname: "frames",
          originalname: "frame_0.jpg",
          buffer: Buffer.from("frame data"),
          size: 1024,
        },
      ] as any;

      mockImageService.analyzeImage.mockResolvedValue({
        description: "Test frame analysis",
        extractedText: "Test text",
        confidence: 0.9,
      });

      mockDocumentService.uploadDocument.mockResolvedValue({
        id: "doc-123",
        filename: "test.txt",
        type: "text",
      });

      await controller.processVideo(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: expect.objectContaining({
            frameCount: 1,
            audioSegmentCount: 0,
            successfulFrames: 1,
            successfulAudio: 0,
          }),
        })
      );
    });

    it("should process audio-only content", async () => {
      mockReq.files = [
        {
          fieldname: "audioSegments",
          originalname: "audio_0.wav",
          buffer: Buffer.from("audio data"),
          size: 2048,
        },
      ] as any;

      mockAudioService.transcribeAudio.mockResolvedValue({
        transcript: "Test audio transcript",
        confidence: 0.8,
      });

      mockDocumentService.uploadDocument.mockResolvedValue({
        id: "doc-123",
        filename: "test.txt",
        type: "text",
      });

      await controller.processVideo(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: expect.objectContaining({
            frameCount: 0,
            audioSegmentCount: 1,
            successfulFrames: 0,
            successfulAudio: 1,
          }),
        })
      );
    });

    it("should include metadata in response", async () => {
      mockReq.body.metadata = JSON.stringify({
        width: 1920,
        height: 1080,
        fps: 30,
        bitrate: 5000000,
      });

      mockImageService.analyzeImage.mockResolvedValue({
        description: "Test frame analysis",
        extractedText: "Test text",
        confidence: 0.9,
      });

      mockDocumentService.uploadDocument.mockResolvedValue({
        id: "doc-123",
        filename: "test.txt",
        type: "text",
      });

      await controller.processVideo(mockReq as any, mockRes as any);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            contentType: "mixed",
            recommendedProcessing: "hybrid",
            duration: "01:00",
            thumbnail: false,
          }),
        })
      );
    });
  });
});
