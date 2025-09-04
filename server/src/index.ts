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

const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";
const isPrimary = cluster.isPrimary;

// Clean cluster setup
if (isPrimary && isProduction) {
  // Primary process: Handle migrations and fork workers
  console.log(`🚀 Primary process ${process.pid} starting...`);

  const { dbConnection } = require("./database/config");
  const { MigrationRunner } = require("./database/migrationRunner");

  // Run migrations once in primary process
  dbConnection
    .connect()
    .then(async () => {
      console.log("✅ Database connected successfully");

      const migrationRunner = new MigrationRunner(dbConnection.getPool());
      const result = await migrationRunner.runMigrations();

      if (result.success) {
        console.log("✅ Database migrations completed");

        // Fork workers
        const numCPUs = os.cpus().length;
        console.log(`📊 Spawning ${numCPUs} worker processes...`);

        for (let i = 0; i < numCPUs; i++) {
          cluster.fork();
        }

        // Handle worker exits
        cluster.on("exit", (worker, code, signal) => {
          console.log(`⚠️ Worker ${worker.process.pid} died. Restarting...`);
          cluster.fork();
        });
      } else {
        console.error("❌ Database migrations failed:", result.error);
        process.exit(1);
      }
    })
    .catch((error: any) => {
      console.error("❌ Database connection failed:", error);
      process.exit(1);
    });
} else {
  // Worker process (or single process in development)
  createServer();
}

async function createServer() {
  const app = express();

  // Trust proxy for rate limiting behind reverse proxy (Nginx)
  // Only trust the first proxy (Nginx) to prevent IP spoofing
  app.set("trust proxy", 1);

  // Run migrations in development mode
  if (!isProduction) {
    await runMigrations();
  }

  // Middleware setup
  setupMiddleware(app);

  // Initialize services and routes
  const { documentController, chatController } = await initializeServices();
  setupRoutes(app, documentController, chatController);

  // Start server
  app.listen(PORT, () => {
    console.log(`🚀 Server ${process.pid} started on port ${PORT}`);
    console.log(
      `📚 Document endpoints: http://localhost:${PORT}/api/documents`
    );
    console.log(`💬 Chat endpoint: http://localhost:${PORT}/api/chat`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  });
}

async function runMigrations() {
  const { dbConnection } = require("./database/config");
  const { MigrationRunner } = require("./database/migrationRunner");

  console.log("🔄 Running database migrations...");

  await dbConnection.connect();
  console.log("✅ Database connected successfully");

  const migrationRunner = new MigrationRunner(dbConnection.getPool());
  const result = await migrationRunner.runMigrations();

  if (result.success) {
    console.log("✅ Database migrations completed successfully");
  } else {
    console.error("❌ Database migrations failed:", result.error);
    process.exit(1);
  }
}

function setupMiddleware(app: express.Application) {
  // Performance optimizations
  app.use(require("compression")());
  app.use(
    require("helmet")({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS configuration
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

  // Rate limiting
  const rateLimit = require("express-rate-limit");

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    message: {
      success: false,
      message: "Too many requests from this IP, please try again later.",
      error: "RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req: any) => {
      return req.headers["x-user-id"] || req.ip;
    },
  });

  const processingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
      success: false,
      message: "Too many processing requests, please try again later.",
      error: "PROCESSING_RATE_LIMIT_EXCEEDED",
    },
    skipSuccessfulRequests: false,
  });

  app.use(limiter);

  // Body parsing
  app.use(express.json({ limit: "25mb", strict: false }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  // Store limiters for use in routes
  (app as any).processingLimiter = processingLimiter;
}

async function initializeServices() {
  const { dbConnection } = require("./database/config");

  await dbConnection.connect();
  console.log("✅ Database connected successfully");

  const documentService = DocumentServiceFactory.createWithAllProcessors();
  const chatService = new ChatService(documentService);

  const documentController = new DocumentController(documentService);
  const chatController = new ChatController(chatService);

  return { documentController, chatController };
}

function setupRoutes(
  app: express.Application,
  documentController: DocumentController,
  chatController: ChatController
) {
  // Health check
  app.get("/health", (req, res) => {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();

    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      service: "RAG Demo Server",
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

  // API routes
  const processingLimiter = (app as any).processingLimiter;

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
      message: "RAG Demo Server",
      version: "1.0.0",
      worker: process.pid,
      endpoints: {
        documents: "/api/documents",
        chat: "/api/chat",
        health: "/health",
      },
    });
  });

  // Error handling
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
        error: isProduction ? "Something went wrong" : err.message,
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
}
