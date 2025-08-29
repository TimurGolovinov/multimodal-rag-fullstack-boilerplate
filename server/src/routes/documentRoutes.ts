import { Router } from "express";
import { DocumentController } from "../controllers/documentController";
import multer from "multer";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // Increased to 50MB for video files
  },
  fileFilter: (req, file, cb) => {
    // Allow all supported file types
    const allowedMimeTypes = [
      // Text documents
      "text/plain",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

      // Images
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",

      // Audio
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/mp4",
      "audio/ogg",
      "audio/flac",
      "audio/aac",
      "audio/x-ms-wma",
      "audio/opus",

      // Video
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
      "video/webm",
      "video/x-matroska",
      "video/x-flv",
      "video/x-ms-wmv",
      "video/mp4",
      "video/3gpp",
      "video/ogg",
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      // Also check file extension as fallback
      const allowedExtensions = [
        // Text
        ".txt",
        ".pdf",
        ".doc",
        ".docx",
        // Images
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".webp",
        ".svg",
        // Audio
        ".mp3",
        ".wav",
        ".m4a",
        ".ogg",
        ".flac",
        ".aac",
        ".wma",
        ".opus",
        // Video
        ".mp4",
        ".mov",
        ".avi",
        ".webm",
        ".mkv",
        ".flv",
        ".wmv",
        ".m4v",
        ".3gp",
        ".ogv",
      ];

      const fileExtension = file.originalname
        .toLowerCase()
        .substring(file.originalname.lastIndexOf("."));
      if (allowedExtensions.includes(fileExtension)) {
        cb(null, true);
      } else {
        cb(
          new Error(
            `Unsupported file type: ${file.mimetype} (${file.originalname})`
          )
        );
      }
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

  // Delete document
  router.delete("/:id", (req, res) => {
    documentController.deleteDocument(req, res);
  });

  return router;
}
