import { AudioProcessorAdapter } from "../../src/services/processors/audioProcessorAdapter";
import { AudioProcessingService } from "../../src/services/audioProcessingService";

// Mock AudioProcessingService
jest.mock("../../src/services/audioProcessingService");
const MockedAudioProcessingService = AudioProcessingService as jest.MockedClass<
  typeof AudioProcessingService
>;

describe("AudioProcessorAdapter", () => {
  let processor: AudioProcessorAdapter;
  let mockAudioService: jest.Mocked<AudioProcessingService>;
  let mockBuffer: Buffer;

  beforeEach(() => {
    jest.clearAllMocks();

    mockBuffer = Buffer.from("mock audio content");

    mockAudioService = {
      extractTextFromAudio: jest.fn(),
    } as any;

    MockedAudioProcessingService.mockImplementation(() => mockAudioService);
    processor = new AudioProcessorAdapter();
  });

  describe("canProcess", () => {
    it("should return true for audio MIME types", () => {
      expect(processor.canProcess("audio/mpeg", "test.mp3")).toBe(true);
      expect(processor.canProcess("audio/wav", "test.wav")).toBe(true);
      expect(processor.canProcess("audio/ogg", "test.ogg")).toBe(true);
      expect(processor.canProcess("audio/flac", "test.flac")).toBe(true);
      expect(processor.canProcess("audio/aac", "test.aac")).toBe(true);
      expect(processor.canProcess("audio/m4a", "test.m4a")).toBe(true);
    });

    it("should return true for audio file extensions", () => {
      expect(processor.canProcess("application/octet-stream", "test.mp3")).toBe(
        true
      );
      expect(processor.canProcess("application/octet-stream", "test.wav")).toBe(
        true
      );
      expect(processor.canProcess("application/octet-stream", "test.ogg")).toBe(
        true
      );
      expect(
        processor.canProcess("application/octet-stream", "test.flac")
      ).toBe(true);
      expect(processor.canProcess("application/octet-stream", "test.aac")).toBe(
        true
      );
      expect(processor.canProcess("application/octet-stream", "test.m4a")).toBe(
        true
      );
    });

    it("should return false for non-audio files", () => {
      expect(processor.canProcess("text/plain", "test.txt")).toBe(false);
      expect(processor.canProcess("application/pdf", "test.pdf")).toBe(false);
      expect(processor.canProcess("image/jpeg", "test.jpg")).toBe(false);
      expect(processor.canProcess("video/mp4", "test.mp4")).toBe(false);
    });

    it("should handle case-insensitive file extensions", () => {
      expect(processor.canProcess("application/octet-stream", "test.MP3")).toBe(
        true
      );
      expect(processor.canProcess("application/octet-stream", "test.WAV")).toBe(
        true
      );
      expect(processor.canProcess("application/octet-stream", "test.OGG")).toBe(
        true
      );
    });

    it("should return false for files without extensions", () => {
      expect(processor.canProcess("audio/mpeg", "test")).toBe(false);
      expect(processor.canProcess("audio/mpeg", "")).toBe(false);
    });
  });

  describe("extractText", () => {
    it("should successfully extract text from audio", async () => {
      const mockContent = "Transcribed text from audio";
      mockAudioService.extractTextFromAudio.mockResolvedValue(mockContent);

      const result = await processor.extractText(mockBuffer, "test.mp3");

      expect(mockAudioService.extractTextFromAudio).toHaveBeenCalledWith(
        mockBuffer,
        "test.mp3"
      );
      expect(result).toEqual({
        content: mockContent,
        thumbnail: undefined,
      });
    });

    it("should handle audio with no speech content", async () => {
      const mockContent = "";
      mockAudioService.extractTextFromAudio.mockResolvedValue(mockContent);

      const result = await processor.extractText(mockBuffer, "test.mp3");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle audio with only background noise", async () => {
      const mockContent = "[Background noise]";
      mockAudioService.extractTextFromAudio.mockResolvedValue(mockContent);

      const result = await processor.extractText(mockBuffer, "test.mp3");

      expect(result).toEqual({
        content: "[Background noise]",
        thumbnail: undefined,
      });
    });

    it("should handle audio processing errors gracefully", async () => {
      mockAudioService.extractTextFromAudio.mockRejectedValue(
        new Error("Audio processing failed")
      );

      const result = await processor.extractText(mockBuffer, "test.mp3");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle corrupted audio files", async () => {
      mockAudioService.extractTextFromAudio.mockRejectedValue(
        new Error("Invalid audio format")
      );

      const result = await processor.extractText(mockBuffer, "corrupted.mp3");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle unsupported audio formats", async () => {
      mockAudioService.extractTextFromAudio.mockRejectedValue(
        new Error("Unsupported audio format")
      );

      const result = await processor.extractText(mockBuffer, "test.unknown");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle large audio files", async () => {
      const largeText = "A".repeat(50000); // 50KB of text
      const mockResult = {
        content: largeText,
        thumbnail: undefined,
      };

      mockAudioService.extractTextFromAudio.mockResolvedValue(
        mockResult.content
      );

      const result = await processor.extractText(mockBuffer, "large.mp3");

      expect(result.content).toBe(largeText);
      expect(result.content.length).toBe(50000);
    });

    it("should handle audio with special characters in transcription", async () => {
      const specialText = "Transcription with special chars: àáâãäåæçèéêë";
      const mockResult = {
        content: specialText,
        thumbnail: undefined,
      };

      mockAudioService.extractTextFromAudio.mockResolvedValue(
        mockResult.content
      );

      const result = await processor.extractText(mockBuffer, "special.mp3");

      expect(result.content).toBe(specialText);
    });

    it("should handle audio with multiple speakers", async () => {
      const multiSpeakerText =
        "Speaker 1: Hello there\nSpeaker 2: How are you?\nSpeaker 1: I am fine, thank you";
      const mockResult = {
        content: multiSpeakerText,
        thumbnail: undefined,
      };

      mockAudioService.extractTextFromAudio.mockResolvedValue(
        mockResult.content
      );

      const result = await processor.extractText(
        mockBuffer,
        "multispeaker.mp3"
      );

      expect(result.content).toBe(multiSpeakerText);
    });

    it("should handle empty buffer", async () => {
      const emptyBuffer = Buffer.alloc(0);
      mockAudioService.extractTextFromAudio.mockRejectedValue(
        new Error("Empty buffer")
      );

      const result = await processor.extractText(emptyBuffer, "empty.mp3");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle null or undefined text from audio service", async () => {
      const mockContent = null as any;
      mockAudioService.extractTextFromAudio.mockResolvedValue(mockContent);

      const result = await processor.extractText(mockBuffer, "test.mp3");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });
  });

  describe("error handling", () => {
    it("should handle unexpected errors during processing", async () => {
      mockAudioService.extractTextFromAudio.mockRejectedValue(
        new Error("Unexpected error")
      );

      const result = await processor.extractText(mockBuffer, "test.mp3");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle timeout errors", async () => {
      mockAudioService.extractTextFromAudio.mockRejectedValue(
        new Error("Timeout")
      );

      const result = await processor.extractText(mockBuffer, "test.mp3");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle memory errors", async () => {
      mockAudioService.extractTextFromAudio.mockRejectedValue(
        new Error("Out of memory")
      );

      const result = await processor.extractText(mockBuffer, "test.mp3");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });

    it("should handle network errors", async () => {
      mockAudioService.extractTextFromAudio.mockRejectedValue(
        new Error("Network error")
      );

      const result = await processor.extractText(mockBuffer, "test.mp3");

      expect(result).toEqual({
        content: "",
        thumbnail: undefined,
      });
    });
  });

  describe("logging", () => {
    it("should log processing start and completion", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const mockResult = {
        content: "Test content",
        thumbnail: undefined,
      };

      mockAudioService.extractTextFromAudio.mockResolvedValue(
        mockResult.content
      );

      await processor.extractText(mockBuffer, "test.mp3");

      expect(consoleSpy).toHaveBeenCalledWith(
        'Processing audio "test.mp3" with Whisper...'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        'Audio processing completed for "test.mp3"'
      );

      consoleSpy.mockRestore();
    });

    it("should log debug information", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const mockResult = {
        content: "Test content",
        thumbnail: undefined,
      };

      mockAudioService.extractTextFromAudio.mockResolvedValue(
        mockResult.content
      );

      await processor.extractText(mockBuffer, "test.mp3");

      expect(consoleSpy).toHaveBeenCalledWith(
        "🔍 AudioProcessor debug - Buffer length: 18 bytes"
      );

      consoleSpy.mockRestore();
    });
  });

  describe("service initialization", () => {
    it("should create AudioProcessingService instance", () => {
      expect(MockedAudioProcessingService).toHaveBeenCalledTimes(1);
    });

    it("should use the same service instance for multiple calls", async () => {
      const mockResult = {
        content: "Test content",
        thumbnail: undefined,
      };

      mockAudioService.extractTextFromAudio.mockResolvedValue(
        mockResult.content
      );

      await processor.extractText(mockBuffer, "test1.mp3");
      await processor.extractText(mockBuffer, "test2.mp3");

      expect(mockAudioService.extractTextFromAudio).toHaveBeenCalledTimes(2);
    });
  });
});
