import { Router } from "express";
import { ChatController } from "../controllers/chatController";
import { requireAuth } from "../middleware/authMiddleware";

export function createChatRoutes(chatController: ChatController): Router {
  const router = Router();

  // Chat with LLM about documents - REQUIRES AUTHENTICATION
  router.post("/", requireAuth, (req, res) => {
    chatController.chat(req, res);
  });

  // Get chat history for a session - REQUIRES AUTHENTICATION
  router.get("/history", requireAuth, (req, res) => {
    chatController.getChatHistory(req, res);
  });

  // Clear chat history for a session - REQUIRES AUTHENTICATION
  router.delete("/history", requireAuth, (req, res) => {
    chatController.clearChatHistory(req, res);
  });

  // Get all chat sessions for a user - REQUIRES AUTHENTICATION
  router.get("/sessions", requireAuth, (req, res) => {
    chatController.getChatSessions(req, res);
  });

  return router;
}
