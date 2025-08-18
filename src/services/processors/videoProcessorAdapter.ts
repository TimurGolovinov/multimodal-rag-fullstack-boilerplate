import { DocumentProcessor } from "../documentService";
import { VideoProcessingService } from "../videoProcessingService";

export class VideoProcessorAdapter implements DocumentProcessor {
  private videoService: VideoProcessingService;

  constructor() {
    this.videoService = new VideoProcessingService();
  }

  canProcess(mimetype: string, filename: string): boolean {
    return (
      mimetype.startsWith("video/") ||
      [
        "mp4",
        "mov",
        "avi",
        "webm",
        "mkv",
        "flv",
        "wmv",
        "m4v",
        "3gp",
        "ogv",
      ].includes(filename.split(".").pop()?.toLowerCase() || "")
    );
  }

  async extractText(
    buffer: Buffer,
    filename: string
  ): Promise<{ content: string; thumbnail?: string }> {
    console.log(`Processing video "${filename}" with optimized pipeline...`);
    const result = await this.videoService.extractTextFromVideo(
      buffer,
      filename
    );
    console.log(`Video processing completed for "${filename}"`);

    return {
      content: result.content,
      thumbnail: result.thumbnail || undefined,
    };
  }
}
