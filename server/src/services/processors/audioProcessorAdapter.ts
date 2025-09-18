import { DocumentProcessor } from "../documentService";
import { AudioProcessingService } from "../audioProcessingService";

export class AudioProcessorAdapter implements DocumentProcessor {
  private audioService: AudioProcessingService;

  constructor() {
    this.audioService = new AudioProcessingService();
  }

  canProcess(mimetype: string, filename: string): boolean {
    // Check for audio file extensions first
    const parts = filename.split(".");
    if (parts.length < 2) {
      return false; // No extension
    }

    const ext = parts.pop()?.toLowerCase();
    if (!ext) {
      return false; // No extension
    }

    const audioExtensions = [
      "mp3", "wav", "m4a", "ogg", "flac", "aac", "wma", "opus"
    ];
    
    // If it has an audio extension, it's audio
    if (audioExtensions.includes(ext)) {
      return true;
    }

    // Check for audio MIME types as fallback
    return mimetype.startsWith("audio/");
  }

  async extractText(
    buffer: Buffer,
    filename: string
  ): Promise<{ content: string; thumbnail?: string }> {
    console.log(`Processing audio "${filename}" with Whisper...`);
    
    // Handle null or undefined buffer
    if (!buffer) {
      console.warn(`⚠️ AudioProcessor: Buffer is null or undefined for "${filename}"`);
      return {
        content: "",
        thumbnail: undefined,
      };
    }

    console.log(`🔍 AudioProcessor debug - Buffer length: ${buffer.length} bytes`);

    try {
      const content = await this.audioService.extractTextFromAudio(
        buffer,
        filename
      );
      console.log(`Audio processing completed for "${filename}"`);

      return {
        content: content || "", // Handle null/undefined content
        thumbnail: undefined, // Audio files don't have thumbnails
      };
    } catch (error) {
      console.warn(
        `⚠️ AudioProcessor: Failed to process "${filename}":`,
        error instanceof Error ? error.message : "Unknown error"
      );
      
      return {
        content: "",
        thumbnail: undefined,
      };
    }
  }
}
