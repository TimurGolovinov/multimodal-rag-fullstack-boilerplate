import { Router } from "express";
import { DocumentController } from "../controllers/documentController";
import { requireAuth } from "../middleware/authMiddleware";
import { FileValidationService } from "../services/fileValidationService";
import multer from "multer";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // Increased to 50MB for video files
  },
  fileFilter: (req, file, cb) => {
    console.log(
      `🔍 Multer fileFilter debug - File: ${file.originalname}, MIME: ${file.mimetype}`
    );

    // Use the new file validation service for initial filtering
    const allowedMimeTypes = FileValidationService.getAllowedMimeTypes();
    const allowedExtensions = FileValidationService.getAllowedExtensions();

    // Check MIME type first
    if (FileValidationService.isMimeTypeSupported(file.mimetype)) {
      console.log(
        `🔍 Multer fileFilter debug - MIME type ${file.mimetype} is supported`
      );
      cb(null, true);
      return;
    }

    // Check file extension as fallback
    const fileExtension = file.originalname
      .toLowerCase()
      .substring(file.originalname.lastIndexOf("."));

    if (FileValidationService.isExtensionAllowed(fileExtension)) {
      console.log(
        `🔍 Multer fileFilter debug - Extension ${fileExtension} is allowed`
      );
      cb(null, true);
      return;
    }

    // Reject unsupported files
    console.log(
      `🔍 Multer fileFilter debug - Rejecting file: ${file.originalname} (${file.mimetype})`
    );
    cb(
      new Error(
        `Unsupported file type: ${file.mimetype} (${
          file.originalname
        }). Allowed types: ${allowedMimeTypes.join(", ")}`
      )
    );
  },
});

export function createDocumentRoutes(
  documentController: DocumentController
): Router {
  // Upload document - REQUIRES AUTHENTICATION
  router.post("/upload", requireAuth, upload.single("document"), (req, res) => {
    documentController.uploadDocument(req, res);
  });

  // Multer error handler
  router.use((error: any, req: any, res: any, next: any) => {
    if (error instanceof multer.MulterError) {
      console.error(`🔍 Multer error: ${error.code} - ${error.message}`);
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: `File too large. Maximum size is 50MB.`,
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload error: ${error.message}`,
      });
    }
    next(error);
  });

  // List all documents - REQUIRES AUTHENTICATION
  router.get("/", requireAuth, (req, res) => {
    documentController.listDocuments(req, res);
  });

  // Get specific document - REQUIRES AUTHENTICATION
  router.get("/:id", requireAuth, (req, res) => {
    documentController.getDocument(req, res);
  });

  // Delete document - REQUIRES AUTHENTICATION
  router.delete("/:id", requireAuth, (req, res) => {
    documentController.deleteDocument(req, res);
  });

  // Debug endpoint to check stored file size
  router.get("/debug/:id", requireAuth, async (req: any, res) => {
    try {
      // Get document from database directly
      const {
        DocumentDatabaseService,
      } = require("../database/services/documentService");
      const dbService = new DocumentDatabaseService();
      const document = await dbService.getDocument(
        req.params.id,
        req.user?.userId
      );

      if (document) {
        // Check actual file size on disk
        const fs = require("fs");
        const path = require("path");
        const fullPath = path.join(process.cwd(), "uploads", document.filePath);
        if (fs.existsSync(fullPath)) {
          const stats = fs.statSync(fullPath);
          res.json({
            success: true,
            document: {
              id: document.id,
              filename: document.filename,
              storedFileSize: document.fileSize,
              actualFileSize: stats.size,
              sizeMatch: document.fileSize === stats.size,
              filePath: document.filePath,
            },
          });
        } else {
          res.status(404).json({
            success: false,
            message: "File not found on disk",
          });
        }
      } else {
        res.status(404).json({
          success: false,
          message: "Document not found",
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error checking file size",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return router;
}
