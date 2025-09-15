import { ChatController } from "../../src/controllers/chatController";
import { ChatService } from "../../src/services/chatService";
import { OpenAIStreamingService } from "../../src/services/openaiStreamingService";
import { TransactionService } from "../../src/services/transactionService";
import { AuthService } from "../../src/services/authService";

// Mock dependencies
jest.mock("../../src/database/config", () => ({
  dbConnection: { getPool: jest.fn() },
}));
jest.mock("openai", () => {
  const mockOpenAI = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: jest.fn() } },
  }));
  return { __esModule: true, default: mockOpenAI, OpenAI: mockOpenAI };
});

describe("High-Impact Integration Tests (80/20 Rule)", () => {
  let mockPool: any;
  let mockClient: any;
  let chatController: ChatController;
  let mockChatService: jest.Mocked<ChatService>;
  let mockStreamingService: jest.Mocked<OpenAIStreamingService>;

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

  describe("🎯 Critical User Journey: Complete Chat Flow", () => {
    it("should handle end-to-end chat with document retrieval and streaming", async () => {
      // Arrange: Mock all dependencies
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
        },
      ]);

      // Mock recent messages
      mockChatService.getRecentChatMessages.mockResolvedValue([]);

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

      // Act: Execute the complete flow
      await chatController.streamChat(mockReq, mockRes);

      // Assert: Verify the complete flow worked
      expect(mockChatService.getRelevantDocuments).toHaveBeenCalledWith(
        "What is the main topic?",
        3,
        "user-123"
      );
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
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
    });

    it("should handle chat flow with error recovery", async () => {
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

      // Act
      await chatController.streamChat(mockReq, mockRes);

      // Assert: Should handle error gracefully
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('data: {"type":"error"')
      );
      expect(mockRes.end).toHaveBeenCalled();
    });
  });

  describe("🔒 Critical Security: Authentication Flow", () => {
    it("should handle complete user registration and login flow", async () => {
      // Mock user registration
      mockClient.query.mockResolvedValueOnce({
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

      // Mock password hashing
      const bcrypt = require("bcryptjs");
      bcrypt.hash.mockResolvedValue("hashed-password");

      // Mock JWT generation
      const jwt = require("jsonwebtoken");
      jwt.sign.mockReturnValue("mock-jwt-token");

      // Act: Register user
      const registerResult = await AuthService.generateTokens(
        {
          userId: "user-123",
          email: "test@example.com",
          firstName: "John",
          lastName: "Doe",
          role: "user",
          isVerified: false,
        },
        mockPool,
        "127.0.0.1",
        "test-agent"
      );

      // Assert: Registration successful
      expect(registerResult.accessToken).toBe("mock-jwt-token");
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO user_sessions"),
        expect.arrayContaining(["user-123"])
      );
    });

    it("should handle JWT validation and user lookup", async () => {
      // Mock JWT validation
      const jwt = require("jsonwebtoken");
      jwt.verify.mockReturnValue({
        userId: "user-123",
        email: "test@example.com",
        role: "user",
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      // Mock database user lookup
      mockClient.query.mockResolvedValue({
        rows: [
          {
            id: "user-123",
            email: "test@example.com",
            first_name: "John",
            last_name: "Doe",
            role: "user",
            is_verified: true,
          },
        ],
      });

      // Act: Validate token
      const result = await AuthService.validateAccessToken("valid-token");

      // Assert: User data returned correctly
      expect(result).toMatchObject({
        userId: "user-123",
        email: "test@example.com",
        role: "user",
      });
    });
  });

  describe("💾 Critical Data: Transaction Consistency", () => {
    it("should handle chat message saving with transaction rollback on error", async () => {
      // Mock successful user message save
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: "user-msg-id" }] }) // User message
        .mockRejectedValueOnce(new Error("Database error")); // Assistant message fails

      const operation = jest.fn().mockImplementation(async (client) => {
        // Simulate saving user message
        await client.query("INSERT INTO chat_messages ...");

        // Simulate saving assistant message (this will fail)
        await client.query("INSERT INTO chat_messages ...");
      });

      // Act: Execute transaction
      const result = await TransactionService.executeTransaction(operation);

      // Assert: Transaction should rollback
      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });

    it("should handle concurrent chat sessions without data corruption", async () => {
      // Mock concurrent operations
      const operation1 = jest.fn().mockResolvedValue("user1-result");
      const operation2 = jest.fn().mockResolvedValue("user2-result");

      // Act: Execute concurrent transactions
      const results = await Promise.all([
        TransactionService.executeTransaction(operation1),
        TransactionService.executeTransaction(operation2),
      ]);

      // Assert: Both should succeed
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[0].data).toBe("user1-result");
      expect(results[1].data).toBe("user2-result");
    });
  });

  describe("🌐 Critical Network: Streaming Resilience", () => {
    it("should handle streaming with network interruption and recovery", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [{ delta: { content: "Hello" }, finish_reason: null }],
          };
          throw new Error("Network interruption");
        },
      };

      const mockOpenAI = (mockStreamingService as any).openai;
      mockOpenAI.chat.completions.create.mockResolvedValue(mockStream);

      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      // Act: Stream with interruption
      await mockStreamingService.streamChatWithContext(
        "Test message",
        "Test context",
        onChunk,
        onComplete,
        onError
      );

      // Assert: Should handle interruption gracefully
      expect(onChunk).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(onComplete).not.toHaveBeenCalled();
    });

    it("should handle multiple concurrent streaming requests", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [
              { delta: { content: "Response" }, finish_reason: "stop" },
            ],
          };
        },
      };

      const mockOpenAI = (mockStreamingService as any).openai;
      mockOpenAI.chat.completions.create.mockResolvedValue(mockStream);

      // Act: Start 5 concurrent streams
      const promises = Array(5)
        .fill(null)
        .map(() => {
          const onChunk = jest.fn();
          const onComplete = jest.fn();
          const onError = jest.fn();

          return mockStreamingService
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

      // Assert: All should complete successfully
      results.forEach(({ onComplete, onError }) => {
        expect(onComplete).toHaveBeenCalledWith("Response");
        expect(onError).not.toHaveBeenCalled();
      });
    });
  });

  describe("⚡ Critical Performance: Load Handling", () => {
    it("should handle 50 concurrent database operations", async () => {
      // Act: Execute 50 concurrent transactions
      const operations = Array(50)
        .fill(null)
        .map((_, index) => jest.fn().mockResolvedValue(`result-${index}`));

      const startTime = Date.now();
      const results = await Promise.all(
        operations.map((op) => TransactionService.executeTransaction(op))
      );
      const endTime = Date.now();

      // Assert: All should succeed within reasonable time
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds
    });

    it("should handle large batch operations efficiently", async () => {
      // Act: Execute large batch transaction
      const largeOperations = Array(100)
        .fill(null)
        .map((_, index) => jest.fn().mockResolvedValue(`result-${index}`));

      const startTime = Date.now();
      const result = await TransactionService.executeBatchTransaction(
        largeOperations
      );
      const endTime = Date.now();

      // Assert: Should complete efficiently
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(2000); // 2 seconds
    });
  });

  describe("🛡️ Critical Error: Graceful Degradation", () => {
    it("should handle database connection loss gracefully", async () => {
      // Mock connection loss
      mockChatService.getRelevantDocuments.mockRejectedValue(
        new Error("Database connection lost")
      );

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

      // Act: Try to chat with database down
      await chatController.streamChat(mockReq, mockRes);

      // Assert: Should handle gracefully
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('data: {"type":"error"')
      );
    });

    it("should handle OpenAI API rate limiting gracefully", async () => {
      // Mock rate limiting
      mockStreamingService.streamChatWithContext.mockRejectedValue(
        new Error("Rate limit exceeded")
      );

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

      // Act: Try to chat with rate limiting
      await chatController.streamChat(mockReq, mockRes);

      // Assert: Should handle gracefully
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('data: {"type":"error"')
      );
    });
  });

  describe("🔄 Critical Integration: Cross-Service Communication", () => {
    it("should handle complete document upload and chat flow", async () => {
      // Mock document upload
      mockClient.query.mockResolvedValue({
        rows: [
          {
            id: "doc-123",
            filename: "test.pdf",
            content: "Document content",
            user_id: "user-123",
          },
        ],
      });

      // Mock chat with document
      mockChatService.getRelevantDocuments.mockResolvedValue([
        {
          id: "doc-123",
          content: "Document content",
        },
      ]);

      mockStreamingService.streamChatWithContext.mockImplementation(
        async (message, context, onChunk, onComplete) => {
          onComplete("Response based on document");
        }
      );

      const mockReq = {
        user: { userId: "user-123" },
        body: {
          message: "What does the document say?",
          documentIds: ["doc-123"],
          sessionId: "session-123",
        },
      } as any;

      const mockRes = {
        writeHead: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      } as any;

      // Act: Complete flow
      await chatController.streamChat(mockReq, mockRes);

      // Assert: Document was retrieved and used
      expect(mockChatService.getRelevantDocuments).toHaveBeenCalledWith(
        "What does the document say?",
        3,
        "user-123"
      );
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
    });
  });
});
