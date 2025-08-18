import { DocumentProcessor } from "../documentService";

export class WordProcessorAdapter implements DocumentProcessor {
  canProcess(mimetype: string, filename: string): boolean {
    return (
      mimetype.includes("word") ||
      mimetype.includes("docx") ||
      ["doc", "docx"].includes(filename.split(".").pop()?.toLowerCase() || "")
    );
  }

  async extractText(
    buffer: Buffer,
    filename: string
  ): Promise<{ content: string; thumbnail?: string }> {
    console.log(`Processing Word document "${filename}"...`);

    try {
      const mammoth = require("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      console.log("Word parsed", result);

      return {
        content: result.value,
        thumbnail: undefined, // Word documents don't have thumbnails by default
      };
    } catch (error) {
      console.error(`Failed to parse Word document "${filename}":`, error);
      throw new Error(
        `Word processing failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
