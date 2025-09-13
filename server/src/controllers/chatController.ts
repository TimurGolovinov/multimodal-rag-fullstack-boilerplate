import { Request, Response } from "express";
import { ChatService } from "../services/chatService";
import { ChatRequest } from "../types";
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

  async chat(req: Request, res: Response): Promise<void> {
    try {
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

      const response = await this.chatService.chat({ message, documentIds });

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
