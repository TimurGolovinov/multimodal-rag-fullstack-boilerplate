import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cluster from "cluster";
import os from "os";
import { DocumentServiceFactory } from "./services/documentServiceFactory";
import { ChatService } from "./services/chatService";
import { DocumentController } from "./controllers/documentController";
import { ChatController } from "./controllers/chatController";
import { createDocumentRoutes } from "./routes/documentRoutes";
import { createChatRoutes } from "./routes/chatRoutes";

// Load environment variables
dotenv.config();

// Cluster setup for better performance
if (cluster.isMaster) {
  const numCPUs = os.cpus().length;
  console.log(`🚀 Master process ${process.pid} is running`);
  console.log(`📊 Spawning ${numCPUs} worker processes...`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(`⚠️ Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });

  // Monitor memory usage
  setInterval(() => {
    const memUsage = process.memoryUsage();
    console.log(
      `💾 Memory Usage: ${Math.round(
        memUsage.heapUsed / 1024 / 1024
      )}MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
    );
  }, 30000);
} else {
  // Worker process
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Performance optimizations
  app.use(require("compression")()); // Gzip compression
  app.use(
    require("helmet")({
      contentSecurityPolicy: false, // Disable for development
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS with domain restrictions
  const corsOptions = {
    origin: function (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) {
      if (!origin) return callback(null, true);

      const allowedDomains = process.env.ALLOWED_DOMAINS?.split(",") || [];
      const isAllowed = allowedDomains.some(
        (domain) => origin.includes(domain) || origin === domain
      );

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
  };

  app.use(cors(corsOptions));

  // Optimized rate limiting
  const rateLimit = require("express-rate-limit");
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Increased for better performance
    message: {
      success: false,
      message: "Too many requests from this IP, please try again later.",
      error: "RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful requests
    keyGenerator: (req: any) => {
      // Use user ID if authenticated, otherwise IP
      return req.headers["x-user-id"] || req.ip;
    },
  });

  // Apply rate limiting to all routes
  app.use(limiter);

  // Stricter rate limiting for resource-intensive operations
  const processingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // Limit processing operations
    message: {
      success: false,
      message: "Too many processing requests, please try again later.",
      error: "PROCESSING_RATE_LIMIT_EXCEEDED",
    },
    skipSuccessfulRequests: false,
  });

  // Body parsing with optimized limits
  app.use(
    express.json({
      limit: "25mb", // Increased for large documents
      strict: false, // Allow non-strict JSON
    })
  );
  app.use(
    express.urlencoded({
      extended: true,
      limit: "25mb",
    })
  );

  // Initialize services with all processors
  const documentService = DocumentServiceFactory.createWithAllProcessors();
  const chatService = new ChatService(documentService);

  // Initialize controllers
  const documentController = new DocumentController(documentService);
  const chatController = new ChatController(chatService);

  // Health check with detailed metrics
  app.get("/health", (req, res) => {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();

    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      service: "RAG Demo Server (Optimized)",
      version: "1.0.0",
      worker: process.pid,
      uptime: `${Math.floor(uptime / 3600)}h ${Math.floor(
        (uptime % 3600) / 60
      )}m`,
      memory: {
        used: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        total: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
      },
      cpu: process.cpuUsage(),
    });
  });

  // Domain restriction middleware
  const domainRestriction = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const allowedDomains = process.env.ALLOWED_DOMAINS?.split(",") || [];
    const referer = req.get("Referer") || req.get("Origin");

    if (!referer) {
      return res.status(403).json({
        success: false,
        message: "Access denied: No referer/origin header",
        error: "NO_REFERER",
      });
    }

    const isAllowed = allowedDomains.some(
      (domain) => referer.includes(domain) || referer === domain
    );

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: "Access denied: Domain not allowed",
        error: "DOMAIN_NOT_ALLOWED",
      });
    }

    next();
  };

  // Apply domain restriction to API routes
  app.use("/api", domainRestriction);

  // API routes with processing rate limiting
  app.use(
    "/api/documents/upload",
    processingLimiter,
    createDocumentRoutes(documentController)
  );
  app.use("/api/documents", createDocumentRoutes(documentController));
  app.use("/api/chat", createChatRoutes(chatController));

  // Root endpoint
  app.get("/", (req, res) => {
    res.json({
      message: "RAG Demo Server (Optimized)",
      version: "1.0.0",
      worker: process.pid,
      endpoints: {
        documents: "/api/documents",
        chat: "/api/chat",
        health: "/health",
      },
      allowedDomains: process.env.ALLOWED_DOMAINS?.split(",") || [],
    });
  });

  // Error handling with performance logging
  app.use(
    (
      err: any,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      console.error(`❌ Error in worker ${process.pid}:`, err);

      if (err.message === "Not allowed by CORS") {
        return res.status(403).json({
          success: false,
          message: "CORS error: Origin not allowed",
          error: "CORS_ERROR",
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "development"
            ? err.message
            : "Something went wrong",
        worker: process.pid,
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
    console.log(`🚀 Worker ${process.pid} started on port ${PORT}`);
    console.log(
      `📚 Document endpoints: http://localhost:${PORT}/api/documents`
    );
    console.log(`💬 Chat endpoint: http://localhost:${PORT}/api/chat`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log(
      `🔒 Allowed domains: ${process.env.ALLOWED_DOMAINS || "None configured"}`
    );
  });
}

// Export a dummy app for TypeScript compatibility
// In production, this will be the worker process app
const dummyApp = express();
export default dummyApp;
