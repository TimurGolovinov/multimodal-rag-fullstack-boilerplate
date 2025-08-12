import { Router } from "express";
import { ChatController } from "../controllers/chatController";

export function createChatRoutes(chatController: ChatController): Router {
  const router = Router();

  // Chat with LLM about documents
  router.post("/chat", (req, res) => {
    chatController.chat(req, res);
  });

  return router;
}
