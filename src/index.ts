import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { DocumentService } from "./services/documentService";
import { ChatService } from "./services/chatService";
import { DocumentController } from "./controllers/documentController";
import { ChatController } from "./controllers/chatController";
import { createDocumentRoutes } from "./routes/documentRoutes";
import { createChatRoutes } from "./routes/chatRoutes";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Initialize services
const documentService = new DocumentService();
const chatService = new ChatService(documentService);

// Initialize controllers
const documentController = new DocumentController(documentService);
const chatController = new ChatController(chatService);

// Routes
app.use("/api/documents", createDocumentRoutes(documentController));
app.use("/api/chat", createChatRoutes(chatController));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "RAG Demo Server",
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "RAG Demo Server",
    version: "1.0.0",
    endpoints: {
      documents: "/api/documents",
      chat: "/api/chat",
      health: "/health",
    },
  });
});

// Error handling middleware
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Something went wrong",
    });
  }
);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 RAG Demo Server running on port ${PORT}`);
  console.log(`📚 Document endpoints: http://localhost:${PORT}/api/documents`);
  console.log(`💬 Chat endpoint: http://localhost:${PORT}/api/chat`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

export default app;
