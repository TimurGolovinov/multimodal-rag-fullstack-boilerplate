import { DocumentProcessor } from "../documentService";

export class PdfProcessorAdapter implements DocumentProcessor {
  canProcess(mimetype: string, filename: string): boolean {
    return (
      mimetype === "application/pdf" || filename.toLowerCase().endsWith(".pdf")
    );
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
      console.log("PDF parsed", data);
      console.log(
        `🔍 PDFProcessor debug - Extracted text length: ${data.text.length} characters`
      );

      return {
        content: data.text,
        thumbnail: undefined, // PDFs don't have thumbnails by default
      };
    } catch (error) {
      console.error(`Failed to parse PDF "${filename}":`, error);
      throw new Error(
        `PDF processing failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
