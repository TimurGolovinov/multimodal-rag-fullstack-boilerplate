import { Request, Response } from "express";
import { VideoController } from "../../src/controllers/videoController";
import { DocumentService } from "../../src/services/documentService";
import { ImageProcessingService } from "../../src/services/imageProcessingService";
import { AudioProcessingService } from "../../src/services/audioProcessingService";

// Mock dependencies
jest.mock("../../src/services/documentService");
jest.mock("../../src/services/imageProcessingService");
jest.mock("../../src/services/audioProcessingService");

describe("VideoController", () => {
  let videoController: VideoController;
  let mockDocumentService: jest.Mocked<DocumentService>;
  let mockImageService: jest.Mocked<ImageProcessingService>;
  let mockAudioService: jest.Mocked<AudioProcessingService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock services
    mockDocumentService = {
      uploadDocument: jest.fn(),
      updateDocumentType: jest.fn(),
    } as any;

    mockImageService = {
      analyzeImage: jest.fn(),
    } as any;

    mockAudioService = {
      transcribeAudio: jest.fn(),
    } as any;

    // Create controller
    videoController = new VideoController(mockDocumentService);

    // Mock request and response
    mockRequest = {
      user: { userId: "test-user-id" },
      files: [],
      body: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe("processHybridVideo", () => {
    it("should process hybrid video successfully", async () => {
      // Arrange
      const mockFiles = [
        {
          fieldname: "frames",
          originalname: "frame1.jpg",
          buffer: Buffer.from("mock-image-data"),
          size: 1024,
          mimetype: "image/jpeg",
        },
        {
          fieldname: "audioSegments",
          originalname: "audio1.wav",
          buffer: Buffer.from("mock-audio-data"),
          size: 2048,
          mimetype: "audio/wav",
        },
      ] as Express.Multer.File[];

      mockRequest.files = mockFiles;
      mockRequest.body = {
        contentType: "mixed",
        recommendedProcessing: "hybrid",
        duration: 30,
        originalVideoName: "test-video.mp4",
      };

      const mockImageAnalysis = {
        description: "Test image description",
        extractedText: "Test text",
        confidence: 0.9,
      };

      const mockAudioAnalysis = {
        transcript: "Test audio transcript",
        confidence: 0.8,
      };

      const mockDocument = {
        id: "doc-123",
        filename: "test-video.txt",
        type: "text",
      };

      mockImageService.analyzeImage.mockResolvedValue(mockImageAnalysis);
      mockAudioService.transcribeAudio.mockResolvedValue(mockAudioAnalysis);
      mockDocumentService.uploadDocument.mockResolvedValue(mockDocument as any);

      // Act
      await videoController.processHybridVideo(
        mockRequest as any,
        mockResponse as any
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "Hybrid video processing completed successfully",
        document: {
          id: "doc-123",
          filename: "test-video.txt",
          type: "text",
        },
        frameCount: 1,
        audioSegmentCount: 1,
        successfulFrames: 1,
        successfulAudio: 1,
        contentType: "mixed",
        recommendedProcessing: "hybrid",
        analysis: {
          frames: expect.any(Array),
          audio: expect.any(Array),
        },
      });
    });

    it("should handle missing authentication", async () => {
      // Arrange
      mockRequest.user = undefined;

      // Act
      await videoController.processHybridVideo(
        mockRequest as any,
        mockResponse as any
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: "Unauthorized",
        message: "User authentication required",
      });
    });

    it("should handle missing originalVideoName", async () => {
      // Arrange
      mockRequest.body = {};

      // Act
      await videoController.processHybridVideo(
        mockRequest as any,
        mockResponse as any
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: "Missing required field",
        message: "originalVideoName is required",
      });
    });

    it("should handle no files provided", async () => {
      // Arrange
      mockRequest.files = [];
      mockRequest.body = {
        originalVideoName: "test-video.mp4",
      };

      // Act
      await videoController.processHybridVideo(
        mockRequest as any,
        mockResponse as any
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: "No files provided",
        message: "At least one frame or audio segment is required",
      });
    });

    it("should handle invalid file types", async () => {
      // Arrange
      mockRequest.files = [
        {
          fieldname: "invalid",
          originalname: "test.txt",
          buffer: Buffer.from("test"),
          size: 4,
          mimetype: "text/plain",
        },
      ] as Express.Multer.File[];

      mockRequest.body = {
        originalVideoName: "test-video.mp4",
      };

      // Act
      await videoController.processHybridVideo(
        mockRequest as any,
        mockResponse as any
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: "Invalid file types",
        message: "Only frame and audio segment files are allowed",
      });
    });

    it("should handle frame processing errors", async () => {
      // Arrange
      const mockFiles = [
        {
          fieldname: "frames",
          originalname: "frame1.jpg",
          buffer: Buffer.from("mock-image-data"),
          size: 1024,
          mimetype: "image/jpeg",
        },
      ] as Express.Multer.File[];

      mockRequest.files = mockFiles;
      mockRequest.body = {
        contentType: "visual-heavy",
        recommendedProcessing: "frames-only",
        duration: 30,
        originalVideoName: "test-video.mp4",
      };

      mockImageService.analyzeImage.mockRejectedValue(
        new Error("Image processing failed")
      );

      // Act
      await videoController.processHybridVideo(
        mockRequest as any,
        mockResponse as any
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: "Processing failed",
        message: "All frame and audio processing failed",
        details: expect.any(Array),
      });
    });

    it("should handle audio processing errors", async () => {
      // Arrange
      const mockFiles = [
        {
          fieldname: "audioSegments",
          originalname: "audio1.wav",
          buffer: Buffer.from("mock-audio-data"),
          size: 2048,
          mimetype: "audio/wav",
        },
      ] as Express.Multer.File[];

      mockRequest.files = mockFiles;
      mockRequest.body = {
        contentType: "audio-heavy",
        recommendedProcessing: "audio-only",
        duration: 30,
        originalVideoName: "test-video.mp4",
      };

      mockAudioService.transcribeAudio.mockRejectedValue(
        new Error("Audio processing failed")
      );

      // Act
      await videoController.processHybridVideo(
        mockRequest as any,
        mockResponse as any
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: "Processing failed",
        message: "All frame and audio processing failed",
        details: expect.any(Array),
      });
    });

    it("should handle partial processing success", async () => {
      // Arrange
      const mockFiles = [
        {
          fieldname: "frames",
          originalname: "frame1.jpg",
          buffer: Buffer.from("mock-image-data"),
          size: 1024,
          mimetype: "image/jpeg",
        },
        {
          fieldname: "audioSegments",
          originalname: "audio1.wav",
          buffer: Buffer.from("mock-audio-data"),
          size: 2048,
          mimetype: "audio/wav",
        },
      ] as Express.Multer.File[];

      mockRequest.files = mockFiles;
      mockRequest.body = {
        contentType: "mixed",
        recommendedProcessing: "hybrid",
        duration: 30,
        originalVideoName: "test-video.mp4",
      };

      const mockImageAnalysis = {
        description: "Test image description",
        extractedText: "Test text",
        confidence: 0.9,
      };

      const mockDocument = {
        id: "doc-123",
        filename: "test-video.txt",
        type: "text",
      };

      mockImageService.analyzeImage.mockResolvedValue(mockImageAnalysis);
      mockAudioService.transcribeAudio.mockRejectedValue(
        new Error("Audio processing failed")
      );
      mockDocumentService.uploadDocument.mockResolvedValue(mockDocument as any);

      // Act
      await videoController.processHybridVideo(
        mockRequest as any,
        mockResponse as any
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "Hybrid video processing completed successfully",
        document: {
          id: "doc-123",
          filename: "test-video.txt",
          type: "text",
        },
        frameCount: 1,
        audioSegmentCount: 1,
        successfulFrames: 1,
        successfulAudio: 0,
        contentType: "mixed",
        recommendedProcessing: "hybrid",
        analysis: {
          frames: expect.any(Array),
          audio: expect.any(Array),
        },
        warnings: expect.any(Array),
      });
    });

    it("should handle document upload errors", async () => {
      // Arrange
      const mockFiles = [
        {
          fieldname: "frames",
          originalname: "frame1.jpg",
          buffer: Buffer.from("mock-image-data"),
          size: 1024,
          mimetype: "image/jpeg",
        },
      ] as Express.Multer.File[];

      mockRequest.files = mockFiles;
      mockRequest.body = {
        contentType: "visual-heavy",
        recommendedProcessing: "frames-only",
        duration: 30,
        originalVideoName: "test-video.mp4",
      };

      const mockImageAnalysis = {
        description: "Test image description",
        extractedText: "Test text",
        confidence: 0.9,
      };

      mockImageService.analyzeImage.mockResolvedValue(mockImageAnalysis);
      mockDocumentService.uploadDocument.mockRejectedValue(
        new Error("Document upload failed")
      );

      // Act
      await videoController.processHybridVideo(
        mockRequest as any,
        mockResponse as any
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: "Hybrid video processing failed",
        message: "Internal server error",
        details: "Document upload failed",
      });
    });
  });

  describe("processVideo", () => {
    it("should process video frames successfully", async () => {
      // Arrange
      const mockFiles = [
        {
          fieldname: "frames",
          originalname: "frame1.jpg",
          buffer: Buffer.from("mock-image-data"),
          size: 1024,
          mimetype: "image/jpeg",
        },
        {
          fieldname: "frames",
          originalname: "frame2.jpg",
          buffer: Buffer.from("mock-image-data-2"),
          size: 1024,
          mimetype: "image/jpeg",
        },
      ] as Express.Multer.File[];

      mockRequest.files = {
        frames: mockFiles,
        audioSegments: [],
      };
      mockRequest.body = {
        originalVideoName: "test-video.mp4",
        contentType: "visual-heavy",
        recommendedProcessing: "frames-only",
        duration: 10,
      };

      const mockImageAnalysis = {
        description: "Test image description",
        extractedText: "Test text",
        confidence: 0.9,
      };

      const mockDocument = {
        id: "doc-123",
        filename: "test-video.txt",
        type: "text",
      };

      mockImageService.analyzeImage.mockResolvedValue(mockImageAnalysis);
      mockDocumentService.uploadDocument.mockResolvedValue(mockDocument as any);
      mockDocumentService.updateDocumentType.mockResolvedValue(true);

      // Act
      await videoController.processVideo(
        mockRequest as any,
        mockResponse as any
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "Hybrid video processing completed successfully",
        document: {
          id: "doc-123",
          filename: "test-video.txt",
          type: "video",
        },
        frameCount: 2,
        audioSegmentCount: 0,
        successfulFrames: 2,
        successfulAudio: 0,
        contentType: "visual-heavy",
        recommendedProcessing: "frames-only",
        analysis: expect.any(Object),
      });
    });

    it("should handle missing authentication", async () => {
      // Arrange
      mockRequest.user = undefined;

      // Act
      await videoController.processVideo(
        mockRequest as any,
        mockResponse as any
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: "Unauthorized",
        message: "User authentication required",
      });
    });

    it("should handle no frames provided", async () => {
      // Arrange
      mockRequest.files = [];

      // Act
      await videoController.processVideo(
        mockRequest as any,
        mockResponse as any
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: "No frames provided",
        message: "At least one frame is required",
      });
    });
  });

  describe("combineHybridAnalyses", () => {
    it("should combine analyses correctly for mixed content", () => {
      // Arrange
      const frameAnalyses = [
        {
          frameIndex: 0,
          filename: "frame1.jpg",
          analysis: "Test frame 1",
          extractedText: "Text 1",
          confidence: 0.9,
          type: "visual",
        },
      ];

      const audioAnalyses = [
        {
          segmentIndex: 0,
          filename: "audio1.wav",
          transcription: "Test audio 1",
          confidence: 0.8,
          type: "audio",
        },
      ];

      // Act
      const result = (videoController as any).combineHybridAnalyses(
        frameAnalyses,
        audioAnalyses,
        "mixed",
        30
      );

      // Assert
      expect(result).toContain("Hybrid Video Analysis - 30.0s duration");
      expect(result).toContain("Content Type: mixed");
      expect(result).toContain("Visual Frames: 1");
      expect(result).toContain("Audio Segments: 1");
      expect(result).toContain("=== AUDIO TRANSCRIPTION ===");
      expect(result).toContain("=== VISUAL ANALYSIS ===");
      expect(result).toContain("Test frame 1");
      expect(result).toContain("Test audio 1");
    });

    it("should handle audio-heavy content", () => {
      // Arrange
      const frameAnalyses: any[] = [];
      const audioAnalyses = [
        {
          segmentIndex: 0,
          filename: "audio1.wav",
          transcription: "Test audio 1",
          confidence: 0.8,
          type: "audio",
        },
      ];

      // Act
      const result = (videoController as any).combineHybridAnalyses(
        frameAnalyses,
        audioAnalyses,
        "audio-heavy",
        30
      );

      // Assert
      expect(result).toContain("Content Type: audio-heavy");
      expect(result).toContain("Visual Frames: 0");
      expect(result).toContain("Audio Segments: 1");
      expect(result).toContain("=== AUDIO TRANSCRIPTION ===");
      expect(result).not.toContain("=== VISUAL ANALYSIS ===");
    });

    it("should handle visual-heavy content", () => {
      // Arrange
      const frameAnalyses = [
        {
          frameIndex: 0,
          filename: "frame1.jpg",
          analysis: "Test frame 1",
          extractedText: "Text 1",
          confidence: 0.9,
          type: "visual",
        },
      ];
      const audioAnalyses: any[] = [];

      // Act
      const result = (videoController as any).combineHybridAnalyses(
        frameAnalyses,
        audioAnalyses,
        "visual-heavy",
        30
      );

      // Assert
      expect(result).toContain("Content Type: visual-heavy");
      expect(result).toContain("Visual Frames: 1");
      expect(result).toContain("Audio Segments: 0");
      expect(result).not.toContain("=== AUDIO TRANSCRIPTION ===");
      expect(result).toContain("=== VISUAL ANALYSIS ===");
    });
  });
});
