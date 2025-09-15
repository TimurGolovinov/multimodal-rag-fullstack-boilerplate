import { OpenAIStreamingService } from "../../src/services/openaiStreamingService";

// Mock OpenAI
jest.mock("openai", () => {
  const mockOpenAI = jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  }));

  return {
    __esModule: true,
    default: mockOpenAI,
    OpenAI: mockOpenAI,
  };
});

describe("Streaming Resilience Tests", () => {
  let streamingService: OpenAIStreamingService;
  let mockOpenAI: any;

  beforeEach(() => {
    jest.clearAllMocks();
    streamingService = new OpenAIStreamingService();
    mockOpenAI = (streamingService as any).openai;
  });

  describe("Network Resilience", () => {
    it("should handle network timeouts gracefully", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [{ delta: { content: "Hello" }, finish_reason: null }],
          };
          // Simulate network timeout
          await new Promise((resolve) => setTimeout(resolve, 35000)); // 35 seconds
          yield {
            choices: [{ delta: { content: " world" }, finish_reason: "stop" }],
          };
        },
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockStream);

      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      // Should timeout after 30 seconds
      await streamingService.streamChatWithContext(
        "Test message",
        "Test context",
        onChunk,
        onComplete,
        onError
      );

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(onComplete).not.toHaveBeenCalled();
    });

    it("should handle partial stream failures", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [{ delta: { content: "Hello" }, finish_reason: null }],
          };
          throw new Error("Network error");
        },
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockStream);

      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      await streamingService.streamChatWithContext(
        "Test message",
        "Test context",
        onChunk,
        onComplete,
        onError
      );

      expect(onChunk).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(onComplete).not.toHaveBeenCalled();
    });

    it("should handle malformed stream data", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [{ delta: { content: "Hello" }, finish_reason: null }],
          };
          yield {
            // Malformed data - missing choices
            invalidField: "invalid",
          };
          yield {
            choices: [{ delta: { content: " world" }, finish_reason: "stop" }],
          };
        },
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockStream);

      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      await streamingService.streamChatWithContext(
        "Test message",
        "Test context",
        onChunk,
        onComplete,
        onError
      );

      // Should skip malformed data and continue
      expect(onChunk).toHaveBeenCalledTimes(2);
      expect(onComplete).toHaveBeenCalledWith("Hello world");
    });
  });

  describe("Memory Management", () => {
    it("should handle large context without memory issues", async () => {
      const largeContext = "x".repeat(100000); // 100KB context

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [
              { delta: { content: "Response" }, finish_reason: "stop" },
            ],
          };
        },
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockStream);

      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      await streamingService.streamChatWithContext(
        "Test message",
        largeContext,
        onChunk,
        onComplete,
        onError
      );

      expect(onComplete).toHaveBeenCalledWith("Response");
      expect(onError).not.toHaveBeenCalled();
    });

    it("should handle rapid successive requests", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [
              { delta: { content: "Response" }, finish_reason: "stop" },
            ],
          };
        },
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockStream);

      // Send 10 rapid requests
      const promises = Array(10)
        .fill(null)
        .map(() => {
          const onChunk = jest.fn();
          const onComplete = jest.fn();
          const onError = jest.fn();

          return streamingService
            .streamChatWithContext(
              "Test message",
              "Test context",
              onChunk,
              onComplete,
              onError
            )
            .then(() => ({ onChunk, onComplete, onError }));
        });

      const results = await Promise.all(promises);

      // All should complete successfully
      results.forEach(({ onComplete, onError }) => {
        expect(onComplete).toHaveBeenCalledWith("Response");
        expect(onError).not.toHaveBeenCalled();
      });
    });
  });

  describe("Error Recovery", () => {
    it("should retry on temporary OpenAI API errors", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [{ delta: { content: "Hello" }, finish_reason: null }],
          };
          throw new Error("Rate limit exceeded");
        },
      };

      mockOpenAI.chat.completions.create
        .mockRejectedValueOnce(new Error("Rate limit exceeded"))
        .mockResolvedValueOnce(mockStream);

      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      await streamingService.streamChatWithContext(
        "Test message",
        "Test context",
        onChunk,
        onComplete,
        onError
      );

      // Should retry and succeed
      expect(onChunk).toHaveBeenCalledWith({
        type: "chunk",
        content: "Hello",
        timestamp: expect.any(String),
      });
      expect(onComplete).toHaveBeenCalledWith("Hello");
    });

    it("should handle OpenAI API quota exceeded", async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error("Quota exceeded")
      );

      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      await streamingService.streamChatWithContext(
        "Test message",
        "Test context",
        onChunk,
        onComplete,
        onError
      );

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(onChunk).not.toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled();
    });
  });

  describe("Content Validation", () => {
    it("should handle empty responses", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [{ delta: { content: "" }, finish_reason: "stop" }],
          };
        },
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockStream);

      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      await streamingService.streamChatWithContext(
        "Test message",
        "Test context",
        onChunk,
        onComplete,
        onError
      );

      expect(onChunk).not.toHaveBeenCalled(); // Empty content should be filtered
      expect(onComplete).toHaveBeenCalledWith("");
    });

    it("should handle very long responses", async () => {
      const longContent = "x".repeat(50000); // 50KB response

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [
              { delta: { content: longContent }, finish_reason: "stop" },
            ],
          };
        },
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockStream);

      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      await streamingService.streamChatWithContext(
        "Test message",
        "Test context",
        onChunk,
        onComplete,
        onError
      );

      expect(onComplete).toHaveBeenCalledWith(longContent);
      expect(onError).not.toHaveBeenCalled();
    });

    it("should handle special characters in responses", async () => {
      const specialContent = "Hello 🌍 World! @#$%^&*()_+{}|:<>?[]\\;'\",./";

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [
              { delta: { content: specialContent }, finish_reason: "stop" },
            ],
          };
        },
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockStream);

      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      await streamingService.streamChatWithContext(
        "Test message",
        "Test context",
        onChunk,
        onComplete,
        onError
      );

      expect(onComplete).toHaveBeenCalledWith(specialContent);
    });
  });

  describe("Concurrent Streaming", () => {
    it("should handle multiple concurrent streams", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [
              { delta: { content: "Response" }, finish_reason: "stop" },
            ],
          };
        },
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockStream);

      // Start 5 concurrent streams
      const promises = Array(5)
        .fill(null)
        .map((_, index) => {
          const onChunk = jest.fn();
          const onComplete = jest.fn();
          const onError = jest.fn();

          return streamingService
            .streamChatWithContext(
              `Test message ${index}`,
              "Test context",
              onChunk,
              onComplete,
              onError
            )
            .then(() => ({ onChunk, onComplete, onError, index }));
        });

      const results = await Promise.all(promises);

      // All should complete successfully
      results.forEach(({ onComplete, onError, index }) => {
        expect(onComplete).toHaveBeenCalledWith("Response");
        expect(onError).not.toHaveBeenCalled();
      });
    });
  });
});
