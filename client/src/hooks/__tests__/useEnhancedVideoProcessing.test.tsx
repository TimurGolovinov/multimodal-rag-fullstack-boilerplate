/**
 * Tests for useEnhancedVideoProcessing hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useEnhancedVideoProcessing } from "../useEnhancedVideoProcessing";

// Mock enhancedVideoProcessor
vi.mock("../../services/enhancedVideoProcessor", () => ({
  enhancedVideoProcessor: {
    constructor: {
      isSupported: vi.fn(() => true),
    },
    processVideo: vi.fn(),
    prepareForUpload: vi.fn(),
    dispose: vi.fn(),
  },
}));

// Mock fetch
global.fetch = vi.fn();

describe("useEnhancedVideoProcessing", () => {
  let mockFile: File;
  let mockProcessVideo: any;
  let mockPrepareForUpload: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFile = new File(["test video content"], "test.mp4", {
      type: "video/mp4",
    });

    // Mock enhancedVideoProcessor methods
    const {
      enhancedVideoProcessor,
    } = require("../../services/enhancedVideoProcessor");
    mockProcessVideo = vi.fn();
    mockPrepareForUpload = vi.fn();

    enhancedVideoProcessor.processVideo = mockProcessVideo;
    enhancedVideoProcessor.prepareForUpload = mockPrepareForUpload;
    enhancedVideoProcessor.dispose = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initial state", () => {
    it("should have correct initial state", () => {
      const { result } = renderHook(() => useEnhancedVideoProcessing());

      expect(result.current.isProcessing).toBe(false);
      expect(result.current.progress).toBe(0);
      expect(result.current.stage).toBe("initializing");
      expect(result.current.message).toBe("Ready to process video");
      expect(result.current.error).toBe(null);
      expect(result.current.result).toBe(null);
      expect(result.current.isSupported).toBe(true);
    });

    it("should always be supported with Canvas API", () => {
      const { result } = renderHook(() => useEnhancedVideoProcessing());

      expect(result.current.isSupported).toBe(true);
    });
  });

  describe("processVideo", () => {
    it("should process video successfully", async () => {
      const mockResult = {
        frames: [],
        audioSegments: [],
        duration: 60,
        frameCount: 0,
        audioSegmentCount: 0,
        contentType: "mixed" as const,
        recommendedProcessing: "hybrid" as const,
      };

      mockProcessVideo.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useEnhancedVideoProcessing());

      await act(async () => {
        await result.current.processVideo(mockFile);
      });

      expect(result.current.isProcessing).toBe(false);
      expect(result.current.result).toEqual(mockResult);
      expect(result.current.error).toBe(null);
    });

    it("should handle processing errors", async () => {
      const error = new Error("Processing failed");
      mockProcessVideo.mockRejectedValue(error);

      const onError = vi.fn();
      const { result } = renderHook(() =>
        useEnhancedVideoProcessing({ onError })
      );

      await act(async () => {
        try {
          await result.current.processVideo(mockFile);
        } catch (e) {
          // Expected to throw
        }
      });

      expect(result.current.isProcessing).toBe(false);
      expect(result.current.error).toBe("Processing failed");
      expect(onError).toHaveBeenCalledWith(error);
    });

    it("should call onProgress callback", async () => {
      const mockResult = {
        frames: [],
        audioSegments: [],
        duration: 60,
        frameCount: 0,
        audioSegmentCount: 0,
        contentType: "mixed" as const,
        recommendedProcessing: "hybrid" as const,
      };

      mockProcessVideo.mockImplementation((file, onProgress) => {
        onProgress?.({
          stage: "extracting",
          progress: 50,
          message: "Processing...",
          currentStep: "Extracting frames",
        });
        return Promise.resolve(mockResult);
      });

      const onProgress = vi.fn();
      const { result } = renderHook(() =>
        useEnhancedVideoProcessing({ onProgress })
      );

      await act(async () => {
        await result.current.processVideo(mockFile);
      });

      expect(onProgress).toHaveBeenCalledWith({
        stage: "extracting",
        progress: 50,
        message: "Processing...",
        currentStep: "Extracting frames",
      });
    });

    it("should handle timeout", async () => {
      mockProcessVideo.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      const { result } = renderHook(() => useEnhancedVideoProcessing());

      // Mock setTimeout to trigger timeout immediately
      vi.spyOn(global, "setTimeout").mockImplementation((callback) => {
        callback();
        return {} as any;
      });

      await act(async () => {
        try {
          await result.current.processVideo(mockFile);
        } catch (e) {
          // Expected to throw due to timeout
        }
      });

      expect(result.current.error).toContain("timeout");
    });

    it("should throw error when not supported", async () => {
      const {
        enhancedVideoProcessor,
      } = require("../../services/enhancedVideoProcessor");
      enhancedVideoProcessor.constructor.isSupported = vi.fn(() => false);

      const { result } = renderHook(() => useEnhancedVideoProcessing());

      await act(async () => {
        try {
          await result.current.processVideo(mockFile);
        } catch (e) {
          // Expected to throw
        }
      });

      expect(result.current.error).toContain("not supported");
    });
  });

  describe("uploadToServer", () => {
    it("should upload to server successfully", async () => {
      const mockResult = {
        frames: [],
        audioSegments: [],
        duration: 60,
        frameCount: 0,
        audioSegmentCount: 0,
        contentType: "mixed" as const,
        recommendedProcessing: "hybrid" as const,
      };

      const mockFormData = new FormData();
      mockPrepareForUpload.mockReturnValue(mockFormData);

      const mockServerResponse = {
        success: true,
        document: { id: "123", filename: "test.txt", type: "video" },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockServerResponse),
      });

      const { result } = renderHook(() => useEnhancedVideoProcessing());

      // Set result first
      act(() => {
        result.current.result = mockResult;
      });

      const serverResult = await act(async () => {
        return await result.current.uploadToServer(mockResult, "test.mp4");
      });

      expect(serverResult).toEqual(mockServerResponse);
      expect(global.fetch).toHaveBeenCalledWith("/api/video/process", {
        method: "POST",
        body: mockFormData,
        credentials: "include",
      });
    });

    it("should handle upload errors", async () => {
      const mockResult = {
        frames: [],
        audioSegments: [],
        duration: 60,
        frameCount: 0,
        audioSegmentCount: 0,
        contentType: "mixed" as const,
        recommendedProcessing: "hybrid" as const,
      };

      mockPrepareForUpload.mockReturnValue(new FormData());

      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const { result } = renderHook(() => useEnhancedVideoProcessing());

      act(() => {
        result.current.result = mockResult;
      });

      await act(async () => {
        try {
          await result.current.uploadToServer(mockResult, "test.mp4");
        } catch (e) {
          // Expected to throw
        }
      });

      expect(result.current.error).toContain("Server upload failed");
    });
  });

  describe("cancelProcessing", () => {
    it("should cancel processing", async () => {
      const { result } = renderHook(() => useEnhancedVideoProcessing());

      act(() => {
        result.current.cancelProcessing();
      });

      expect(result.current.isProcessing).toBe(false);
      expect(result.current.message).toBe("Processing cancelled");
    });
  });

  describe("reset", () => {
    it("should reset state", async () => {
      const { result } = renderHook(() => useEnhancedVideoProcessing());

      // Set some state first
      act(() => {
        result.current.result = {
          frames: [],
          audioSegments: [],
          duration: 60,
          frameCount: 0,
          audioSegmentCount: 0,
          contentType: "mixed" as const,
          recommendedProcessing: "hybrid" as const,
        };
        result.current.error = "Some error";
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.isProcessing).toBe(false);
      expect(result.current.progress).toBe(0);
      expect(result.current.stage).toBe("initializing");
      expect(result.current.message).toBe("Ready to process video");
      expect(result.current.error).toBe(null);
      expect(result.current.result).toBe(null);
    });
  });

  describe("cleanup", () => {
    it("should cleanup on unmount", () => {
      const { result, unmount } = renderHook(() =>
        useEnhancedVideoProcessing()
      );

      act(() => {
        result.current.cleanup();
      });

      const {
        enhancedVideoProcessor,
      } = require("../../services/enhancedVideoProcessor");
      expect(enhancedVideoProcessor.dispose).toHaveBeenCalled();

      unmount();
    });
  });

  describe("options", () => {
    it("should call onComplete callback", async () => {
      const mockResult = {
        frames: [],
        audioSegments: [],
        duration: 60,
        frameCount: 0,
        audioSegmentCount: 0,
        contentType: "mixed" as const,
        recommendedProcessing: "hybrid" as const,
      };

      mockProcessVideo.mockResolvedValue(mockResult);

      const onComplete = vi.fn();
      const { result } = renderHook(() =>
        useEnhancedVideoProcessing({ onComplete })
      );

      await act(async () => {
        await result.current.processVideo(mockFile);
      });

      expect(onComplete).toHaveBeenCalledWith(mockResult);
    });

    it("should call onProgress callback", async () => {
      const mockResult = {
        frames: [],
        audioSegments: [],
        duration: 60,
        frameCount: 0,
        audioSegmentCount: 0,
        contentType: "mixed" as const,
        recommendedProcessing: "hybrid" as const,
      };

      mockProcessVideo.mockImplementation((file, onProgress) => {
        onProgress?.({
          stage: "extracting",
          progress: 50,
          message: "Processing...",
          currentStep: "Extracting frames",
        });
        return Promise.resolve(mockResult);
      });

      const onProgress = vi.fn();
      const { result } = renderHook(() =>
        useEnhancedVideoProcessing({ onProgress })
      );

      await act(async () => {
        await result.current.processVideo(mockFile);
      });

      expect(onProgress).toHaveBeenCalledWith({
        stage: "extracting",
        progress: 50,
        message: "Processing...",
        currentStep: "Extracting frames",
      });
    });
  });
});
