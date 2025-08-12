import { Router } from "express";
import { DocumentController } from "../controllers/documentController";
import multer from "multer";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow text, PDF, and Word documents
    if (
      file.mimetype === "text/plain" ||
      file.mimetype === "application/pdf" ||
      file.mimetype.includes("word") ||
      file.mimetype.includes("docx")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type"));
    }
  },
});

export function createDocumentRoutes(
  documentController: DocumentController
): Router {
  // Upload document
  router.post("/upload", upload.single("document"), (req, res) => {
    documentController.uploadDocument(req, res);
  });

  // List all documents
  router.get("/", (req, res) => {
    documentController.listDocuments(req, res);
  });

  // Get specific document
  router.get("/:id", (req, res) => {
    documentController.getDocument(req, res);
  });

  return router;
}
