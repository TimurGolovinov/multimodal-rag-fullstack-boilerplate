import { ChatRequest, ChatResponse, Document } from "../types";
import { DocumentService } from "./documentService";
import { DocumentDatabaseService } from "../database/services/documentService";
import OpenAI from "openai";

export class ChatService {
  private openai: OpenAI;
  private documentService: DocumentService;
  private dbService?: DocumentDatabaseService;

  constructor(documentService: DocumentService) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.documentService = documentService;
  }

  private async ensureDatabaseService() {
    if (!this.dbService) {
      this.dbService = new DocumentDatabaseService();
    }
  }

  async chat(
    request: ChatRequest,
    userId: string,
    sessionId: string = "default"
  ): Promise<ChatResponse> {
    try {
      await this.ensureDatabaseService();

      // Save user message to database
      const userMessageId = await this.dbService!.saveChatMessage(
        userId,
        sessionId,
        "user",
        request.message,
        request.documentIds || []
      );

      // Search for relevant documents
      const relevantDocs = await this.documentService.searchDocuments(
        request.message,
        3,
        userId
      );

      // Get recent chat history for context window
      const recentMessages = await this.dbService!.getRecentChatMessages(
        userId,
        sessionId,
        10
      );

      // Format results and create context
      const formattedResults = this.formatResults(relevantDocs);
      const textSources = this.createContext(relevantDocs);

      // Build messages array with context window
      const messages: Array<{
        role: "system" | "user" | "assistant";
        content: string;
      }> = [
        {
          role: "system",
          content:
            "You are a helpful AI assistant. Answer questions based on the provided sources and conversation history. Be concise and helpful.",
        },
      ];

      // Add recent conversation history (last 10 messages)
      recentMessages.forEach((msg) => {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      });

      // Add current query with sources
      messages.push({
        role: "user",
        content: `Sources: ${formattedResults}\n\nQuery: '${request.message}'`,
      });

      // Generate response using OpenAI
      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        messages: messages,
      });

      const assistantMessage =
        response.choices[0]?.message?.content ||
        "Sorry, I could not generate a response.";

      // Save assistant message to database
      const assistantMessageId = await this.dbService!.saveChatMessage(
        userId,
        sessionId,
        "assistant",
        assistantMessage,
        relevantDocs.map((doc) => doc.id),
        {
          sources: relevantDocs.map((doc) => ({
            id: doc.id,
            filename: doc.filename,
          })),
          model: process.env.OPENAI_MODEL || "gpt-5-mini",
        }
      );

      return {
        message: assistantMessage,
        sources: relevantDocs,
        messageId: assistantMessageId,
      };
    } catch (error) {
      console.error("Error in chat service:", error);
      throw new Error("Failed to process chat request");
    }
  }

  private formatResults(documents: Document[]): string {
    if (documents.length === 0) {
      return "No relevant documents found.";
    }

    const MAX_CHARS_PER_DOC = 2000; // Limit each document to 2000 characters
    const MAX_TOTAL_CHARS = 8000; // Limit total context to 8000 characters
    let totalChars = 0;

    const formattedDocs = documents
      .map((doc, index) => {
        // Truncate document content if it's too long
        let content = doc.content;
        if (content.length > MAX_CHARS_PER_DOC) {
          content = content.substring(0, MAX_CHARS_PER_DOC) + "... [truncated]";
        }

        const docText = `Document ${index + 1} (${doc.filename}):\n${content}`;

        // Check if adding this document would exceed the total limit
        if (totalChars + docText.length > MAX_TOTAL_CHARS) {
          return null; // Skip this document
        }

        totalChars += docText.length;
        return docText;
      })
      .filter(Boolean) // Remove null entries
      .join("\n\n");

    return formattedDocs || "No relevant documents found.";
  }

  private createContext(documents: Document[]): string {
    if (documents.length === 0) {
      return "No relevant documents found.";
    }

    const MAX_CHARS_PER_DOC = 2000; // Limit each document to 2000 characters
    const MAX_TOTAL_CHARS = 8000; // Limit total context to 8000 characters
    let totalChars = 0;

    const textSources = documents
      .map((doc) => {
        // Truncate document content if it's too long
        let content = doc.content;
        if (content.length > MAX_CHARS_PER_DOC) {
          content = content.substring(0, MAX_CHARS_PER_DOC) + "... [truncated]";
        }

        // Check if adding this document would exceed the total limit
        if (totalChars + content.length > MAX_TOTAL_CHARS) {
          return null; // Skip this document
        }

        totalChars += content.length;
        return content;
      })
      .filter(Boolean) // Remove null entries
      .join("\n");

    return textSources || "No relevant documents found.";
  }

  /**
   * Get chat history for a user and session
   */
  async getChatHistory(
    userId: string,
    sessionId: string = "default"
  ): Promise<
    Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      documentIds: string[];
      timestamp: Date;
      metadata: Record<string, any>;
    }>
  > {
    await this.ensureDatabaseService();
    return await this.dbService!.getChatHistory(userId, sessionId);
  }

  /**
   * Clear chat history for a user and session
   */
  async clearChatHistory(
    userId: string,
    sessionId: string = "default"
  ): Promise<boolean> {
    await this.ensureDatabaseService();
    return await this.dbService!.clearChatHistory(userId, sessionId);
  }

  /**
   * Get all chat sessions for a user
   */
  async getChatSessions(userId: string): Promise<
    Array<{
      sessionId: string;
      lastMessage: string;
      lastMessageTime: Date;
      messageCount: number;
    }>
  > {
    await this.ensureDatabaseService();
    return await this.dbService!.getChatSessions(userId);
  }

  /**
   * Save user message to database
   */
  async saveUserMessage(
    userId: string,
    sessionId: string,
    message: string,
    documentIds: string[] = []
  ): Promise<string> {
    try {
      await this.ensureDatabaseService();
      return await this.dbService!.saveChatMessage(
        userId,
        sessionId,
        "user",
        message,
        documentIds
      );
    } catch (error) {
      console.error(`❌ Failed to save user message:`, error);
      throw error;
    }
  }

  /**
   * Save assistant message to database
   */
  async saveAssistantMessage(
    userId: string,
    sessionId: string,
    message: string,
    documentIds: string[] = []
  ): Promise<string> {
    try {
      await this.ensureDatabaseService();
      return await this.dbService!.saveChatMessage(
        userId,
        sessionId,
        "assistant",
        message,
        documentIds
      );
    } catch (error) {
      console.error(`❌ Failed to save assistant message:`, error);
      throw error;
    }
  }

  /**
   * Save both user and assistant messages in a single transaction
   * This ensures data consistency for chat conversations
   */
  async saveChatConversation(
    userId: string,
    sessionId: string,
    userMessage: string,
    assistantMessage: string,
    documentIds: string[] = []
  ): Promise<{ userMessageId: string; assistantMessageId: string }> {
    try {
      await this.ensureDatabaseService();

      const { TransactionService } = await import("./transactionService");

      const result = await TransactionService.executeTransaction(
        async (client) => {
          // Save user message
          const userQuery = `
          INSERT INTO chat_messages (user_id, session_id, role, content, document_ids, metadata)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `;
          const userValues = [
            userId,
            sessionId,
            "user",
            userMessage,
            documentIds,
            JSON.stringify({}),
          ];
          const userResult = await client.query(userQuery, userValues);

          // Save assistant message
          const assistantQuery = `
          INSERT INTO chat_messages (user_id, session_id, role, content, document_ids, metadata)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `;
          const assistantValues = [
            userId,
            sessionId,
            "assistant",
            assistantMessage,
            documentIds,
            JSON.stringify({}),
          ];
          const assistantResult = await client.query(
            assistantQuery,
            assistantValues
          );

          return {
            userMessageId: userResult.rows[0].id,
            assistantMessageId: assistantResult.rows[0].id,
          };
        }
      );

      if (!result.success) {
        throw new Error(
          `Failed to save chat conversation: ${result.error || "Unknown error"}`
        );
      }

      return result.data!;
    } catch (error) {
      console.error(`❌ Failed to save chat conversation:`, error);
      throw error;
    }
  }

  /**
   * Get relevant documents for context
   */
  async getRelevantDocuments(
    message: string,
    userId: string
  ): Promise<Document[]> {
    try {
      return await this.documentService.searchDocuments(message, 3, userId);
    } catch (error) {
      console.error(`❌ Failed to get relevant documents:`, error);
      return [];
    }
  }
}
