import { Request, Response } from "express";
import { ChatService } from "../services/chatService";
import { ChatRequest } from "../types";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import {
  ErrorHandlingService,
  ErrorType,
  ErrorSeverity,
} from "../services/errorHandlingService";

export class ChatController {
  private chatService: ChatService;

  constructor(chatService: ChatService) {
    this.chatService = chatService;
  }

  async chat(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
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
        req.user.id,
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

  async getChatHistory(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      const { sessionId = "default" } = req.query;

      const history = await this.chatService.getChatHistory(
        req.user.id,
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
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      const { sessionId = "default" } = req.body;

      const cleared = await this.chatService.clearChatHistory(
        req.user.id,
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
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      const sessions = await this.chatService.getChatSessions(req.user.id);

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
