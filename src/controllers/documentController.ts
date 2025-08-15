import { Request, Response } from "express";
import { DocumentService } from "../services/documentService";
import { UploadResponse, ListDocumentsResponse } from "../types";

export class DocumentController {
  private documentService: DocumentService;

  constructor(documentService: DocumentService) {
    this.documentService = documentService;
  }

  async uploadDocument(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
        return;
      }

      const document = await this.documentService.uploadDocument(req.file);

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

  async listDocuments(req: Request, res: Response): Promise<void> {
    try {
      const documents = await this.documentService.listDocuments();

      const response: ListDocumentsResponse = {
        documents,
        total: documents.length,
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

  async getDocument(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const document = await this.documentService.getDocument(id);

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

  async deleteDocument(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const ok = await this.documentService.deleteDocument(id);
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
