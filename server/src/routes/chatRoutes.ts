import { Router } from "express";
import { ChatController } from "../controllers/chatController";
import { requireAuth } from "../middleware/authMiddleware";

export function createChatRoutes(chatController: ChatController): Router {
  const router = Router();

  // Chat with LLM about documents - REQUIRES AUTHENTICATION
  router.post("/", requireAuth, (req, res) => {
    chatController.chat(req, res);
  });

  return router;
}
