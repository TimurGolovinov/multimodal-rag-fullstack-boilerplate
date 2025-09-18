/**
 * Tests for EnhancedVideoProcessor (Canvas API only)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  EnhancedVideoProcessor,
  VideoAnalysisResult,
} from "../enhancedVideoProcessor";

// Mock HTML5 video element
const mockVideo = {
  addEventListener: vi.fn((event, callback) => {
    if (event === "loadedmetadata") {
      // Simulate immediate metadata loading
      callback();
    } else if (event === "seeked") {
      // Simulate immediate seek completion
      callback();
    }
  }),
  duration: 30,
  videoWidth: 1920,
  videoHeight: 1080,
  currentTime: 0,
  src: "mock-video.mp4",
};

// Mock HTML5 canvas element
const mockCanvas = {
  width: 1920,
  height: 1080,
  toDataURL: vi.fn(() => "data:image/jpeg;base64,mock-image-data"),
  getContext: vi.fn(() => ({
    drawImage: vi.fn(),
  })),
};

// Mock DOM methods
Object.defineProperty(document, "createElement", {
  value: vi.fn((tagName) => {
    if (tagName === "video") return mockVideo;
    if (tagName === "canvas") return mockCanvas;
    return {};
  }),
});

// Mock File
const mockFile = new File(["mock video content"], "test.mp4", {
  type: "video/mp4",
});

describe("EnhancedVideoProcessor", () => {
  let processor: EnhancedVideoProcessor;

  beforeEach(() => {
    processor = new EnhancedVideoProcessor();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isSupported", () => {
    it("should always return true for Canvas API", () => {
      expect(EnhancedVideoProcessor.isSupported()).toBe(true);
    });
  });

  describe("analyzeVideo", () => {
    it("should analyze video using Canvas API fallback", async () => {
      const result = await processor.analyzeVideo(mockFile);

      expect(result).toHaveProperty("duration", 30);
      expect(result).toHaveProperty("contentType", "mixed");
      expect(result).toHaveProperty("recommendedProcessing", "hybrid");
      expect(result).toHaveProperty("frameCount");
      expect(result).toHaveProperty("audioSegmentCount");
      expect(result.frames).toHaveLength(0);
      expect(result.audioSegments).toHaveLength(0);
    });
  });

  describe("processVideo", () => {
    it("should process video using Canvas API", async () => {
      const result = await processor.processVideo(mockFile);

      expect(result).toHaveProperty("duration", 30);
      expect(result).toHaveProperty("frames");
      expect(result).toHaveProperty("audioSegments");
      expect(result.frames.length).toBeGreaterThan(0);
      expect(result.audioSegments.length).toBeGreaterThan(0);
    });

    it("should call progress callback if provided", async () => {
      const onProgress = vi.fn();
      await processor.processVideo(mockFile, onProgress);

      expect(onProgress).toHaveBeenCalledWith({
        stage: "processing",
        progress: 0.5,
      });
      expect(onProgress).toHaveBeenCalledWith({
        stage: "complete",
        progress: 1.0,
      });
    });
  });

  describe("prepareForUpload", () => {
    it("should prepare FormData for upload", async () => {
      const result = await processor.processVideo(mockFile);
      const formData = processor.prepareForUpload(result);

      expect(formData).toBeInstanceOf(FormData);
      
      // Check that frames and audio segments are added
      const frameEntries = Array.from(formData.entries()).filter(
        ([key]) => key === "frames"
      );
      const audioEntries = Array.from(formData.entries()).filter(
        ([key]) => key === "audioSegments"
      );

      expect(frameEntries.length).toBeGreaterThan(0);
      expect(audioEntries.length).toBeGreaterThan(0);
    });

    it("should handle empty frames gracefully", async () => {
      const result: VideoAnalysisResult = {
        duration: 30,
        contentType: "mixed",
        recommendedProcessing: "hybrid",
        frameCount: 0,
        audioSegmentCount: 2,
        frames: [],
        audioSegments: [
          {
            data: "data:audio/wav;base64,test",
            startTime: 0,
            endTime: 15,
            duration: 15,
            segmentIndex: 0,
          },
        ],
      };

      const formData = processor.prepareForUpload(result);
      expect(formData).toBeInstanceOf(FormData);
    });
  });

  describe("createPlaceholderAudioSegments", () => {
    it("should create valid audio segments", () => {
      const segments = processor["createPlaceholderAudioSegments"](3, 30);

      expect(segments).toHaveLength(3);
      segments.forEach((segment, index) => {
        expect(segment).toHaveProperty("data");
        expect(segment).toHaveProperty("startTime");
        expect(segment).toHaveProperty("endTime");
        expect(segment).toHaveProperty("duration");
        expect(segment).toHaveProperty("segmentIndex", index);
        expect(segment.data).toMatch(/^data:audio\/wav;base64,/);
      });
    });
  });

  describe("getVideoDuration", () => {
    it("should get video duration using HTML5 video element", async () => {
      const duration = await processor["getVideoDuration"](mockFile);
      expect(duration).toBe(30);
    });
  });
});