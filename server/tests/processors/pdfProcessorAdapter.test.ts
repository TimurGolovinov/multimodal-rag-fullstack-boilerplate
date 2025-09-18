import { PdfProcessorAdapter } from "../../src/services/processors/pdfProcessorAdapter";

// Mock pdf-parse
const mockPdfParse = jest.fn();
jest.mock("pdf-parse", () => mockPdfParse);

describe("PdfProcessorAdapter", () => {
  let processor: PdfProcessorAdapter;
  const mockBuffer = Buffer.from("mock pdf content");

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new PdfProcessorAdapter();
  });

  describe("canProcess", () => {
    it("should return true for PDF MIME types", () => {
      expect(processor.canProcess("application/pdf", "test.pdf")).toBe(true);
      expect(processor.canProcess("application/x-pdf", "test.pdf")).toBe(true);
    });

    it("should return true for PDF file extensions", () => {
      expect(processor.canProcess("application/octet-stream", "test.pdf")).toBe(
        true
      );
      expect(processor.canProcess("unknown/type", "document.PDF")).toBe(true);
    });

    it("should return false for non-PDF files", () => {
      expect(processor.canProcess("text/plain", "test.txt")).toBe(false);
      expect(processor.canProcess("image/jpeg", "test.jpg")).toBe(false);
      expect(processor.canProcess("application/msword", "test.doc")).toBe(
        false
      );
    });

    it("should handle case-insensitive file extensions", () => {
      expect(processor.canProcess("application/octet-stream", "test.PDF")).toBe(
        true
      );
      expect(processor.canProcess("application/octet-stream", "test.Pdf")).toBe(
        true
      );
      expect(processor.canProcess("application/octet-stream", "test.pdf")).toBe(
        true
      );
    });

    it("should return false for files without extensions", () => {
      expect(processor.canProcess("application/pdf", "test")).toBe(false);
      expect(processor.canProcess("application/pdf", "")).toBe(false);
    });
  });

  describe("extractText", () => {
    it("should successfully extract text from PDF", async () => {
      const mockResult = {
        numpages: 2,
        numrender: 2,
        info: {
          PDFFormatVersion: "1.4",
          Title: "Test Document",
          Author: "Test Author",
        },
        metadata: {
          _metadata: true,
        },
        text: "This is extracted text from the PDF document.",
        version: "1.0.0",
      };

      mockPdfParse.mockResolvedValue(mockResult as any);

      const result = await processor.extractText(mockBuffer, "test.pdf");

      expect(mockPdfParse).toHaveBeenCalledWith(mockBuffer);
      expect(result).toEqual({
        content: "This is extracted text from the PDF document.",
        thumbnail: undefined,
      });
    });

    it("should handle PDF with no text content", async () => {
      const mockResult = {
        numpages: 1,
        numrender: 1,
        info: {},
        metadata: {},
        text: "",
        version: "1.0.0",
      };

      mockPdfParse.mockResolvedValue(mockResult as any);

      const result = await processor.extractText(mockBuffer, "test.pdf");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle PDF with whitespace-only text", async () => {
      const mockResult = {
        numpages: 1,
        numrender: 1,
        info: {},
        metadata: {},
        text: "   \n\t   ",
        version: "1.0.0",
      };

      mockPdfParse.mockResolvedValue(mockResult as any);

      const result = await processor.extractText(mockBuffer, "test.pdf");

      expect(result).toEqual({
        content: "   \n\t   ",
        thumbnail: undefined,
      });
    });

    it("should handle PDF parsing errors gracefully", async () => {
      mockPdfParse.mockRejectedValue(new Error("PDF parsing failed"));

      const result = await processor.extractText(mockBuffer, "test.pdf");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle corrupted PDF files", async () => {
      mockPdfParse.mockRejectedValue(new Error("Invalid PDF structure"));

      const result = await processor.extractText(mockBuffer, "corrupted.pdf");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle password-protected PDFs", async () => {
      mockPdfParse.mockRejectedValue(new Error("Password required"));

      const result = await processor.extractText(mockBuffer, "protected.pdf");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle large PDF files", async () => {
      const largeText = "A".repeat(100000); // 100KB of text
      const mockResult = {
        numpages: 100,
        numrender: 100,
        info: {},
        metadata: {},
        text: largeText,
        version: "1.0.0",
      };

      mockPdfParse.mockResolvedValue(mockResult as any);

      const result = await processor.extractText(mockBuffer, "large.pdf");

      expect(result.content).toBe(largeText);
      expect(result.content.length).toBe(100000);
    });

    it("should handle PDF with special characters", async () => {
      const specialText =
        "Text with special chars: àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ";
      const mockResult = {
        numpages: 1,
        numrender: 1,
        info: {},
        metadata: {},
        text: specialText,
        version: "1.0.0",
      };

      mockPdfParse.mockResolvedValue(mockResult as any);

      const result = await processor.extractText(mockBuffer, "special.pdf");

      expect(result.content).toBe(specialText);
    });

    it("should handle PDF with multiple pages", async () => {
      const multiPageText =
        "Page 1 content\n\nPage 2 content\n\nPage 3 content";
      const mockResult = {
        numpages: 3,
        numrender: 3,
        info: {},
        metadata: {},
        text: multiPageText,
        version: "1.0.0",
      };

      mockPdfParse.mockResolvedValue(mockResult as any);

      const result = await processor.extractText(mockBuffer, "multipage.pdf");

      expect(result.content).toBe(multiPageText);
    });

    it("should handle empty buffer", async () => {
      const emptyBuffer = Buffer.alloc(0);
      mockPdfParse.mockRejectedValue(new Error("Empty buffer"));

      const result = await processor.extractText(emptyBuffer, "empty.pdf");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle null or undefined text from pdf-parse", async () => {
      const mockResult = {
        numpages: 1,
        numrender: 1,
        info: {},
        metadata: {},
        text: null,
        version: "1.0.0",
      };

      mockPdfParse.mockResolvedValue(mockResult as any);

      const result = await processor.extractText(mockBuffer, "test.pdf");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });
  });

  describe("error handling", () => {
    it("should handle unexpected errors during processing", async () => {
      mockPdfParse.mockRejectedValue(new Error("Unexpected error"));

      const result = await processor.extractText(mockBuffer, "test.pdf");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle timeout errors", async () => {
      mockPdfParse.mockRejectedValue(new Error("Timeout"));

      const result = await processor.extractText(mockBuffer, "test.pdf");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle memory errors", async () => {
      mockPdfParse.mockRejectedValue(new Error("Out of memory"));

      const result = await processor.extractText(mockBuffer, "test.pdf");

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
        numpages: 1,
        numrender: 1,
        info: {},
        metadata: {},
        text: "Test content",
        version: "1.0.0",
      };

      mockPdfParse.mockResolvedValue(mockResult as any);

      await processor.extractText(mockBuffer, "test.pdf");

      expect(consoleSpy).toHaveBeenCalledWith('Processing PDF "test.pdf"...');
      expect(consoleSpy).toHaveBeenCalledWith(
        'PDF processing completed for "test.pdf"'
      );

      consoleSpy.mockRestore();
    });

    it("should log debug information", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const mockResult = {
        numpages: 2,
        numrender: 2,
        info: {},
        metadata: {},
        text: "Test content",
        version: "1.0.0",
      };

      mockPdfParse.mockResolvedValue(mockResult as any);

      await processor.extractText(mockBuffer, "test.pdf");

      expect(consoleSpy).toHaveBeenCalledWith(
        "🔍 PDFProcessor debug - Buffer length: 16 bytes"
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "📄 Extracted text length: 12 characters"
      );

      consoleSpy.mockRestore();
    });
  });
});
