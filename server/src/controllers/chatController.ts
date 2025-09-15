import { Request, Response } from "express";
import { ChatService } from "../services/chatService";
import { ChatRequest } from "../types";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import {
  ErrorHandlingService,
  ErrorType,
  ErrorSeverity,
} from "../services/errorHandlingService";
import { OpenAIStreamingService } from "../services/openaiStreamingService";

export class ChatController {
  private chatService: ChatService;
  private streamingService: OpenAIStreamingService;

  constructor(chatService: ChatService) {
    this.chatService = chatService;
    this.streamingService = new OpenAIStreamingService();
  }

  async chat(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      const {
        message,
        documentIds,
        sessionId = "default",
      }: ChatRequest & { sessionId?: string } = req.body;

      if (!message || typeof message !== "string") {
        ErrorHandlingService.handleInputError(
          res,
          "Message is required and must be a string",
          {
            type: ErrorType.INPUT_ERROR,
            severity: ErrorSeverity.LOW,
            context: { message, documentIds, sessionId },
          }
        );
        return;
      }

      const response = await this.chatService.chat(
        { message, documentIds },
        req.user.userId,
        sessionId
      );

      res.json({
        success: true,
        ...response,
      });
    } catch (error) {
      console.error("Chat error:", error);
      ErrorHandlingService.handleInternalError(
        res,
        error instanceof Error ? error : new Error("Unknown error"),
        ErrorHandlingService.createErrorDetails(req, {
          message: req.body?.message,
          documentIds: req.body?.documentIds,
          sessionId: req.body?.sessionId,
        })
      );
    }
  }

  async streamChat(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      const {
        message,
        documentIds,
        sessionId = "default",
      }: ChatRequest & { sessionId?: string } = req.body;

      if (!message || typeof message !== "string") {
        ErrorHandlingService.handleInputError(
          res,
          "Message is required and must be a string",
          {
            type: ErrorType.INPUT_ERROR,
            severity: ErrorSeverity.LOW,
            context: { message, documentIds, sessionId },
          }
        );
        return;
      }

      // Set SSE headers
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Cache-Control",
        "X-Accel-Buffering": "no", // Disable nginx buffering
      });

      // Send initial connection event
      res.write(
        'data: {"type":"connected","timestamp":"' +
          new Date().toISOString() +
          '"}\n\n'
      );

      // Save user message to database
      const userMessageId = await this.chatService.saveUserMessage(
        req.user.userId,
        sessionId,
        message,
        documentIds || []
      );

      // Get relevant documents for context
      const relevantDocs = await this.chatService.getRelevantDocuments(
        message,
        req.user.userId
      );

      // Build context from documents
      const context = this.buildContextFromDocuments(relevantDocs);

      // Stream the response
      await this.streamingService.streamChatWithContext(
        message,
        context,
        (chunk) => {
          const sseData = `data: ${JSON.stringify(chunk)}\n\n`;
          res.write(sseData);
        },
        async (fullContent) => {
          // Save assistant message to database with the actual content
          const assistantMessageId =
            await this.chatService.saveAssistantMessage(
              req.user!.userId,
              sessionId,
              fullContent, // Use the actual streaming content
              documentIds || []
            );

          res.write(
            `data: ${JSON.stringify({
              type: "complete",
              timestamp: new Date().toISOString(),
              messageId: assistantMessageId,
            })}\n\n`
          );
          res.end();
        },
        (error) => {
          console.error("Streaming error:", error);
          res.write(
            `data: ${JSON.stringify({
              type: "error",
              error: error.message,
              timestamp: new Date().toISOString(),
            })}\n\n`
          );
          res.end();
        }
      );
    } catch (error) {
      console.error("Stream chat error:", error);

      // Use consistent error handling with ErrorHandlingService
      const errorDetails = ErrorHandlingService.createErrorDetails(req, {
        message: req.body?.message,
        documentIds: req.body?.documentIds,
        sessionId: req.body?.sessionId,
      });

      // Log the error with proper context
      console.error(
        "Streaming error:",
        error instanceof Error ? error : new Error("Unknown streaming error")
      );

      // Send error response via SSE
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          error:
            error instanceof Error ? error.message : "Streaming error occurred",
          timestamp: new Date().toISOString(),
        })}\n\n`
      );
      res.end();
    }
  }

  private buildContextFromDocuments(documents: any[]): string {
    if (!documents || documents.length === 0) {
      return "No relevant documents found in the knowledge base.";
    }

    const MAX_CHARS_PER_DOC = 2000; // Limit each document to 2000 characters
    const MAX_TOTAL_CHARS = 8000; // Limit total context to 8000 characters
    let totalChars = 0;
    let context = "Relevant documents from the knowledge base:\n\n";

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];

      // Truncate document content if it's too long
      let content = doc.content;
      if (content.length > MAX_CHARS_PER_DOC) {
        content = content.substring(0, MAX_CHARS_PER_DOC) + "... [truncated]";
      }

      const docText = `Document ${i + 1}: ${
        doc.filename
      }\nContent: ${content}\n\n`;

      // Check if adding this document would exceed the total limit
      if (totalChars + docText.length > MAX_TOTAL_CHARS) {
        break; // Stop adding documents if we would exceed the limit
      }

      context += docText;
      totalChars += docText.length;
    }

    return context;
  }

  async getChatHistory(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      const { sessionId = "default" } = req.query;

      const history = await this.chatService.getChatHistory(
        req.user.userId,
        sessionId as string
      );

      res.json({
        success: true,
        history,
      });
    } catch (error) {
      console.error("Get chat history error:", error);
      ErrorHandlingService.handleInternalError(
        res,
        error instanceof Error ? error : new Error("Unknown error"),
        ErrorHandlingService.createErrorDetails(req, {
          sessionId: req.query?.sessionId,
        })
      );
    }
  }

  async clearChatHistory(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      const { sessionId = "default" } = req.body;

      const cleared = await this.chatService.clearChatHistory(
        req.user.userId,
        sessionId
      );

      res.json({
        success: true,
        cleared,
        message: cleared
          ? "Chat history cleared successfully"
          : "No chat history found to clear",
      });
    } catch (error) {
      console.error("Clear chat history error:", error);
      ErrorHandlingService.handleInternalError(
        res,
        error instanceof Error ? error : new Error("Unknown error"),
        ErrorHandlingService.createErrorDetails(req, {
          sessionId: req.body?.sessionId,
        })
      );
    }
  }

  async getChatSessions(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      const sessions = await this.chatService.getChatSessions(req.user.userId);

      res.json({
        success: true,
        sessions,
      });
    } catch (error) {
      console.error("Get chat sessions error:", error);
      ErrorHandlingService.handleInternalError(
        res,
        error instanceof Error ? error : new Error("Unknown error"),
        ErrorHandlingService.createErrorDetails(req)
      );
    }
  }
}
