import { Request, Response } from "express";
import { DocumentService } from "../services/documentService";
import { UploadResponse, ListDocumentsResponse } from "../types";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

export class DocumentController {
  private documentService: DocumentService;

  constructor(documentService: DocumentService) {
    this.documentService = documentService;
  }

  async uploadDocument(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
        return;
      }

      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      const document = await this.documentService.uploadDocument(
        req.file,
        req.user.id
      );

      const response: UploadResponse = {
        success: true,
        document,
        message: "Document uploaded successfully",
      };

      res.status(201).json(response);
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upload document",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async listDocuments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await this.documentService.listDocuments(
        page,
        limit,
        req.user.id
      );

      const response: ListDocumentsResponse = {
        documents: result.documents,
        total: result.total,
        hasMore: result.hasMore,
      };

      res.json(response);
    } catch (error) {
      console.error("List documents error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to list documents",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async getDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      const { id } = req.params;
      const document = await this.documentService.getDocument(id, req.user.id);

      if (!document) {
        res.status(404).json({
          success: false,
          message: "Document not found",
        });
        return;
      }

      res.json({ success: true, document });
    } catch (error) {
      console.error("Get document error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get document",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async deleteDocument(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      const { id } = req.params;
      const ok = await this.documentService.deleteDocument(id, req.user.id);
      if (!ok) {
        res.status(404).json({ success: false, message: "Document not found" });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Delete document error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete document",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
