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
      console.log("Relevant docs", relevantDocs);

      // Get recent chat history for context window
      const recentMessages = await this.dbService!.getRecentChatMessages(
        userId,
        sessionId,
        10
      );

      // Format results and create context
      const formattedResults = this.formatResults(relevantDocs);
      const textSources = this.createContext(relevantDocs);
      console.log("Formatted results", formattedResults);
      console.log("Text sources", textSources);

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

      console.log("Completion response:", assistantMessage);

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

    return documents
      .map(
        (doc, index) =>
          `Document ${index + 1} (${doc.filename}):\n${doc.content}`
      )
      .join("\n\n");
  }

  private createContext(documents: Document[]): string {
    if (documents.length === 0) {
      return "No relevant documents found.";
    }

    // Join the text content of all results
    const textSources = documents.map((doc) => doc.content).join("\n");

    return textSources;
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
}
