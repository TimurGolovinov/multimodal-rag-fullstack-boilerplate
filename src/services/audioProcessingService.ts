import OpenAI from "openai";
import { AudioAnalysis } from "../types";

export class AudioProcessingService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async transcribeAudio(
    audioBuffer: Buffer,
    filename: string
  ): Promise<AudioAnalysis> {
    try {
      console.log(`Transcribing audio "${filename}" with Whisper...`);

      // Create a file-like object for OpenAI API
      const file = new File([audioBuffer], filename, {
        type: this.getAudioMimeType(filename),
      });

      const response = await this.openai.audio.transcriptions.create({
        file: file as any, // OpenAI types expect File but we can pass Buffer
        model: "whisper-1",
        response_format: "verbose_json",
        language: "en", // You can make this configurable
      });

      console.log(`Audio transcription completed for "${filename}"`);

      return {
        transcript: response.text,
        language: response.language,
        duration: response.duration,
        confidence: 0.95, // Whisper is generally very accurate
      };
    } catch (error) {
      console.error("Error transcribing audio with Whisper:", error);
      throw new Error(
        `Failed to transcribe audio: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async extractTextFromAudio(
    audioBuffer: Buffer,
    filename: string
  ): Promise<string> {
    try {
      const analysis = await this.transcribeAudio(audioBuffer, filename);

      // Format the transcript with metadata for better search
      let textContent = `Audio Transcript:\n${analysis.transcript}`;

      if (analysis.language) {
        textContent += `\n\nLanguage: ${analysis.language}`;
      }

      if (analysis.duration) {
        const minutes = Math.floor(analysis.duration / 60);
        const seconds = Math.floor(analysis.duration % 60);
        textContent += `\n\nDuration: ${minutes}:${seconds
          .toString()
          .padStart(2, "0")}`;
      }

      return textContent;
    } catch (error) {
      console.error("Error extracting text from audio:", error);
      throw error;
    }
  }

  private getAudioMimeType(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "mp3":
        return "audio/mpeg";
      case "wav":
        return "audio/wav";
      case "m4a":
        return "audio/mp4";
      case "ogg":
        return "audio/ogg";
      case "flac":
        return "audio/flac";
      case "aac":
        return "audio/aac";
      default:
        return "audio/mpeg"; // fallback
    }
  }

  isAudioFile(filename: string): boolean {
    const ext = filename.split(".").pop()?.toLowerCase();
    return ["mp3", "wav", "m4a", "ogg", "flac", "aac", "wma", "opus"].includes(
      ext || ""
    );
  }
}
