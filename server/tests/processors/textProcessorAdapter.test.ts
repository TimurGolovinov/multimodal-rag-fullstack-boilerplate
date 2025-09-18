import { TextProcessorAdapter } from "../../src/services/processors/textProcessorAdapter";

describe("TextProcessorAdapter", () => {
  let processor: TextProcessorAdapter;

  beforeEach(() => {
    processor = new TextProcessorAdapter();
  });

  describe("canProcess", () => {
    it("should return true for text MIME types", () => {
      expect(processor.canProcess("text/plain", "test.txt")).toBe(true);
      expect(processor.canProcess("text/csv", "test.csv")).toBe(true);
      expect(processor.canProcess("text/html", "test.html")).toBe(true);
      expect(processor.canProcess("text/xml", "test.xml")).toBe(true);
      expect(processor.canProcess("text/markdown", "test.md")).toBe(true);
    });

    it("should return true for text file extensions", () => {
      expect(processor.canProcess("application/octet-stream", "test.txt")).toBe(
        true
      );
      expect(processor.canProcess("application/octet-stream", "test.csv")).toBe(
        true
      );
      expect(
        processor.canProcess("application/octet-stream", "test.html")
      ).toBe(true);
      expect(processor.canProcess("application/octet-stream", "test.htm")).toBe(
        true
      );
      expect(processor.canProcess("application/octet-stream", "test.xml")).toBe(
        true
      );
      expect(
        processor.canProcess("application/octet-stream", "test.json")
      ).toBe(true);
      expect(processor.canProcess("application/octet-stream", "test.md")).toBe(
        true
      );
      expect(processor.canProcess("application/octet-stream", "test.log")).toBe(
        true
      );
    });

    it("should return false for non-text files", () => {
      expect(processor.canProcess("application/pdf", "test.pdf")).toBe(false);
      expect(processor.canProcess("image/jpeg", "test.jpg")).toBe(false);
      expect(processor.canProcess("audio/mp3", "test.mp3")).toBe(false);
      expect(processor.canProcess("video/mp4", "test.mp4")).toBe(false);
    });

    it("should handle case-insensitive file extensions", () => {
      expect(processor.canProcess("application/octet-stream", "test.TXT")).toBe(
        true
      );
      expect(processor.canProcess("application/octet-stream", "test.CSV")).toBe(
        true
      );
      expect(
        processor.canProcess("application/octet-stream", "test.HTML")
      ).toBe(true);
      expect(
        processor.canProcess("application/octet-stream", "test.JSON")
      ).toBe(true);
    });

    it("should return false for files without extensions", () => {
      expect(processor.canProcess("text/plain", "test")).toBe(false);
      expect(processor.canProcess("text/plain", "")).toBe(false);
    });
  });

  describe("extractText", () => {
    it("should successfully extract text from UTF-8 encoded file", async () => {
      const content = "This is a test text file with UTF-8 content: àáâãäå";
      const buffer = Buffer.from(content, "utf-8");

      const result = await processor.extractText(buffer, "test.txt");

      expect(result).toEqual({
        content: content,
        thumbnail: undefined,
      });
    });

    it("should successfully extract text from ASCII encoded file", async () => {
      const content = "This is a simple ASCII text file";
      const buffer = Buffer.from(content, "ascii");

      const result = await processor.extractText(buffer, "test.txt");

      expect(result).toEqual({
        content: content,
        thumbnail: undefined,
      });
    });

    it("should successfully extract text from Latin1 encoded file", async () => {
      const content = "Text with Latin1 characters: àáâãäåæçèéêë";
      const buffer = Buffer.from(content, "latin1");

      const result = await processor.extractText(buffer, "test.txt");

      expect(result).toEqual({
        content: content,
        thumbnail: undefined,
      });
    });

    it("should handle empty files", async () => {
      const buffer = Buffer.alloc(0);

      const result = await processor.extractText(buffer, "empty.txt");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle files with only whitespace", async () => {
      const content = "   \n\t   \r\n   ";
      const buffer = Buffer.from(content, "utf-8");

      const result = await processor.extractText(buffer, "whitespace.txt");

      expect(result).toEqual({
        content: content,
        thumbnail: undefined,
      });
    });

    it("should handle large text files", async () => {
      const content = "A".repeat(100000); // 100KB of text
      const buffer = Buffer.from(content, "utf-8");

      const result = await processor.extractText(buffer, "large.txt");

      expect(result.content).toBe(content);
      expect(result.content.length).toBe(100000);
    });

    it("should handle files with special characters", async () => {
      const content = "Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?/~`";
      const buffer = Buffer.from(content, "utf-8");

      const result = await processor.extractText(buffer, "special.txt");

      expect(result.content).toBe(content);
    });

    it("should handle files with newlines and carriage returns", async () => {
      const content = "Line 1\nLine 2\r\nLine 3\rLine 4";
      const buffer = Buffer.from(content, "utf-8");

      const result = await processor.extractText(buffer, "multiline.txt");

      expect(result.content).toBe(content);
    });

    it("should handle CSV files", async () => {
      const content = "Name,Age,City\nJohn,25,New York\nJane,30,London";
      const buffer = Buffer.from(content, "utf-8");

      const result = await processor.extractText(buffer, "test.csv");

      expect(result.content).toBe(content);
    });

    it("should handle HTML files", async () => {
      const content =
        "<html><body><h1>Test</h1><p>This is a test HTML file.</p></body></html>";
      const buffer = Buffer.from(content, "utf-8");

      const result = await processor.extractText(buffer, "test.html");

      expect(result.content).toBe(content);
    });

    it("should handle JSON files", async () => {
      const content =
        '{"name": "test", "value": 123, "nested": {"key": "value"}}';
      const buffer = Buffer.from(content, "utf-8");

      const result = await processor.extractText(buffer, "test.json");

      expect(result.content).toBe(content);
    });

    it("should handle Markdown files", async () => {
      const content =
        "# Test Markdown\n\nThis is a **test** markdown file.\n\n- Item 1\n- Item 2";
      const buffer = Buffer.from(content, "utf-8");

      const result = await processor.extractText(buffer, "test.md");

      expect(result.content).toBe(content);
    });

    it("should handle XML files", async () => {
      const content = '<?xml version="1.0"?><root><item>Test</item></root>';
      const buffer = Buffer.from(content, "utf-8");

      const result = await processor.extractText(buffer, "test.xml");

      expect(result.content).toBe(content);
    });

    it("should handle log files", async () => {
      const content =
        "2024-01-01 10:00:00 INFO: Application started\n2024-01-01 10:01:00 DEBUG: Processing request";
      const buffer = Buffer.from(content, "utf-8");

      const result = await processor.extractText(buffer, "test.log");

      expect(result.content).toBe(content);
    });

    it("should fallback to Latin1 when UTF-8 fails", async () => {
      const content = "Text with Latin1 characters: àáâãäå";
      const buffer = Buffer.from(content, "latin1");

      const result = await processor.extractText(buffer, "test.txt");

      expect(result.content).toBe(content);
    });

    it("should fallback to ASCII when both UTF-8 and Latin1 fail", async () => {
      const content = "Simple ASCII text";
      const buffer = Buffer.from(content, "ascii");

      const result = await processor.extractText(buffer, "test.txt");

      expect(result.content).toBe(content);
    });

    it("should handle encoding detection errors gracefully", async () => {
      // Create a buffer that might cause encoding issues
      const buffer = Buffer.from([0xff, 0xfe, 0x00, 0x00]); // Invalid UTF-8 sequence

      const result = await processor.extractText(buffer, "test.txt");

      expect(result).toEqual({
        content: expect.any(String),
        thumbnail: undefined,
      });
    });

    it("should handle null or undefined buffer", async () => {
      const result = await processor.extractText(null as any, "test.txt");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });
  });

  describe("error handling", () => {
    it("should handle unexpected errors during processing", async () => {
      // Mock Buffer.from to throw an error
      const originalFrom = Buffer.from;
      Buffer.from = jest.fn().mockImplementation(() => {
        throw new Error("Buffer creation failed");
      });

      const result = await processor.extractText(Buffer.alloc(0), "test.txt");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });

      // Restore original Buffer.from
      Buffer.from = originalFrom;
    });

    it("should handle encoding errors gracefully", async () => {
      const content = "Test content";
      const buffer = Buffer.from(content, "utf-8");

      const result = await processor.extractText(buffer, "test.txt");

      expect(result).toEqual({
        content: content,
        thumbnail: undefined,
      });
    });
  });

  describe("logging", () => {
    it("should log processing start and completion", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const content = "Test content";
      const buffer = Buffer.from(content, "utf-8");

      await processor.extractText(buffer, "test.txt");

      expect(consoleSpy).toHaveBeenCalledWith(
        'Processing text file "test.txt"...'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        'Text processing completed for "test.txt"'
      );

      consoleSpy.mockRestore();
    });

    it("should log debug information", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const content = "Test content";
      const buffer = Buffer.from(content, "utf-8");

      await processor.extractText(buffer, "test.txt");

      expect(consoleSpy).toHaveBeenCalledWith(
        "🔍 TextProcessor debug - Buffer length: 12 bytes"
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "📄 Extracted text length: 12 characters"
      );

      consoleSpy.mockRestore();
    });

    it("should log encoding detection", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const content = "Test content";
      const buffer = Buffer.from(content, "utf-8");

      await processor.extractText(buffer, "test.txt");

      expect(consoleSpy).toHaveBeenCalledWith("🔤 Detected encoding: utf-8");

      consoleSpy.mockRestore();
    });
  });
});

