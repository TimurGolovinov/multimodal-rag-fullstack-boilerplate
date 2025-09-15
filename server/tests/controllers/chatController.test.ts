import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  afterEach,
} from "@jest/globals";
import { Request, Response } from "express";
import { ChatController } from "../../src/controllers/chatController";
import { ChatService } from "../../src/services/chatService";
import { OpenAIStreamingService } from "../../src/services/openaiStreamingService";
import { AuthenticatedRequest } from "../../src/middleware/authMiddleware";

// Mock the services
jest.mock("../../src/services/chatService");
jest.mock("../../src/services/openaiStreamingService");

describe("ChatController", () => {
  let chatController: ChatController;
  let mockChatService: any;
  let mockStreamingService: any;
  let mockReq: AuthenticatedRequest;
  let mockRes: Response;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockChatService = {
      saveUserMessage: jest.fn(),
      saveAssistantMessage: jest.fn(),
      getRelevantDocuments: jest.fn(),
    };

    mockStreamingService = {
      streamChatWithContext: jest.fn(),
    };

    // Create ChatController instance
    chatController = new ChatController(mockChatService as any);

    // Mock the streaming service
    (chatController as any).streamingService = mockStreamingService;

    // Create mock request and response
    mockReq = {
      user: { userId: "user123" },
      body: {
        message: "What is the capital of France?",
        documentIds: ["doc1", "doc2"],
        sessionId: "session123",
      },
    } as AuthenticatedRequest;

    mockRes = {
      writeHead: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("streamChat", () => {
    it("should save user message and stream response with context", async () => {
      // Arrange
      const mockDocuments = [
        {
          id: "doc1",
          filename: "geography.txt",
          content: "Paris is the capital of France.",
          uploadedAt: new Date(),
          type: "text",
          metadata: {},
        },
      ];

      mockChatService.saveUserMessage.mockResolvedValue("user-msg-id");
      mockChatService.getRelevantDocuments.mockResolvedValue(mockDocuments);
      mockChatService.saveAssistantMessage.mockResolvedValue(
        "assistant-msg-id"
      );

      // Mock streaming service to call the callbacks
      mockStreamingService.streamChatWithContext.mockImplementation(
        async (
          message: any,
          context: any,
          onChunk: any,
          onComplete: any,
          onError: any
        ) => {
          // Simulate streaming chunks
          onChunk({
            type: "chunk",
            content: "Paris is the capital of France.",
            timestamp: new Date().toISOString(),
          });

          // Simulate completion with full content
          await onComplete("Paris is the capital of France.");
        }
      );

      // Act
      await chatController.streamChat(mockReq, mockRes);

      // Assert
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Cache-Control",
        "X-Accel-Buffering": "no",
      });

      expect(mockChatService.saveUserMessage).toHaveBeenCalledWith(
        "user123",
        "session123",
        "What is the capital of France?",
        ["doc1", "doc2"]
      );

      expect(mockChatService.getRelevantDocuments).toHaveBeenCalledWith(
        "What is the capital of France?",
        "user123"
      );

      expect(mockStreamingService.streamChatWithContext).toHaveBeenCalledWith(
        "What is the capital of France?",
        expect.stringContaining("Relevant documents from the knowledge base"),
        expect.any(Function), // onChunk callback
        expect.any(Function), // onComplete callback
        expect.any(Function) // onError callback
      );

      // Verify that assistant message is saved with the actual content
      expect(mockChatService.saveAssistantMessage).toHaveBeenCalledWith(
        "user123",
        "session123",
        "Paris is the capital of France.", // Should be the actual streaming content
        ["doc1", "doc2"]
      );

      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('data: {"type":"connected"')
      );

      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining(
          'data: {"type":"chunk","content":"Paris is the capital of France."'
        )
      );

      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('data: {"type":"complete"')
      );

      expect(mockRes.end).toHaveBeenCalled();
    });

    it("should handle streaming errors gracefully", async () => {
      // Arrange
      const error = new Error("Streaming failed");

      mockChatService.saveUserMessage.mockResolvedValue("user-msg-id");
      mockChatService.getRelevantDocuments.mockResolvedValue([]);

      // Mock streaming service to call error callback
      mockStreamingService.streamChatWithContext.mockImplementation(
        async (
          message: any,
          context: any,
          onChunk: any,
          onComplete: any,
          onError: any
        ) => {
          onError(error);
        }
      );

      // Act
      await chatController.streamChat(mockReq, mockRes);

      // Assert
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining(
          'data: {"type":"error","error":"Streaming failed"'
        )
      );

      expect(mockRes.end).toHaveBeenCalled();
    });

    it("should return 401 if user is not authenticated", async () => {
      // Arrange
      mockReq.user = undefined;

      // Act
      await chatController.streamChat(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "User not authenticated",
      });
    });

    it("should return 400 if message is missing", async () => {
      // Arrange
      mockReq.body = {};

      // Act
      await chatController.streamChat(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("should build context from documents with truncation", async () => {
      // Arrange
      const longContent = "A".repeat(5000); // 5000 characters
      const mockDocuments = [
        {
          id: "doc1",
          filename: "long-doc.txt",
          content: longContent,
          uploadedAt: new Date(),
          type: "text",
          metadata: {},
        },
      ];

      mockChatService.saveUserMessage.mockResolvedValue("user-msg-id");
      mockChatService.getRelevantDocuments.mockResolvedValue(mockDocuments);
      mockChatService.saveAssistantMessage.mockResolvedValue(
        "assistant-msg-id"
      );

      mockStreamingService.streamChatWithContext.mockImplementation(
        async (
          message: any,
          context: any,
          onChunk: any,
          onComplete: any,
          onError: any
        ) => {
          // Verify context is truncated
          expect(context).toContain("... [truncated]");
          expect(context.length).toBeLessThanOrEqual(8000);
          await onComplete("Based on the document...");
        }
      );

      // Act
      await chatController.streamChat(mockReq, mockRes);

      // Assert
      expect(mockStreamingService.streamChatWithContext).toHaveBeenCalledWith(
        "What is the capital of France?",
        expect.stringContaining("... [truncated]"),
        expect.any(Function),
        expect.any(Function),
        expect.any(Function)
      );
    });
  });

  describe("buildContextFromDocuments", () => {
    it("should build context from documents", () => {
      // Arrange
      const documents = [
        {
          id: "doc1",
          filename: "test1.txt",
          content: "This is test content 1.",
        },
        {
          id: "doc2",
          filename: "test2.txt",
          content: "This is test content 2.",
        },
      ];

      // Act
      const context = (chatController as any).buildContextFromDocuments(
        documents
      );

      // Assert
      expect(context).toContain("Relevant documents from the knowledge base");
      expect(context).toContain("Document 1: test1.txt");
      expect(context).toContain("Content: This is test content 1.");
      expect(context).toContain("Document 2: test2.txt");
      expect(context).toContain("Content: This is test content 2.");
    });

    it("should return default message for empty documents", () => {
      // Arrange
      const documents: any[] = [];

      // Act
      const context = (chatController as any).buildContextFromDocuments(
        documents
      );

      // Assert
      expect(context).toBe(
        "No relevant documents found in the knowledge base."
      );
    });

    it("should truncate long document content", () => {
      // Arrange
      const longContent = "A".repeat(5000);
      const documents = [
        {
          id: "doc1",
          filename: "long-doc.txt",
          content: longContent,
        },
      ];

      // Act
      const context = (chatController as any).buildContextFromDocuments(
        documents
      );

      // Assert
      expect(context).toContain("... [truncated]");
      expect(context.length).toBeLessThanOrEqual(8000);
    });
  });
});
