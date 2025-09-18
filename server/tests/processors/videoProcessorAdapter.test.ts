import { VideoProcessorAdapter } from "../../src/services/processors/videoProcessorAdapter";
import { VideoProcessingService } from "../../src/services/videoProcessingService";

// Mock VideoProcessingService
jest.mock("../../src/services/videoProcessingService");
const MockedVideoProcessingService = VideoProcessingService as jest.MockedClass<
  typeof VideoProcessingService
>;

describe("VideoProcessorAdapter", () => {
  let processor: VideoProcessorAdapter;
  let mockVideoService: jest.Mocked<VideoProcessingService>;
  let mockBuffer: Buffer;

  beforeEach(() => {
    jest.clearAllMocks();

    mockBuffer = Buffer.from("mock video content");

    mockVideoService = {
      extractTextFromVideo: jest.fn(),
    } as any;

    MockedVideoProcessingService.mockImplementation(() => mockVideoService);
    processor = new VideoProcessorAdapter();
  });

  describe("canProcess", () => {
    it("should return true for video MIME types", () => {
      expect(processor.canProcess("video/mp4", "test.mp4")).toBe(true);
      expect(processor.canProcess("video/quicktime", "test.mov")).toBe(true);
      expect(processor.canProcess("video/x-msvideo", "test.avi")).toBe(true);
      expect(processor.canProcess("video/webm", "test.webm")).toBe(true);
      expect(processor.canProcess("video/x-matroska", "test.mkv")).toBe(true);
    });

    it("should return true for video file extensions", () => {
      expect(processor.canProcess("application/octet-stream", "test.mp4")).toBe(
        true
      );
      expect(processor.canProcess("application/octet-stream", "test.mov")).toBe(
        true
      );
      expect(processor.canProcess("application/octet-stream", "test.avi")).toBe(
        true
      );
      expect(
        processor.canProcess("application/octet-stream", "test.webm")
      ).toBe(true);
      expect(processor.canProcess("application/octet-stream", "test.mkv")).toBe(
        true
      );
      expect(processor.canProcess("application/octet-stream", "test.flv")).toBe(
        true
      );
      expect(processor.canProcess("application/octet-stream", "test.wmv")).toBe(
        true
      );
      expect(processor.canProcess("application/octet-stream", "test.m4v")).toBe(
        true
      );
      expect(processor.canProcess("application/octet-stream", "test.3gp")).toBe(
        true
      );
      expect(processor.canProcess("application/octet-stream", "test.ogv")).toBe(
        true
      );
    });

    it("should return false for non-video files", () => {
      expect(processor.canProcess("image/jpeg", "test.jpg")).toBe(false);
      expect(processor.canProcess("audio/mp3", "test.mp3")).toBe(false);
      expect(processor.canProcess("text/plain", "test.txt")).toBe(false);
      expect(processor.canProcess("application/pdf", "test.pdf")).toBe(false);
    });

    it("should handle case-insensitive file extensions", () => {
      expect(processor.canProcess("video/mp4", "test.MP4")).toBe(true);
      expect(processor.canProcess("video/mp4", "test.Mp4")).toBe(true);
      expect(processor.canProcess("video/mp4", "test.mp4")).toBe(true);
    });

    it("should return false for files without extensions", () => {
      expect(processor.canProcess("video/mp4", "test")).toBe(false);
      expect(processor.canProcess("video/mp4", "")).toBe(false);
    });
  });

  describe("extractText", () => {
    it("should successfully extract text from video", async () => {
      const mockContent = "Transcribed text from video";
      const mockThumbnail = "base64thumbnail";
      mockVideoService.extractTextFromVideo.mockResolvedValue({
        content: mockContent,
        thumbnail: mockThumbnail,
      });

      const result = await processor.extractText(mockBuffer, "test.mp4");

      expect(mockVideoService.extractTextFromVideo).toHaveBeenCalledWith(
        mockBuffer,
        "test.mp4"
      );
      expect(result).toEqual({
        content: mockContent,
        thumbnail: mockThumbnail,
      });
    });

    it("should handle video with no speech content", async () => {
      const mockContent = "";
      mockVideoService.extractTextFromVideo.mockResolvedValue({
        content: mockContent,
        thumbnail: undefined,
      });

      const result = await processor.extractText(mockBuffer, "test.mp4");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle video with only background music", async () => {
      const mockContent = "[Background music]";
      mockVideoService.extractTextFromVideo.mockResolvedValue({
        content: mockContent,
        thumbnail: undefined,
      });

      const result = await processor.extractText(mockBuffer, "test.mp4");

      expect(result).toEqual({
        content: "[Background music]",
        thumbnail: undefined,
      });
    });

    it("should handle video processing errors gracefully", async () => {
      mockVideoService.extractTextFromVideo.mockRejectedValue(
        new Error("Video processing failed")
      );

      const result = await processor.extractText(mockBuffer, "test.mp4");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle corrupted video files", async () => {
      mockVideoService.extractTextFromVideo.mockRejectedValue(
        new Error("Invalid video format")
      );

      const result = await processor.extractText(mockBuffer, "corrupted.mp4");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle unsupported video formats", async () => {
      mockVideoService.extractTextFromVideo.mockRejectedValue(
        new Error("Unsupported video format")
      );

      const result = await processor.extractText(mockBuffer, "test.unknown");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle large video files", async () => {
      const largeBuffer = Buffer.alloc(1000000); // 1MB
      const mockContent = "Transcribed text from large video";
      mockVideoService.extractTextFromVideo.mockResolvedValue({
        content: mockContent,
        thumbnail: "base64thumbnail",
      });

      const result = await processor.extractText(largeBuffer, "large.mp4");

      expect(result).toEqual({
        content: mockContent,
        thumbnail: "base64thumbnail",
      });
    });

    it("should handle video with special characters in transcription", async () => {
      const mockContent = "Transcribed text with special chars: àáâãäåæçèéêë";
      mockVideoService.extractTextFromVideo.mockResolvedValue({
        content: mockContent,
        thumbnail: "base64thumbnail",
      });

      const result = await processor.extractText(mockBuffer, "test.mp4");

      expect(result).toEqual({
        content: mockContent,
        thumbnail: "base64thumbnail",
      });
    });

    it("should handle video with multiple speakers", async () => {
      const mockContent =
        "Speaker 1: Hello\nSpeaker 2: Hi there\nSpeaker 1: How are you?";
      mockVideoService.extractTextFromVideo.mockResolvedValue({
        content: mockContent,
        thumbnail: "base64thumbnail",
      });

      const result = await processor.extractText(mockBuffer, "test.mp4");

      expect(result).toEqual({
        content: mockContent,
        thumbnail: "base64thumbnail",
      });
    });

    it("should handle empty buffer", async () => {
      const emptyBuffer = Buffer.alloc(0);
      mockVideoService.extractTextFromVideo.mockRejectedValue(
        new Error("Empty buffer")
      );

      const result = await processor.extractText(emptyBuffer, "empty.mp4");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle null or undefined text from video service", async () => {
      const mockContent = null as any;
      mockVideoService.extractTextFromVideo.mockResolvedValue({
        content: mockContent,
        thumbnail: "base64thumbnail",
      });

      const result = await processor.extractText(mockBuffer, "test.mp4");

      expect(result).toEqual({
        content: "",
        thumbnail: "base64thumbnail",
      });
    });

    it("should handle missing thumbnail in result", async () => {
      const mockContent = "Transcribed text from video";
      mockVideoService.extractTextFromVideo.mockResolvedValue({
        content: mockContent,
        thumbnail: undefined,
      });

      const result = await processor.extractText(mockBuffer, "test.mp4");

      expect(result).toEqual({
        content: mockContent,
        thumbnail: undefined,
      });
    });
  });

  describe("error handling", () => {
    it("should handle unexpected errors during processing", async () => {
      mockVideoService.extractTextFromVideo.mockRejectedValue(
        new Error("Unexpected error")
      );

      const result = await processor.extractText(mockBuffer, "test.mp4");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle timeout errors", async () => {
      mockVideoService.extractTextFromVideo.mockRejectedValue(
        new Error("Timeout")
      );

      const result = await processor.extractText(mockBuffer, "test.mp4");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle memory errors", async () => {
      mockVideoService.extractTextFromVideo.mockRejectedValue(
        new Error("Out of memory")
      );

      const result = await processor.extractText(mockBuffer, "test.mp4");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle network errors", async () => {
      mockVideoService.extractTextFromVideo.mockRejectedValue(
        new Error("Network error")
      );

      const result = await processor.extractText(mockBuffer, "test.mp4");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });
  });

  describe("logging", () => {
    it("should log processing start and completion", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const mockResult = {
        content: "Transcribed text from video",
        thumbnail: "base64thumbnail",
      };

      mockVideoService.extractTextFromVideo.mockResolvedValue(mockResult);

      await processor.extractText(mockBuffer, "test.mp4");

      expect(consoleSpy).toHaveBeenCalledWith(
        'Processing video "test.mp4" with optimized pipeline...'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        'Video processing completed for "test.mp4"'
      );

      consoleSpy.mockRestore();
    });

    it("should log debug information", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const mockResult = {
        content: "Transcribed text from video",
        thumbnail: "base64thumbnail",
      };

      mockVideoService.extractTextFromVideo.mockResolvedValue(mockResult);

      await processor.extractText(mockBuffer, "test.mp4");

      expect(consoleSpy).toHaveBeenCalledWith(
        "🔍 VideoProcessor debug - Buffer length: 18 bytes"
      );

      consoleSpy.mockRestore();
    });
  });

  describe("service initialization", () => {
    it("should create VideoProcessingService instance", () => {
      expect(MockedVideoProcessingService).toHaveBeenCalled();
    });

    it("should use the same service instance for multiple calls", async () => {
      const mockResult = {
        content: "Transcribed text from video",
        thumbnail: "base64thumbnail",
      };

      mockVideoService.extractTextFromVideo.mockResolvedValue(mockResult);

      await processor.extractText(mockBuffer, "test1.mp4");
      await processor.extractText(mockBuffer, "test2.mp4");

      expect(mockVideoService.extractTextFromVideo).toHaveBeenCalledTimes(2);
    });
  });
});
