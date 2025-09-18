import { Router } from "express";
import multer from "multer";
import { VideoController } from "../controllers/videoController";
import { requireAuth } from "../middleware/authMiddleware";
import { FileValidationService } from "../services/fileValidationService";

const router = Router();

// Configure multer for video processing (frames + audio)
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
    files: 30, // Maximum 30 files total (frames + audio segments)
  },
  fileFilter: (req, file, cb) => {
    // Accept image files for frames and audio files for segments
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("audio/")
    ) {
      cb(null, true);
    } else {
      cb(
        new Error("Only image and audio files are allowed for video processing")
      );
    }
  },
});

// File validation middleware
const validateFiles = async (req: any, res: any, next: any) => {
  try {
    const files = req.files as
      | Express.Multer.File[]
      | { [fieldname: string]: Express.Multer.File[] };

    // Handle both array format and object format from multer
    let filesArray: Express.Multer.File[];
    if (Array.isArray(files)) {
      filesArray = files;
    } else if (files && typeof files === "object") {
      // Convert object format to array
      filesArray = Object.values(files).flat();
    } else {
      return res.status(400).json({
        success: false,
        error: "No files provided",
        message: "At least one file is required",
      });
    }

    if (filesArray.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No files provided",
        message: "At least one file is required",
      });
    }

    // Validate files using the validation service
    const validationResults = await FileValidationService.validateFiles(
      filesArray,
      FileValidationService.getVideoProcessingConfig()
    );

    // Check if any files failed validation
    const failedValidations = validationResults.filter(
      (result) => !result.isValid
    );
    if (failedValidations.length > 0) {
      const errors = failedValidations.flatMap((result) => result.errors);
      return res.status(400).json({
        success: false,
        error: "File validation failed",
        message: "One or more files failed validation",
        details: errors,
      });
    }

    // Add validation results to request for controller use
    req.fileValidations = validationResults;
    next();
  } catch (error) {
    console.error("File validation error:", error);
    res.status(500).json({
      success: false,
      error: "File validation failed",
      message: "Internal server error during file validation",
    });
  }
};

export function createVideoRoutes(videoController: VideoController): Router {
  // Single video processing endpoint for frames + audio processing
  router.post(
    "/process",
    requireAuth,
    videoUpload.fields([
      { name: "frames", maxCount: 20 },
      { name: "audioSegments", maxCount: 10 },
    ]),
    validateFiles,
    (req, res) => videoController.processVideo(req, res)
  );

  return router;
}
