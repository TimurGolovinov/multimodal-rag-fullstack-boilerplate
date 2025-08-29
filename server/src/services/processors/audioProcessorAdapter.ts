import { DocumentProcessor } from "../documentService";
import { AudioProcessingService } from "../audioProcessingService";

export class AudioProcessorAdapter implements DocumentProcessor {
  private audioService: AudioProcessingService;

  constructor() {
    this.audioService = new AudioProcessingService();
  }

  canProcess(mimetype: string, filename: string): boolean {
    return (
      mimetype.startsWith("audio/") ||
      ["mp3", "wav", "m4a", "ogg", "flac", "aac", "wma", "opus"].includes(
        filename.split(".").pop()?.toLowerCase() || ""
      )
    );
  }

  async extractText(
    buffer: Buffer,
    filename: string
  ): Promise<{ content: string; thumbnail?: string }> {
    console.log(`Processing audio "${filename}" with Whisper...`);
    const content = await this.audioService.extractTextFromAudio(
      buffer,
      filename
    );
    console.log(`Audio processing completed for "${filename}"`);

    return {
      content,
      thumbnail: undefined, // Audio files don't have thumbnails
    };
  }
}
