import {
  OpenAIStreamingService,
  StreamingChunk,
} from "../../src/services/openaiStreamingService";

// Mock OpenAI
jest.mock("openai", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    })),
  };
});

describe("OpenAIStreamingService", () => {
  let streamingService: OpenAIStreamingService;
  let mockOpenAI: any;

  beforeEach(() => {
    jest.clearAllMocks();
    streamingService = new OpenAIStreamingService();
    mockOpenAI = require("openai").default;
  });

  describe("streamChatCompletion", () => {
    it("should stream chat completion successfully", async () => {
      const mockStream = [
        { choices: [{ delta: { content: "Hello" } }] },
        { choices: [{ delta: { content: " world" } }] },
        { choices: [{ delta: { content: "!" } }] },
      ];

      const mockCreate = jest.fn().mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of mockStream) {
            yield chunk;
          }
        },
      });

      mockOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }));

      const messages = [{ role: "user" as const, content: "Hello" }];

      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      await streamingService.streamChatCompletion(
        messages,
        onChunk,
        onComplete,
        onError
      );

      expect(mockCreate).toHaveBeenCalledWith({
        model: "gpt-5-mini",
        messages,
        stream: true,
        max_completion_tokens: 2000,
      });

      expect(onChunk).toHaveBeenCalledTimes(3);
      expect(onChunk).toHaveBeenCalledWith({
        type: "chunk",
        content: "Hello",
        timestamp: expect.any(String),
      });
      expect(onChunk).toHaveBeenCalledWith({
        type: "chunk",
        content: " world",
        timestamp: expect.any(String),
      });
      expect(onChunk).toHaveBeenCalledWith({
        type: "chunk",
        content: "!",
        timestamp: expect.any(String),
      });

      expect(onComplete).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it("should handle streaming errors", async () => {
      const mockError = new Error("OpenAI API error");
      const mockCreate = jest.fn().mockRejectedValue(mockError);

      mockOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }));

      const messages = [{ role: "user" as const, content: "Hello" }];
      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      await streamingService.streamChatCompletion(
        messages,
        onChunk,
        onComplete,
        onError
      );

      expect(onError).toHaveBeenCalledWith(mockError);
      expect(onChunk).not.toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled();
    });

    it("should handle empty content chunks", async () => {
      const mockStream = [
        { choices: [{ delta: {} }] }, // No content
        { choices: [{ delta: { content: "Hello" } }] },
        { choices: [{ delta: {} }] }, // No content
      ];

      const mockCreate = jest.fn().mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of mockStream) {
            yield chunk;
          }
        },
      });

      mockOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }));

      const messages = [{ role: "user" as const, content: "Hello" }];
      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      await streamingService.streamChatCompletion(
        messages,
        onChunk,
        onComplete,
        onError
      );

      // Should only call onChunk for chunks with content
      expect(onChunk).toHaveBeenCalledTimes(1);
      expect(onChunk).toHaveBeenCalledWith({
        type: "chunk",
        content: "Hello",
        timestamp: expect.any(String),
      });
    });
  });

  describe("streamChatWithContext", () => {
    it("should stream chat with context successfully", async () => {
      const mockStream = [
        { choices: [{ delta: { content: "Based on the context" } }] },
      ];

      const mockCreate = jest.fn().mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of mockStream) {
            yield chunk;
          }
        },
      });

      mockOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }));

      const userMessage = "What is the main topic?";
      const context = "The document discusses AI and machine learning.";

      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      await streamingService.streamChatWithContext(
        userMessage,
        context,
        onChunk,
        onComplete,
        onError
      );

      expect(mockCreate).toHaveBeenCalledWith({
        model: "gpt-5-mini",
        messages: [
          {
            role: "system",
            content: expect.stringContaining("You are a helpful AI assistant"),
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
        stream: true,
        max_completion_tokens: 2000,
      });

      expect(onChunk).toHaveBeenCalledWith({
        type: "chunk",
        content: "Based on the context",
        timestamp: expect.any(String),
      });
      expect(onComplete).toHaveBeenCalled();
    });
  });
});
