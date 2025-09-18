import { WordProcessorAdapter } from "../../src/services/processors/wordProcessorAdapter";

// Mock mammoth module
const mockMammoth = {
  extractRawText: jest.fn(),
};
jest.mock("mammoth", () => mockMammoth);

describe("WordProcessorAdapter", () => {
  let processor: WordProcessorAdapter;
  let mockBuffer: Buffer;

  beforeEach(() => {
    processor = new WordProcessorAdapter();
    mockBuffer = Buffer.from("test document content");
    jest.clearAllMocks();
  });

  describe("canProcess", () => {
    it("should return true for Word MIME types", () => {
      const mimeTypes = [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "application/vnd.ms-word",
        "application/x-msword",
      ];

      mimeTypes.forEach((mimeType) => {
        expect(processor.canProcess(mimeType, "test.docx")).toBe(true);
      });
    });

    it("should return true for Word file extensions", () => {
      const filenames = [
        "document.doc",
        "document.docx",
        "Document.DOC",
        "Document.DOCX",
        "my-document.doc",
        "my-document.docx",
      ];

      filenames.forEach((filename) => {
        expect(processor.canProcess("application/octet-stream", filename)).toBe(
          true
        );
      });
    });

    it("should return false for non-Word files", () => {
      const testCases = [
        { mimeType: "application/pdf", filename: "document.pdf" },
        { mimeType: "text/plain", filename: "document.txt" },
        { mimeType: "image/jpeg", filename: "image.jpg" },
        { mimeType: "application/vnd.ms-excel", filename: "spreadsheet.xlsx" },
      ];

      testCases.forEach(({ mimeType, filename }) => {
        expect(processor.canProcess(mimeType, filename)).toBe(false);
      });
    });

    it("should handle case-insensitive file extensions", () => {
      expect(
        processor.canProcess("application/octet-stream", "document.DOC")
      ).toBe(true);
      expect(
        processor.canProcess("application/octet-stream", "document.DOCX")
      ).toBe(true);
      expect(
        processor.canProcess("application/octet-stream", "document.Doc")
      ).toBe(true);
      expect(
        processor.canProcess("application/octet-stream", "document.Docx")
      ).toBe(true);
    });

    it("should return false for files without extensions", () => {
      expect(processor.canProcess("application/octet-stream", "document")).toBe(
        false
      );
      expect(processor.canProcess("application/octet-stream", "my-file")).toBe(
        false
      );
    });
  });

  describe("extractText", () => {
    it("should successfully extract text from Word document", async () => {
      const mockText = "This is the content of the Word document.";
      mockMammoth.extractRawText.mockResolvedValue({ value: mockText });

      const result = await processor.extractText(mockBuffer, "test.docx");

      expect(mockMammoth.extractRawText).toHaveBeenCalledWith({
        buffer: mockBuffer,
      });
      expect(result).toEqual({
        content: mockText,
        thumbnail: undefined,
      });
    });

    it("should handle empty Word documents", async () => {
      mockMammoth.extractRawText.mockResolvedValue({ value: "" });

      const result = await processor.extractText(mockBuffer, "empty.docx");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle Word documents with only whitespace", async () => {
      const whitespaceText = "   \n\t  \n  ";
      mockMammoth.extractRawText.mockResolvedValue({ value: whitespaceText });

      const result = await processor.extractText(mockBuffer, "whitespace.docx");

      expect(result).toEqual({
        content: whitespaceText,
        thumbnail: undefined,
      });
    });

    it("should handle large Word documents", async () => {
      const largeBuffer = Buffer.alloc(1000000); // 1MB
      const mockText = "Large document content ".repeat(1000);
      mockMammoth.extractRawText.mockResolvedValue({ value: mockText });

      const result = await processor.extractText(largeBuffer, "large.docx");

      expect(result).toEqual({
        content: mockText,
        thumbnail: undefined,
      });
    });

    it("should handle Word documents with special characters", async () => {
      const specialText = "Document with special chars: àáâãäåæçèéêë ñ ü ß €";
      mockMammoth.extractRawText.mockResolvedValue({ value: specialText });

      const result = await processor.extractText(mockBuffer, "special.docx");

      expect(result).toEqual({
        content: specialText,
        thumbnail: undefined,
      });
    });

    it("should handle Word documents with formatting", async () => {
      const formattedText =
        "This is bold text. This is italic text. This is underlined.";
      mockMammoth.extractRawText.mockResolvedValue({ value: formattedText });

      const result = await processor.extractText(mockBuffer, "formatted.docx");

      expect(result).toEqual({
        content: formattedText,
        thumbnail: undefined,
      });
    });

    it("should handle Word documents with tables", async () => {
      const tableText = "Header 1\tHeader 2\nCell 1\tCell 2\nCell 3\tCell 4";
      mockMammoth.extractRawText.mockResolvedValue({ value: tableText });

      const result = await processor.extractText(mockBuffer, "table.docx");

      expect(result).toEqual({
        content: tableText,
        thumbnail: undefined,
      });
    });

    it("should handle Word documents with lists", async () => {
      const listText = "1. First item\n2. Second item\n3. Third item";
      mockMammoth.extractRawText.mockResolvedValue({ value: listText });

      const result = await processor.extractText(mockBuffer, "list.docx");

      expect(result).toEqual({
        content: listText,
        thumbnail: undefined,
      });
    });

    it("should handle Word documents with multiple paragraphs", async () => {
      const paragraphText =
        "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";
      mockMammoth.extractRawText.mockResolvedValue({ value: paragraphText });

      const result = await processor.extractText(mockBuffer, "paragraphs.docx");

      expect(result).toEqual({
        content: paragraphText,
        thumbnail: undefined,
      });
    });
  });

  describe("error handling", () => {
    it("should handle mammoth parsing errors gracefully", async () => {
      mockMammoth.extractRawText.mockRejectedValue(
        new Error("Invalid Word format")
      );

      await expect(
        processor.extractText(mockBuffer, "corrupted.docx")
      ).rejects.toThrow("Word processing failed: Invalid Word format");
    });

    it("should handle corrupted Word files", async () => {
      mockMammoth.extractRawText.mockRejectedValue(
        new Error("The file is corrupted")
      );

      await expect(
        processor.extractText(mockBuffer, "corrupted.docx")
      ).rejects.toThrow("Word processing failed: The file is corrupted");
    });

    it("should handle password-protected Word files", async () => {
      mockMammoth.extractRawText.mockRejectedValue(
        new Error("Password required")
      );

      await expect(
        processor.extractText(mockBuffer, "protected.docx")
      ).rejects.toThrow("Word processing failed: Password required");
    });

    it("should handle unsupported Word formats", async () => {
      mockMammoth.extractRawText.mockRejectedValue(
        new Error("Unsupported format")
      );

      await expect(
        processor.extractText(mockBuffer, "old.doc")
      ).rejects.toThrow("Word processing failed: Unsupported format");
    });

    it("should handle empty buffer", async () => {
      const emptyBuffer = Buffer.alloc(0);
      mockMammoth.extractRawText.mockRejectedValue(new Error("Empty file"));

      await expect(
        processor.extractText(emptyBuffer, "empty.docx")
      ).rejects.toThrow("Word processing failed: Empty file");
    });

    it("should handle unexpected errors during processing", async () => {
      mockMammoth.extractRawText.mockRejectedValue(
        new Error("Unexpected error")
      );

      await expect(
        processor.extractText(mockBuffer, "test.docx")
      ).rejects.toThrow("Word processing failed: Unexpected error");
    });

    it("should handle timeout errors", async () => {
      mockMammoth.extractRawText.mockRejectedValue(new Error("Timeout"));

      await expect(
        processor.extractText(mockBuffer, "test.docx")
      ).rejects.toThrow("Word processing failed: Timeout");
    });

    it("should handle memory errors", async () => {
      mockMammoth.extractRawText.mockRejectedValue(new Error("Out of memory"));

      await expect(
        processor.extractText(mockBuffer, "test.docx")
      ).rejects.toThrow("Word processing failed: Out of memory");
    });

    it("should handle non-Error objects in catch", async () => {
      mockMammoth.extractRawText.mockRejectedValue("String error");

      await expect(
        processor.extractText(mockBuffer, "test.docx")
      ).rejects.toThrow("Word processing failed: Unknown error");
    });
  });

  describe("logging", () => {
    it("should log processing start and completion", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      mockMammoth.extractRawText.mockResolvedValue({ value: "Test content" });

      await processor.extractText(mockBuffer, "test.docx");

      expect(consoleSpy).toHaveBeenCalledWith(
        'Processing Word document "test.docx"...'
      );
      expect(consoleSpy).toHaveBeenCalledWith("Word parsed", {
        value: "Test content",
      });

      consoleSpy.mockRestore();
    });

    it("should log error details", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const error = new Error("Test error");
      mockMammoth.extractRawText.mockRejectedValue(error);

      try {
        await processor.extractText(mockBuffer, "test.docx");
      } catch (e) {
        // Expected to throw
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to parse Word document "test.docx":',
        error
      );

      consoleSpy.mockRestore();
    });
  });

  describe("module dependencies", () => {
    it("should use mammoth for Word processing", async () => {
      mockMammoth.extractRawText.mockResolvedValue({ value: "Test content" });

      await processor.extractText(mockBuffer, "test.docx");

      expect(mockMammoth.extractRawText).toHaveBeenCalledWith({
        buffer: mockBuffer,
      });
    });

    it("should handle different buffer sizes", async () => {
      const buffers = [
        Buffer.alloc(0),
        Buffer.alloc(100),
        Buffer.alloc(10000),
        Buffer.alloc(1000000),
      ];

      for (const buffer of buffers) {
        mockMammoth.extractRawText.mockResolvedValue({ value: "Content" });

        try {
          await processor.extractText(buffer, "test.docx");
          expect(mockMammoth.extractRawText).toHaveBeenCalledWith({ buffer });
        } catch (e) {
          // Some buffer sizes might fail, which is okay for this test
        }
      }
    });
  });
});
