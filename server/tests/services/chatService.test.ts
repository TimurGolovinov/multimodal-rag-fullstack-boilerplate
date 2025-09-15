import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  afterEach,
} from "@jest/globals";
import { ChatService } from "../../src/services/chatService";
import { DocumentService } from "../../src/services/documentService";
import { DocumentDatabaseService } from "../../src/database/services/documentService";
import { ChatRequest, Document } from "../../src/types";

// Mock the DocumentService
jest.mock("../../src/services/documentService");
jest.mock("../../src/database/services/documentService");

describe("ChatService", () => {
  let chatService: ChatService;
  let mockDocumentService: any;
  let mockDbService: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockDocumentService = {
      searchDocuments: jest.fn(),
    };

    mockDbService = {
      saveChatMessage: jest.fn(),
      getRecentChatMessages: jest.fn(),
      getChatHistory: jest.fn(),
      clearChatHistory: jest.fn(),
      getChatSessions: jest.fn(),
    };

    // Create ChatService instance
    chatService = new ChatService(mockDocumentService as any);

    // Mock the database service
    (chatService as any).dbService = mockDbService;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("chat", () => {
    it("should save user message and generate response with context", async () => {
      // Arrange
      const request: ChatRequest = {
        message: "What is the capital of France?",
        documentIds: ["doc1", "doc2"],
      };
      const userId = "user123";
      const sessionId = "session123";

      const mockDocuments: Document[] = [
        {
          id: "doc1",
          filename: "geography.txt",
          content:
            "Paris is the capital of France. It is located in the north-central part of the country.",
          uploadedAt: new Date(),
          type: "text",
          metadata: {},
        },
      ];

      const mockRecentMessages = [
        {
          id: "msg1",
          role: "user" as const,
          content: "Hello",
          documentIds: [],
          timestamp: new Date(),
          metadata: {},
        },
      ];

      mockDocumentService.searchDocuments.mockResolvedValue(mockDocuments);
      mockDbService.getRecentChatMessages.mockResolvedValue(mockRecentMessages);
      mockDbService.saveChatMessage
        .mockResolvedValueOnce("user-msg-id") // User message
        .mockResolvedValueOnce("assistant-msg-id"); // Assistant message

      // Mock OpenAI response
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: "Paris is the capital of France.",
            },
          },
        ],
      });

      const mockOpenAI = {
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      };

      // Replace the OpenAI instance
      (chatService as any).openai = mockOpenAI;

      // Act
      const result = await chatService.chat(request, userId, sessionId);

      // Assert
      expect(mockDbService.saveChatMessage).toHaveBeenCalledTimes(2);
      expect(mockDbService.saveChatMessage).toHaveBeenNthCalledWith(
        1,
        userId,
        sessionId,
        "user",
        request.message,
        request.documentIds
      );
      expect(mockDbService.saveChatMessage).toHaveBeenNthCalledWith(
        2,
        userId,
        sessionId,
        "assistant",
        "Paris is the capital of France.",
        ["doc1"]
      );

      expect(mockDocumentService.searchDocuments).toHaveBeenCalledWith(
        request.message,
        3,
        userId
      );

      expect(mockDbService.getRecentChatMessages).toHaveBeenCalledWith(
        userId,
        sessionId,
        10
      );

      expect(result).toEqual({
        message: "Paris is the capital of France.",
        sources: [
          {
            id: "doc1",
            filename: "geography.txt",
            content:
              "Paris is the capital of France. It is located in the north-central part of the country.",
          },
        ],
        messageId: "assistant-msg-id",
      });
    });

    it("should handle empty document search results", async () => {
      // Arrange
      const request: ChatRequest = {
        message: "What is the capital of France?",
        documentIds: [],
      };
      const userId = "user123";
      const sessionId = "session123";

      mockDocumentService.searchDocuments.mockResolvedValue([]);
      mockDbService.getRecentChatMessages.mockResolvedValue([]);
      mockDbService.saveChatMessage
        .mockResolvedValueOnce("user-msg-id")
        .mockResolvedValueOnce("assistant-msg-id");

      const mockCreate = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content:
                "I do not have information about that in my knowledge base.",
            },
          },
        ],
      });

      const mockOpenAI = {
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      };

      (chatService as any).openai = mockOpenAI;

      // Act
      const result = await chatService.chat(request, userId, sessionId);

      // Assert
      expect(result.sources).toEqual([]);
      expect(result.message).toBe(
        "I do not have information about that in my knowledge base."
      );
    });

    it("should truncate long document content", async () => {
      // Arrange
      const request: ChatRequest = {
        message: "Tell me about this document",
        documentIds: ["doc1"],
      };
      const userId = "user123";
      const sessionId = "session123";

      // Create a document with very long content
      const longContent = "A".repeat(5000); // 5000 characters
      const mockDocuments: Document[] = [
        {
          id: "doc1",
          filename: "long-doc.txt",
          content: longContent,
          uploadedAt: new Date(),
          type: "text",
          metadata: {},
        },
      ];

      mockDocumentService.searchDocuments.mockResolvedValue(mockDocuments);
      mockDbService.getRecentChatMessages.mockResolvedValue([]);
      mockDbService.saveChatMessage
        .mockResolvedValueOnce("user-msg-id")
        .mockResolvedValueOnce("assistant-msg-id");

      const mockCreate = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: "Based on the document...",
            },
          },
        ],
      });

      const mockOpenAI = {
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      };

      (chatService as any).openai = mockOpenAI;

      // Act
      const result = await chatService.chat(request, userId, sessionId);

      // Assert
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining("... [truncated]"),
            }),
          ]),
        })
      );
    });
  });

  describe("saveUserMessage", () => {
    it("should save user message to database", async () => {
      // Arrange
      const userId = "user123";
      const sessionId = "session123";
      const message = "Hello, how are you?";
      const documentIds = ["doc1", "doc2"];

      mockDbService.saveChatMessage.mockResolvedValue("message-id-123");

      // Act
      const result = await chatService.saveUserMessage(
        userId,
        sessionId,
        message,
        documentIds
      );

      // Assert
      expect(mockDbService.saveChatMessage).toHaveBeenCalledWith(
        userId,
        sessionId,
        "user",
        message,
        documentIds
      );
      expect(result).toBe("message-id-123");
    });
  });

  describe("saveAssistantMessage", () => {
    it("should save assistant message to database", async () => {
      // Arrange
      const userId = "user123";
      const sessionId = "session123";
      const message = "Hello! I am doing well, thank you for asking.";
      const documentIds = ["doc1", "doc2"];

      mockDbService.saveChatMessage.mockResolvedValue(
        "assistant-message-id-123"
      );

      // Act
      const result = await chatService.saveAssistantMessage(
        userId,
        sessionId,
        message,
        documentIds
      );

      // Assert
      expect(mockDbService.saveChatMessage).toHaveBeenCalledWith(
        userId,
        sessionId,
        "assistant",
        message,
        documentIds
      );
      expect(result).toBe("assistant-message-id-123");
    });
  });

  describe("getRelevantDocuments", () => {
    it("should search for relevant documents", async () => {
      // Arrange
      const query = "What is the capital of France?";
      const userId = "user123";

      const mockDocuments: Document[] = [
        {
          id: "doc1",
          filename: "geography.txt",
          content: "Paris is the capital of France.",
          uploadedAt: new Date(),
          type: "text",
          metadata: {},
        },
      ];

      mockDocumentService.searchDocuments.mockResolvedValue(mockDocuments);

      // Act
      const result = await chatService.getRelevantDocuments(query, userId);

      // Assert
      expect(mockDocumentService.searchDocuments).toHaveBeenCalledWith(
        query,
        3,
        userId
      );
      expect(result).toEqual(mockDocuments);
    });
  });

  describe("getChatHistory", () => {
    it("should retrieve chat history from database", async () => {
      // Arrange
      const userId = "user123";
      const sessionId = "session123";

      const mockHistory = [
        {
          id: "msg1",
          role: "user" as const,
          content: "Hello",
          documentIds: [],
          timestamp: new Date(),
          metadata: {},
        },
        {
          id: "msg2",
          role: "assistant" as const,
          content: "Hi there!",
          documentIds: [],
          timestamp: new Date(),
          metadata: {},
        },
      ];

      mockDbService.getChatHistory.mockResolvedValue(mockHistory);

      // Act
      const result = await chatService.getChatHistory(userId, sessionId);

      // Assert
      expect(mockDbService.getChatHistory).toHaveBeenCalledWith(
        userId,
        sessionId
      );
      expect(result).toEqual(mockHistory);
    });
  });

  describe("clearChatHistory", () => {
    it("should clear chat history for user and session", async () => {
      // Arrange
      const userId = "user123";
      const sessionId = "session123";

      mockDbService.clearChatHistory.mockResolvedValue(true);

      // Act
      const result = await chatService.clearChatHistory(userId, sessionId);

      // Assert
      expect(mockDbService.clearChatHistory).toHaveBeenCalledWith(
        userId,
        sessionId
      );
      expect(result).toBe(true);
    });
  });

  describe("getChatSessions", () => {
    it("should retrieve all chat sessions for user", async () => {
      // Arrange
      const userId = "user123";

      const mockSessions = [
        {
          sessionId: "session1",
          lastMessage: "Hello",
          lastMessageTime: new Date(),
          messageCount: 5,
        },
        {
          sessionId: "session2",
          lastMessage: "How are you?",
          lastMessageTime: new Date(),
          messageCount: 3,
        },
      ];

      mockDbService.getChatSessions.mockResolvedValue(mockSessions);

      // Act
      const result = await chatService.getChatSessions(userId);

      // Assert
      expect(mockDbService.getChatSessions).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockSessions);
    });
  });
});
