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

      const { message, documentIds }: ChatRequest = req.body;

      if (!message || typeof message !== "string") {
        ErrorHandlingService.handleInputError(
          res,
          "Message is required and must be a string",
          {
            type: ErrorType.INPUT_ERROR,
            severity: ErrorSeverity.LOW,
            context: { message, documentIds },
          }
        );
        return;
      }

      const response = await this.chatService.chat(
        { message, documentIds },
        req.user.id
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
        })
      );
    }
  }
}
