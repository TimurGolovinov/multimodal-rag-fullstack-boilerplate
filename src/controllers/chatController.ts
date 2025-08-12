import { Request, Response } from "express";
import { ChatService } from "../services/chatService";
import { ChatRequest } from "../types";

export class ChatController {
  private chatService: ChatService;

  constructor(chatService: ChatService) {
    this.chatService = chatService;
  }

  async chat(req: Request, res: Response): Promise<void> {
    try {
      const { message, documentIds }: ChatRequest = req.body;

      if (!message || typeof message !== "string") {
        res.status(400).json({
          success: false,
          message: "Message is required and must be a string",
        });
        return;
      }

      const response = await this.chatService.chat({ message, documentIds });

      res.json({
        success: true,
        ...response,
      });
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process chat request",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
