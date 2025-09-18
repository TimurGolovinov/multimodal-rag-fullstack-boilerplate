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

describe("Streaming Implementation Tests", () => {
  let streamingService: OpenAIStreamingService;
  let mockOpenAI: any;

  beforeEach(() => {
    jest.clearAllMocks();

    streamingService = new OpenAIStreamingService();
    mockOpenAI = (streamingService as any).openai;
  });

  describe("streamChatWithContext", () => {
    it("should stream chat with context successfully", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [
              {
                delta: { content: "Hello" },
                finish_reason: null,
              },
            ],
          };
          yield {
            choices: [
              {
                delta: { content: " world" },
                finish_reason: null,
              },
            ],
          };
          yield {
            choices: [
              {
                delta: { content: "!" },
                finish_reason: "stop",
              },
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

      expect(onChunk).toHaveBeenCalledTimes(3);
      expect(onChunk).toHaveBeenNthCalledWith(1, {
        type: "chunk",
        content: "Hello",
        timestamp: expect.any(String),
      });
      expect(onChunk).toHaveBeenNthCalledWith(2, {
        type: "chunk",
        content: " world",
        timestamp: expect.any(String),
      });
      expect(onChunk).toHaveBeenNthCalledWith(3, {
        type: "chunk",
        content: "!",
        timestamp: expect.any(String),
      });

      expect(onComplete).toHaveBeenCalledWith("Hello world!");
      expect(onError).not.toHaveBeenCalled();
    });

    it("should filter out empty content chunks", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [
              {
                delta: { content: "Hello" },
                finish_reason: null,
              },
            ],
          };
          yield {
            choices: [
              {
                delta: { content: "" }, // Empty content
                finish_reason: null,
              },
            ],
          };
          yield {
            choices: [
              {
                delta: { content: " world" },
                finish_reason: null,
              },
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

      // Should only call onChunk for non-empty content
      expect(onChunk).toHaveBeenCalledTimes(2);
      expect(onChunk).toHaveBeenNthCalledWith(1, {
        type: "chunk",
        content: "Hello",
        timestamp: expect.any(String),
      });
      expect(onChunk).toHaveBeenNthCalledWith(2, {
        type: "chunk",
        content: " world",
        timestamp: expect.any(String),
      });

      expect(onComplete).toHaveBeenCalledWith("Hello world!");
    });

    it("should handle streaming errors", async () => {
      const mockError = new Error("OpenAI API error");
      mockOpenAI.chat.completions.create.mockRejectedValue(mockError);

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

      expect(onError).toHaveBeenCalledWith(mockError);
      expect(onChunk).not.toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled();
    });

    it("should handle stream interruption", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [
              {
                delta: { content: "Hello" },
                finish_reason: null,
              },
            ],
          };
          throw new Error("Stream interrupted");
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

    it("should build proper context messages", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [
              {
                delta: { content: "Test response" },
                finish_reason: "stop",
              },
            ],
          };
        },
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockStream);

      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      await streamingService.streamChatWithContext(
        "What is the main topic?",
        "Context about AI and machine learning",
        onChunk,
        onComplete,
        onError
      );

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: expect.stringContaining("You are a helpful AI assistant"),
          },
          {
            role: "user",
            content: expect.stringContaining("What is the main topic?"),
          },
        ],
        stream: true,
        max_completion_tokens: 2000,
      });
    });
  });

  describe("streamChatCompletion", () => {
    it("should stream chat completion successfully", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [
              {
                delta: { content: "Hello" },
                finish_reason: null,
              },
            ],
          };
          yield {
            choices: [
              {
                delta: { content: " world" },
                finish_reason: "stop",
              },
            ],
          };
        },
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockStream);

      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      await streamingService.streamChatCompletion(
        [{ role: "user", content: "Hello" }],
        onChunk,
        onComplete,
        onError
      );

      expect(onChunk).toHaveBeenCalledTimes(2);
      expect(onComplete).toHaveBeenCalledWith("Hello world");
      expect(onError).not.toHaveBeenCalled();
    });

    it("should handle empty messages array", async () => {
      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      await streamingService.streamChatCompletion(
        [],
        onChunk,
        onComplete,
        onError
      );

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(onChunk).not.toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle OpenAI API errors gracefully", async () => {
      const apiError = new Error("Rate limit exceeded");
      mockOpenAI.chat.completions.create.mockRejectedValue(apiError);

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

      expect(onError).toHaveBeenCalledWith(apiError);
      expect(onChunk).not.toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled();
    });

    it("should handle malformed stream data", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [
              {
                // Missing delta property
                finish_reason: null,
              },
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

      // Should not crash, just skip malformed data
      expect(onChunk).not.toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalledWith("");
    });
  });
});
