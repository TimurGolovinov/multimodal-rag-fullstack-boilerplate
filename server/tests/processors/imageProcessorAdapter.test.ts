import { ImageProcessorAdapter } from "../../src/services/processors/imageProcessorAdapter";
import { ImageProcessingService } from "../../src/services/imageProcessingService";

// Mock ImageProcessingService
jest.mock("../../src/services/imageProcessingService");
const MockedImageProcessingService = ImageProcessingService as jest.MockedClass<
  typeof ImageProcessingService
>;

describe("ImageProcessorAdapter", () => {
  let processor: ImageProcessorAdapter;
  let mockImageService: jest.Mocked<ImageProcessingService>;
  const mockBuffer = Buffer.from("mock image content");

  beforeEach(() => {
    jest.clearAllMocks();

    mockImageService = {
      extractTextFromImage: jest.fn(),
    } as any;

    MockedImageProcessingService.mockImplementation(() => mockImageService);
    processor = new ImageProcessorAdapter();
  });

  describe("canProcess", () => {
    it("should return true for image MIME types", () => {
      expect(processor.canProcess("image/jpeg", "test.jpg")).toBe(true);
      expect(processor.canProcess("image/png", "test.png")).toBe(true);
      expect(processor.canProcess("image/gif", "test.gif")).toBe(true);
      expect(processor.canProcess("image/webp", "test.webp")).toBe(true);
      expect(processor.canProcess("image/svg+xml", "test.svg")).toBe(true);
      expect(processor.canProcess("image/bmp", "test.bmp")).toBe(true);
      expect(processor.canProcess("image/tiff", "test.tiff")).toBe(true);
    });

    it("should return true for image file extensions", () => {
      expect(processor.canProcess("application/octet-stream", "test.jpg")).toBe(
        true
      );
      expect(
        processor.canProcess("application/octet-stream", "test.jpeg")
      ).toBe(true);
      expect(processor.canProcess("application/octet-stream", "test.png")).toBe(
        true
      );
      expect(processor.canProcess("application/octet-stream", "test.gif")).toBe(
        true
      );
      expect(
        processor.canProcess("application/octet-stream", "test.webp")
      ).toBe(true);
      expect(processor.canProcess("application/octet-stream", "test.svg")).toBe(
        true
      );
      expect(processor.canProcess("application/octet-stream", "test.bmp")).toBe(
        true
      );
      expect(
        processor.canProcess("application/octet-stream", "test.tiff")
      ).toBe(true);
      expect(processor.canProcess("application/octet-stream", "test.tif")).toBe(
        true
      );
    });

    it("should return false for non-image files", () => {
      expect(processor.canProcess("text/plain", "test.txt")).toBe(false);
      expect(processor.canProcess("application/pdf", "test.pdf")).toBe(false);
      expect(processor.canProcess("audio/mp3", "test.mp3")).toBe(false);
      expect(processor.canProcess("video/mp4", "test.mp4")).toBe(false);
    });

    it("should handle case-insensitive file extensions", () => {
      expect(processor.canProcess("application/octet-stream", "test.JPG")).toBe(
        true
      );
      expect(processor.canProcess("application/octet-stream", "test.PNG")).toBe(
        true
      );
      expect(processor.canProcess("application/octet-stream", "test.GIF")).toBe(
        true
      );
    });

    it("should return false for files without extensions", () => {
      expect(processor.canProcess("image/jpeg", "test")).toBe(false);
      expect(processor.canProcess("image/jpeg", "")).toBe(false);
    });
  });

  describe("extractText", () => {
    it("should successfully extract text from image", async () => {
      const mockResult = {
        content: "Extracted text from image",
        thumbnail: "base64thumbnail",
      };

      mockImageService.extractTextFromImage.mockResolvedValue(mockResult);

      const result = await processor.extractText(mockBuffer, "test.jpg");

      expect(mockImageService.extractTextFromImage).toHaveBeenCalledWith(
        mockBuffer,
        "test.jpg"
      );
      expect(result).toEqual({
        content: "Extracted text from image",
        thumbnail: "base64thumbnail",
      });
    });

    it("should handle image with no text content", async () => {
      const mockResult = {
        content: "",
        thumbnail: "base64thumbnail",
      };

      mockImageService.extractTextFromImage.mockResolvedValue(mockResult);

      const result = await processor.extractText(mockBuffer, "test.jpg");

      expect(result).toEqual({
        content: "",
        thumbnail: "base64thumbnail",
      });
    });

    it("should handle image with only whitespace text", async () => {
      const mockResult = {
        content: "   \n\t   ",
        thumbnail: "base64thumbnail",
      };

      mockImageService.extractTextFromImage.mockResolvedValue(mockResult);

      const result = await processor.extractText(mockBuffer, "test.jpg");

      expect(result).toEqual({
        content: "   \n\t   ",
        thumbnail: "base64thumbnail",
      });
    });

    it("should handle image processing errors gracefully", async () => {
      mockImageService.extractTextFromImage.mockRejectedValue(
        new Error("Image processing failed")
      );

      const result = await processor.extractText(mockBuffer, "test.jpg");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle corrupted image files", async () => {
      mockImageService.extractTextFromImage.mockRejectedValue(
        new Error("Invalid image format")
      );

      const result = await processor.extractText(mockBuffer, "corrupted.jpg");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle unsupported image formats", async () => {
      mockImageService.extractTextFromImage.mockRejectedValue(
        new Error("Unsupported image format")
      );

      const result = await processor.extractText(mockBuffer, "test.unknown");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle large image files", async () => {
      const largeText = "A".repeat(10000); // 10KB of text
      const mockResult = {
        content: largeText,
        thumbnail: "base64thumbnail",
      };

      mockImageService.extractTextFromImage.mockResolvedValue(mockResult);

      const result = await processor.extractText(mockBuffer, "large.jpg");

      expect(result.content).toBe(largeText);
      expect(result.content.length).toBe(10000);
    });

    it("should handle image with special characters in text", async () => {
      const specialText = "Text with special chars: àáâãäåæçèéêë";
      const mockResult = {
        content: specialText,
        thumbnail: "base64thumbnail",
      };

      mockImageService.extractTextFromImage.mockResolvedValue(mockResult);

      const result = await processor.extractText(mockBuffer, "special.jpg");

      expect(result.content).toBe(specialText);
    });

    it("should handle image with multiple lines of text", async () => {
      const multiLineText = "Line 1\nLine 2\nLine 3";
      const mockResult = {
        content: multiLineText,
        thumbnail: "base64thumbnail",
      };

      mockImageService.extractTextFromImage.mockResolvedValue(mockResult);

      const result = await processor.extractText(mockBuffer, "multiline.jpg");

      expect(result.content).toBe(multiLineText);
    });

    it("should handle empty buffer", async () => {
      const emptyBuffer = Buffer.alloc(0);
      mockImageService.extractTextFromImage.mockRejectedValue(
        new Error("Empty buffer")
      );

      const result = await processor.extractText(emptyBuffer, "empty.jpg");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle null or undefined text from image service", async () => {
      const mockResult = {
        content: null,
        thumbnail: "base64thumbnail",
      };

      mockImageService.extractTextFromImage.mockResolvedValue(
        mockResult as any
      );

      const result = await processor.extractText(mockBuffer, "test.jpg");

      expect(result).toEqual({
        content: "",
        thumbnail: "base64thumbnail",
      });
    });

    it("should handle missing thumbnail in result", async () => {
      const mockResult = {
        content: "Extracted text",
        thumbnail: undefined,
      };

      mockImageService.extractTextFromImage.mockResolvedValue(
        mockResult as any
      );

      const result = await processor.extractText(mockBuffer, "test.jpg");

      expect(result).toEqual({
        content: "Extracted text",
        thumbnail: undefined,
      });
    });
  });

  describe("error handling", () => {
    it("should handle unexpected errors during processing", async () => {
      mockImageService.extractTextFromImage.mockRejectedValue(
        new Error("Unexpected error")
      );

      const result = await processor.extractText(mockBuffer, "test.jpg");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle timeout errors", async () => {
      mockImageService.extractTextFromImage.mockRejectedValue(
        new Error("Timeout")
      );

      const result = await processor.extractText(mockBuffer, "test.jpg");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle memory errors", async () => {
      mockImageService.extractTextFromImage.mockRejectedValue(
        new Error("Out of memory")
      );

      const result = await processor.extractText(mockBuffer, "test.jpg");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle network errors", async () => {
      mockImageService.extractTextFromImage.mockRejectedValue(
        new Error("Network error")
      );

      const result = await processor.extractText(mockBuffer, "test.jpg");

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
        content: "Test content",
        thumbnail: "base64thumbnail",
      };

      mockImageService.extractTextFromImage.mockResolvedValue(mockResult);

      await processor.extractText(mockBuffer, "test.jpg");

      expect(consoleSpy).toHaveBeenCalledWith('Processing image "test.jpg"...');
      expect(consoleSpy).toHaveBeenCalledWith(
        'Image processing completed for "test.jpg"'
      );

      consoleSpy.mockRestore();
    });

    it("should log debug information", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const mockResult = {
        content: "Test content",
        thumbnail: "base64thumbnail",
      };

      mockImageService.extractTextFromImage.mockResolvedValue(mockResult);

      await processor.extractText(mockBuffer, "test.jpg");

      expect(consoleSpy).toHaveBeenCalledWith(
        "🔍 ImageProcessor debug - Buffer length: 18 bytes"
      );

      consoleSpy.mockRestore();
    });
  });

  describe("service initialization", () => {
    it("should create ImageProcessingService instance", () => {
      expect(MockedImageProcessingService).toHaveBeenCalledTimes(1);
    });

    it("should use the same service instance for multiple calls", async () => {
      const mockResult = {
        content: "Test content",
        thumbnail: "base64thumbnail",
      };

      mockImageService.extractTextFromImage.mockResolvedValue(mockResult);

      await processor.extractText(mockBuffer, "test1.jpg");
      await processor.extractText(mockBuffer, "test2.jpg");

      expect(mockImageService.extractTextFromImage).toHaveBeenCalledTimes(2);
    });
  });
});
