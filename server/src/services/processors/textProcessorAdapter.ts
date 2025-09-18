import { DocumentProcessor } from "../documentService";

export class TextProcessorAdapter implements DocumentProcessor {
  canProcess(mimetype: string, filename: string): boolean {
    // Check for text MIME types, but only if the file has a proper extension
    if (mimetype.startsWith("text/")) {
      const parts = filename.split(".");
      // File must have at least 2 parts (name.extension) and extension must be valid
      if (parts.length < 2) return false;
      const ext = parts.pop()?.toLowerCase() || "";
      return ext.length > 0;
    }

    // Check for specific text file extensions
    const parts = filename.split(".");
    if (parts.length < 2) return false;
    return ["txt", "csv", "html", "htm", "xml", "json", "md", "log"].includes(
      parts.pop()?.toLowerCase() || ""
    );
  }

  async extractText(
    buffer: Buffer,
    filename: string
  ): Promise<{ content: string; thumbnail?: string }> {
    console.log(`Processing text file "${filename}"...`);

    // Handle null or undefined buffer
    if (!buffer) {
      console.log("🔍 TextProcessor debug - Buffer is null or undefined");
      return {
        content: "",
        thumbnail: undefined,
      };
    }

    console.log(
      `🔍 TextProcessor debug - Buffer length: ${buffer.length} bytes`
    );

    try {
      // For text files, we can directly convert the buffer to string
      // Try different encodings to handle various text file formats
      let content: string;
      let detectedEncoding = "utf-8";

      // First try UTF-8
      content = buffer.toString("utf-8");

      // Check if content has replacement characters (indicates invalid UTF-8)
      if (content.includes("\uFFFD")) {
        // Fallback to latin1
        content = buffer.toString("latin1");
        detectedEncoding = "latin1";

        // If still problematic, try ascii
        if (content.includes("\uFFFD") || content.length === 0) {
          content = buffer.toString("ascii");
          detectedEncoding = "ascii";
        }
      }

      console.log(`🔤 Detected encoding: ${detectedEncoding}`);
      console.log(`📄 Extracted text length: ${content.length} characters`);

      console.log(`Text processing completed for "${filename}"`);

      return {
        content: content,
        thumbnail: undefined, // Text files don't have thumbnails
      };
    } catch (error) {
      console.error(`Failed to process text file "${filename}":`, error);
      return {
        content: "",
        thumbnail: undefined,
      };
    }
  }
}
