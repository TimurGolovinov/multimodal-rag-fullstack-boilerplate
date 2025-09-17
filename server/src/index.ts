import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cluster from "cluster";
import os from "os";
import cookieParser from "cookie-parser";
import { createServer as createHttpServer } from "http";
import { DocumentServiceFactory } from "./services/documentServiceFactory";
import { DocumentService } from "./services/documentService";
import { ChatService } from "./services/chatService";
import { DocumentController } from "./controllers/documentController";
import { ChatController } from "./controllers/chatController";
import { createDocumentRoutes } from "./routes/documentRoutes";
import { createChatRoutes } from "./routes/chatRoutes";
import { createAuthRoutes } from "./routes/authRoutes";
import { createUserRoutes } from "./routes/userRoutes";
import {
  enforceHTTPS,
  httpsHeaders,
  trustProxy,
} from "./middleware/httpsMiddleware";
import { AuthMiddleware } from "./middleware/authMiddleware";
import { TransactionService } from "./services/transactionService";

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
  createServer().catch((error) => {
    console.error("❌ Server startup failed:", error);
    process.exit(1);
  });
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
  TransactionService.initialize();
  const { documentController, chatController } = await initializeServices();
  setupRoutes(app, documentController, chatController);

  // Create HTTP server
  const server = createHttpServer(app);

  // Start server
  server.listen(PORT, () => {
    console.log(`🚀 Server ${process.pid} started on port ${PORT}`);
    console.log(
      `📚 Document endpoints: http://localhost:${PORT}/api/documents`
    );
    console.log(`💬 Chat endpoint: http://localhost:${PORT}/api/chat`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("🛑 SIGTERM received, shutting down gracefully");
    server.close(() => {
      console.log("✅ Server closed");
      process.exit(0);
    });
  });

  process.on("SIGINT", () => {
    console.log("🛑 SIGINT received, shutting down gracefully");
    server.close(() => {
      console.log("✅ Server closed");
      process.exit(0);
    });
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
  // HTTPS enforcement (production only)
  app.use(trustProxy);
  app.use(enforceHTTPS);
  app.use(httpsHeaders);

  // Performance optimizations
  app.use(require("compression")());
  app.use(
    require("helmet")({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      noSniff: true,
      xssFilter: true,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    })
  );

  // CORS configuration - Secure by default
  const corsOptions = {
    origin: function (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) {
      // Allow requests without origin in development or when explicitly configured
      if (!origin) {
        const allowNoOrigin =
          process.env.ALLOW_NO_ORIGIN === "true" ||
          process.env.NODE_ENV === "development";

        if (allowNoOrigin) {
          console.warn(
            "CORS: Allowing request without origin (development mode)"
          );
          return callback(null, true);
        }

        return callback(
          new Error("CORS: Origin header required for security"),
          false
        );
      }

      const allowedDomains = process.env.ALLOWED_DOMAINS?.split(",") || [];

      // In development, add common localhost origins if none configured
      if (
        process.env.NODE_ENV === "development" &&
        allowedDomains.length === 0
      ) {
        const devOrigins = [
          "http://localhost:3000",
          "http://localhost:3001",
          "http://localhost:5173",
          "http://127.0.0.1:3000",
          "http://127.0.0.1:3001",
          "http://127.0.0.1:5173",
        ];

        if (devOrigins.includes(origin)) {
          return callback(null, true);
        }
      }

      // If no domains configured, reject all
      if (allowedDomains.length === 0) {
        return callback(
          new Error("CORS: No allowed domains configured"),
          false
        );
      }

      const isAllowed = allowedDomains.some((domain) => {
        const trimmedDomain = domain.trim();

        // Exact match
        if (origin === trimmedDomain) {
          return true;
        }

        // HTTPS match
        if (origin === `https://${trimmedDomain}`) {
          return true;
        }

        // HTTP match (only in development)
        if (
          process.env.NODE_ENV !== "production" &&
          origin === `http://${trimmedDomain}`
        ) {
          return true;
        }

        // Wildcard match (with proper escaping)
        if (trimmedDomain.includes("*")) {
          const escapedDomain = trimmedDomain
            .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // Escape special regex chars
            .replace(/\*/g, ".*"); // Convert * to .*
          const regex = new RegExp(`^${escapedDomain}$`);
          return regex.test(origin);
        }

        return false;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`CORS: Blocked request from origin: ${origin}`);
        callback(new Error(`CORS: Origin ${origin} not allowed`), false);
      }
    },
    credentials: true,
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-csrf-token",
      "x-access-token",
    ],
    exposedHeaders: ["x-csrf-token"],
    // Add security headers
    maxAge: 86400, // Cache preflight for 24 hours
  };

  app.use(cors(corsOptions));

  // Rate limiting
  const rateLimit = require("express-rate-limit");

  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes default
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "200"),
    message: {
      success: false,
      message: "Too many requests from this IP, please try again later.",
      error: "RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    // Use IP address only - user ID can be spoofed
    keyGenerator: (req: any) => {
      // Get real IP address (considering proxies)
      const forwarded = req.headers["x-forwarded-for"];
      const realIp = req.headers["x-real-ip"];
      const ip = forwarded ? forwarded.split(",")[0] : realIp || req.ip;
      return ip;
    },
    // Skip rate limiting for health checks
    skip: (req: any) => {
      return req.path === "/health" || req.path === "/api/health";
    },
  });

  const processingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_PROCESSING_MAX || "10"),
    message: {
      success: false,
      message: "Too many processing requests, please try again later.",
      error: "PROCESSING_RATE_LIMIT_EXCEEDED",
    },
    skipSuccessfulRequests: false,
    // Use IP address for processing rate limiting too
    keyGenerator: (req: any) => {
      const forwarded = req.headers["x-forwarded-for"];
      const realIp = req.headers["x-real-ip"];
      const ip = forwarded ? forwarded.split(",")[0] : realIp || req.ip;
      return ip;
    },
  });

  app.use(limiter);

  // Body parsing
  app.use(express.json({ limit: "50mb", strict: false }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Cookie parsing
  app.use(cookieParser());

  // Store limiters for use in routes
  (app as any).processingLimiter = processingLimiter;
}

// Global service instances
let globalDocumentService: DocumentService | null = null;
let globalChatService: ChatService | null = null;

async function initializeServices() {
  const { dbConnection } = require("./database/config");

  await dbConnection.connect();
  console.log("✅ Database connected successfully");

  // Create singleton instances
  if (!globalDocumentService) {
    globalDocumentService = DocumentServiceFactory.createWithAllProcessors();
  }

  if (!globalChatService) {
    globalChatService = new ChatService(globalDocumentService);
  }

  const documentController = new DocumentController(globalDocumentService);
  const chatController = new ChatController(globalChatService);

  return { documentController, chatController };
}

function setupRoutes(
  app: express.Application,
  documentController: DocumentController,
  chatController: ChatController
) {
  // Initialize auth middleware with database pool
  const { dbConnection } = require("./database/config");
  AuthMiddleware.initialize(dbConnection.getPool());
  // Health check
  app.get("/health", async (req, res) => {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();

    // Get vector store status using global service instance
    let vectorStoreStatus = {
      available: false,
      message: "Not checked",
      documentCount: 0,
    };
    try {
      if (globalDocumentService) {
        vectorStoreStatus = await globalDocumentService.getVectorStoreStats();
      } else {
        vectorStoreStatus = {
          available: false,
          message: "Document service not initialized",
          documentCount: 0,
        };
      }
    } catch (error) {
      vectorStoreStatus = {
        available: false,
        message: `Error checking vector store: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        documentCount: 0,
      };
    }

    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      service: "RAG Demo Server",
      version: "2.0.0",
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
      vectorStore: vectorStoreStatus,
    });
  });

  // API routes
  const processingLimiter = (app as any).processingLimiter;

  // Authentication routes
  app.use("/api/auth", createAuthRoutes(dbConnection.getPool()));
  app.use("/api/users", createUserRoutes(dbConnection.getPool()));

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
