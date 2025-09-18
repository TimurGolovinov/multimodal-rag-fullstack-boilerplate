import { DocumentProcessor } from "../documentService";
import { ImageProcessingService } from "../imageProcessingService";

export class ImageProcessorAdapter implements DocumentProcessor {
  private imageService: ImageProcessingService;

  constructor() {
    this.imageService = new ImageProcessingService();
  }

  canProcess(mimetype: string, filename: string): boolean {
    // Check for image file extensions first
    const parts = filename.split(".");
    if (parts.length < 2) {
      return false; // No extension
    }

    const ext = parts.pop()?.toLowerCase();
    if (!ext) {
      return false; // No extension
    }

    const imageExtensions = [
      "jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "tiff", "tif", "ico"
    ];
    
    // If it has an image extension, it's an image
    if (imageExtensions.includes(ext)) {
      return true;
    }

    // Check for image MIME types as fallback
    return mimetype.startsWith("image/");
  }

  async extractText(
    buffer: Buffer,
    filename: string
  ): Promise<{ content: string; thumbnail?: string }> {
    console.log(`Processing image "${filename}"...`);
    
    // Handle null or undefined buffer
    if (!buffer) {
      console.warn(`⚠️ ImageProcessor: Buffer is null or undefined for "${filename}"`);
      return {
        content: "",
        thumbnail: undefined,
      };
    }

    console.log(`🔍 ImageProcessor debug - Buffer length: ${buffer.length} bytes`);

    try {
      const result = await this.imageService.extractTextFromImage(
        buffer,
        filename
      );
      
      console.log(`Image processing completed for "${filename}"`);

      return {
        content: result.content || "", // Handle null/undefined content
        thumbnail: result.thumbnail,
      };
    } catch (error) {
      console.warn(
        `⚠️ ImageProcessor: Failed to process "${filename}":`,
        error instanceof Error ? error.message : "Unknown error"
      );
      
      return {
        content: "",
        thumbnail: undefined,
      };
    }
  }
}
