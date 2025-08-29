import { DocumentProcessor } from "../documentService";
import { ImageProcessingService } from "../imageProcessingService";

export class ImageProcessorAdapter implements DocumentProcessor {
  private imageService: ImageProcessingService;

  constructor() {
    this.imageService = new ImageProcessingService();
  }

  canProcess(mimetype: string, filename: string): boolean {
    return (
      mimetype.startsWith("image/") ||
      ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(
        filename.split(".").pop()?.toLowerCase() || ""
      )
    );
  }

  async extractText(
    buffer: Buffer,
    filename: string
  ): Promise<{ content: string; thumbnail?: string }> {
    console.log(`Processing image "${filename}"...`);
    const result = await this.imageService.extractTextFromImage(
      buffer,
      filename
    );
    console.log(`Image processing completed for "${filename}"`);

    return {
      content: result.content,
      thumbnail: result.thumbnail,
    };
  }
}
