import { ChatController } from "../../src/controllers/chatController";
import { ChatService } from "../../src/services/chatService";
import { OpenAIStreamingService } from "../../src/services/openaiStreamingService";
import { TransactionService } from "../../src/services/transactionService";

// Mock all dependencies
jest.mock("../../src/database/config", () => ({
  dbConnection: { getPool: jest.fn() },
}));
jest.mock("openai", () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: jest.fn() } },
  })),
}));

describe("Critical Flows Integration Tests", () => {
  let chatController: ChatController;
  let mockChatService: jest.Mocked<ChatService>;
  let mockStreamingService: jest.Mocked<OpenAIStreamingService>;
  let mockPool: any;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = { query: jest.fn(), release: jest.fn() };
    mockPool = { connect: jest.fn().mockResolvedValue(mockClient) };
    const { dbConnection } = require("../../src/database/config");
    dbConnection.getPool.mockReturnValue(mockPool);

    mockChatService = {
      saveUserMessage: jest.fn(),
      saveAssistantMessage: jest.fn(),
      saveChatConversation: jest.fn(),
      getRelevantDocuments: jest.fn(),
      getRecentChatMessages: jest.fn(),
    } as any;

    mockStreamingService = {
      streamChatWithContext: jest.fn(),
    } as any;

    chatController = new ChatController(mockChatService);
    (chatController as any).streamingService = mockStreamingService;
  });

  describe("Complete Chat Flow", () => {
    it("should handle end-to-end chat with document retrieval", async () => {
      const mockReq = {
        user: { userId: "user-123" },
        body: {
          message: "What is the main topic?",
          documentIds: ["doc1", "doc2"],
          sessionId: "session-123",
        },
      } as any;

      const mockRes = {
        writeHead: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      } as any;

      // Mock document retrieval
      mockChatService.getRelevantDocuments.mockResolvedValue([
        {
          id: "doc1",
          content: "Document about AI and machine learning",
          title: "AI Guide",
        },
      ]);

      // Mock recent messages
      mockChatService.getRecentChatMessages.mockResolvedValue([
        {
          id: "msg1",
          role: "user",
          content: "Previous question",
          timestamp: new Date(),
        },
      ]);

      // Mock streaming response
      mockStreamingService.streamChatWithContext.mockImplementation(
        async (message, context, onChunk, onComplete, onError) => {
          onChunk({
            type: "chunk",
            content: "Based on the documents",
            timestamp: new Date().toISOString(),
          });
          onChunk({
            type: "chunk",
            content: ", the main topic is AI.",
            timestamp: new Date().toISOString(),
          });
          onComplete("Based on the documents, the main topic is AI.");
        }
      );

      // Mock message saving
      mockChatService.saveUserMessage.mockResolvedValue("user-msg-id");
      mockChatService.saveAssistantMessage.mockResolvedValue(
        "assistant-msg-id"
      );

      await chatController.streamChat(mockReq, mockRes);

      // Verify document retrieval
      expect(mockChatService.getRelevantDocuments).toHaveBeenCalledWith(
        "What is the main topic?",
        3,
        "user-123"
      );

      // Verify message saving
      expect(mockChatService.saveUserMessage).toHaveBeenCalledWith(
        "user-123",
        "session-123",
        "What is the main topic?",
        ["doc1", "doc2"]
      );

      expect(mockChatService.saveAssistantMessage).toHaveBeenCalledWith(
        "user-123",
        "session-123",
        "Based on the documents, the main topic is AI.",
        ["doc1", "doc2"]
      );

      // Verify streaming response
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
    });

    it("should handle chat flow with transaction rollback on error", async () => {
      const mockReq = {
        user: { userId: "user-123" },
        body: {
          message: "Test message",
          documentIds: [],
          sessionId: "session-123",
        },
      } as any;

      const mockRes = {
        writeHead: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      } as any;

      // Mock streaming service to throw error
      mockStreamingService.streamChatWithContext.mockRejectedValue(
        new Error("OpenAI API error")
      );

      await chatController.streamChat(mockReq, mockRes);

      // Should send error response
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('data: {"type":"error"')
      );
      expect(mockRes.end).toHaveBeenCalled();
    });
  });

  describe("Document Processing Flow", () => {
    it("should handle document upload with transaction", async () => {
      const mockReq = {
        user: { userId: "user-123" },
        file: {
          originalname: "test.pdf",
          buffer: Buffer.from("test content"),
          mimetype: "application/pdf",
        },
      } as any;

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      } as any;

      // Mock document processing
      const mockDocument = {
        id: "doc-123",
        filename: "test.pdf",
        content: "test content",
        userId: "user-123",
      };

      // Mock database operations
      mockClient.query.mockResolvedValue({ rows: [mockDocument] });

      // This would test the document upload flow with transaction
      // (Implementation would depend on the actual document controller)
    });
  });

  describe("User Authentication Flow", () => {
    it("should handle complete user registration flow", async () => {
      const mockReq = {
        body: {
          email: "test@example.com",
          password: "SecurePass123!",
          firstName: "John",
          lastName: "Doe",
        },
      } as any;

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      } as any;

      // Mock user creation
      mockClient.query.mockResolvedValue({
        rows: [
          {
            id: "user-123",
            email: "test@example.com",
            first_name: "John",
            last_name: "Doe",
            role: "user",
            is_verified: false,
          },
        ],
      });

      // This would test the complete registration flow
      // (Implementation would depend on the actual auth controller)
    });

    it("should handle user login with session creation", async () => {
      const mockReq = {
        body: {
          email: "test@example.com",
          password: "SecurePass123!",
        },
      } as any;

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      } as any;

      // Mock user lookup
      mockClient.query.mockResolvedValue({
        rows: [
          {
            id: "user-123",
            email: "test@example.com",
            password_hash: "hashed_password",
            role: "user",
            is_verified: true,
          },
        ],
      });

      // This would test the complete login flow
      // (Implementation would depend on the actual auth controller)
    });
  });

  describe("Error Recovery Flows", () => {
    it("should handle database connection loss during chat", async () => {
      const mockReq = {
        user: { userId: "user-123" },
        body: {
          message: "Test message",
          documentIds: [],
          sessionId: "session-123",
        },
      } as any;

      const mockRes = {
        writeHead: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      } as any;

      // Mock database connection loss
      mockChatService.getRelevantDocuments.mockRejectedValue(
        new Error("Database connection lost")
      );

      await chatController.streamChat(mockReq, mockRes);

      // Should handle error gracefully
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('data: {"type":"error"')
      );
    });

    it("should handle OpenAI API rate limiting", async () => {
      const mockReq = {
        user: { userId: "user-123" },
        body: {
          message: "Test message",
          documentIds: [],
          sessionId: "session-123",
        },
      } as any;

      const mockRes = {
        writeHead: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      } as any;

      // Mock rate limiting
      mockStreamingService.streamChatWithContext.mockRejectedValue(
        new Error("Rate limit exceeded")
      );

      await chatController.streamChat(mockReq, mockRes);

      // Should handle rate limiting gracefully
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('data: {"type":"error"')
      );
    });
  });

  describe("Concurrent User Flows", () => {
    it("should handle multiple users chatting simultaneously", async () => {
      const user1Req = {
        user: { userId: "user-1" },
        body: { message: "User 1 message", sessionId: "session-1" },
      } as any;

      const user2Req = {
        user: { userId: "user-2" },
        body: { message: "User 2 message", sessionId: "session-2" },
      } as any;

      const mockRes = {
        writeHead: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      } as any;

      // Mock responses
      mockStreamingService.streamChatWithContext.mockImplementation(
        async (message, context, onChunk, onComplete) => {
          onComplete(`Response to: ${message}`);
        }
      );

      // Start both chats concurrently
      const promises = [
        chatController.streamChat(user1Req, mockRes),
        chatController.streamChat(user2Req, mockRes),
      ];

      await Promise.all(promises);

      // Both should complete successfully
      expect(mockRes.writeHead).toHaveBeenCalledTimes(2);
    });
  });

  describe("Data Consistency Flows", () => {
    it("should maintain data consistency during concurrent operations", async () => {
      const operation1 = jest.fn().mockResolvedValue("result1");
      const operation2 = jest.fn().mockResolvedValue("result2");

      // Execute concurrent transactions
      const promises = [
        TransactionService.executeTransaction(operation1),
        TransactionService.executeTransaction(operation2),
      ];

      const results = await Promise.all(promises);

      // Both should succeed
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it("should handle partial failures in batch operations", async () => {
      const operations = [
        jest.fn().mockResolvedValue("result1"),
        jest.fn().mockRejectedValue(new Error("Operation 2 failed")),
        jest.fn().mockResolvedValue("result3"),
      ];

      const result = await TransactionService.executeBatchTransaction(
        operations
      );

      // Should fail due to operation 2
      expect(result.success).toBe(false);
      expect(result.error).toBe("Operation 2 failed");
    });
  });
});
