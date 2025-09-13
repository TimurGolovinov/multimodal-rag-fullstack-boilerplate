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
    // Use the new file validation service for initial filtering
    const allowedMimeTypes = FileValidationService.getAllowedMimeTypes();
    const allowedExtensions = FileValidationService.getAllowedExtensions();

    // Check MIME type first
    if (FileValidationService.isMimeTypeSupported(file.mimetype)) {
      cb(null, true);
      return;
    }

    // Check file extension as fallback
    const fileExtension = file.originalname
      .toLowerCase()
      .substring(file.originalname.lastIndexOf("."));

    if (FileValidationService.isExtensionAllowed(fileExtension)) {
      cb(null, true);
      return;
    }

    // Reject unsupported files
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

  return router;
}
