import { DocumentProcessor } from "../documentService";

export class PdfProcessorAdapter implements DocumentProcessor {
  canProcess(mimetype: string, filename: string): boolean {
    // Check for PDF MIME types
    if (mimetype === "application/pdf" || mimetype === "application/x-pdf") {
      const parts = filename.split(".");
      // File must have at least 2 parts (name.extension) and extension must be valid
      if (parts.length < 2) return false;
      const ext = parts.pop()?.toLowerCase() || "";
      return ext === "pdf";
    }

    // Check for PDF file extension
    const parts = filename.split(".");
    if (parts.length < 2) return false;
    return parts.pop()?.toLowerCase() === "pdf";
  }

  async extractText(
    buffer: Buffer,
    filename: string
  ): Promise<{ content: string; thumbnail?: string }> {
    console.log(`Processing PDF "${filename}"...`);
    console.log(
      `🔍 PDFProcessor debug - Buffer length: ${buffer.length} bytes`
    );

    try {
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(buffer);

      // Handle null or undefined text
      const content = data.text || "";

      console.log(`📄 Extracted text length: ${content.length} characters`);

      console.log(`PDF processing completed for "${filename}"`);

      return {
        content: content,
        thumbnail: undefined, // PDFs don't have thumbnails by default
      };
    } catch (error) {
      console.error(`Failed to parse PDF "${filename}":`, error);
      return {
        content: "",
        thumbnail: undefined,
      };
    }
  }
}
