import { DocumentProcessor } from "../documentService";
import { VideoProcessingService } from "../videoProcessingService";

export class VideoProcessorAdapter implements DocumentProcessor {
  private videoService: VideoProcessingService;

  constructor() {
    this.videoService = new VideoProcessingService();
  }

  canProcess(mimetype: string, filename: string): boolean {
    // Check for video file extensions first
    const parts = filename.split(".");
    if (parts.length < 2) {
      return false; // No extension
    }

    const ext = parts.pop()?.toLowerCase();
    if (!ext) {
      return false; // No extension
    }

    const videoExtensions = [
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
    ];

    // If it has a video extension, it's a video
    if (videoExtensions.includes(ext)) {
      return true;
    }

    // Check for video MIME types as fallback
    return mimetype.startsWith("video/");
  }

  async extractText(
    buffer: Buffer,
    filename: string
  ): Promise<{ content: string; thumbnail?: string }> {
    console.log(`Processing video "${filename}" with optimized pipeline...`);

    // Handle null or undefined buffer
    if (!buffer) {
      console.warn(
        `⚠️ VideoProcessor: Buffer is null or undefined for "${filename}"`
      );
      return {
        content: "",
        thumbnail: undefined,
      };
    }

    console.log(
      `🔍 VideoProcessor debug - Buffer length: ${buffer.length} bytes`
    );

    try {
      const result = await this.videoService.extractTextFromVideo(
        buffer,
        filename
      );
      console.log(`Video processing completed for "${filename}"`);

      return {
        content: result.content || "", // Handle null/undefined content
        thumbnail: result.thumbnail || undefined,
      };
    } catch (error) {
      console.warn(
        `⚠️ VideoProcessor: Failed to process "${filename}":`,
        error instanceof Error ? error.message : "Unknown error"
      );

      return {
        content: "",
        thumbnail: undefined,
      };
    }
  }
}
