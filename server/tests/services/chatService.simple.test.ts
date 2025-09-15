import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ChatService } from '../../src/services/chatService';
import { DocumentService } from '../../src/services/documentService';
import { DocumentDatabaseService } from '../../src/database/services/documentService';
import { ChatRequest } from '../../src/types';

// Mock the DocumentService
jest.mock('../../src/services/documentService');
jest.mock('../../src/database/services/documentService');

describe('ChatService - Message Persistence', () => {
  let chatService: ChatService;
  let mockDocumentService: any;
  let mockDbService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDocumentService = {
      searchDocuments: jest.fn(),
    };

    mockDbService = {
      saveChatMessage: jest.fn(),
      getRecentChatMessages: jest.fn(),
    };

    // Set up default return values
    mockDocumentService.searchDocuments.mockResolvedValue([]);
    mockDbService.getRecentChatMessages.mockResolvedValue([]);

    chatService = new ChatService(mockDocumentService as any);
    (chatService as any).dbService = mockDbService;
  });

  describe('saveUserMessage', () => {
    it('should save user message to database', async () => {
      // Arrange
      const userId = 'user123';
      const sessionId = 'session123';
      const message = 'Hello, how are you?';
      const documentIds = ['doc1', 'doc2'];

      mockDbService.saveChatMessage.mockResolvedValue('message-id-123');

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
        'user',
        message,
        documentIds
      );
      expect(result).toBe('message-id-123');
    });
  });

  describe('saveAssistantMessage', () => {
    it('should save assistant message to database', async () => {
      // Arrange
      const userId = 'user123';
      const sessionId = 'session123';
      const message = 'Hello! I am doing well, thank you for asking.';
      const documentIds = ['doc1', 'doc2'];

      mockDbService.saveChatMessage.mockResolvedValue('assistant-message-id-123');

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
        'assistant',
        message,
        documentIds
      );
      expect(result).toBe('assistant-message-id-123');
    });
  });

  describe('getRelevantDocuments', () => {
    it('should search for relevant documents', async () => {
      // Arrange
      const query = 'What is the capital of France?';
      const userId = 'user123';

      const mockDocuments = [
        {
          id: 'doc1',
          filename: 'geography.txt',
          content: 'Paris is the capital of France.',
          uploadedAt: new Date(),
          type: 'text',
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
});
