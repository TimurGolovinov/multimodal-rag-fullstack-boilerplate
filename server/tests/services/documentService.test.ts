import {
  DocumentService,
  DocumentProcessor,
} from "../../src/services/documentService";
import { DocumentDatabaseService } from "../../src/database/services/documentService";
import { StorageService } from "../../src/services/storageFactory";
import { OpenAIVectorStore } from "../../src/services/openaiVectorStore";
import { Document, DocumentType } from "../../src/types";

// Mock dependencies
jest.mock("../../src/database/services/documentService");
jest.mock("../../src/services/storageFactory");
jest.mock("../../src/services/openaiVectorStore");

describe("DocumentService", () => {
  let documentService: DocumentService;
  let mockDbService: jest.Mocked<DocumentDatabaseService>;
  let mockStorageService: jest.Mocked<StorageService>;
  let mockVectorStore: jest.Mocked<OpenAIVectorStore>;
  let mockProcessor: jest.Mocked<DocumentProcessor>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instances
    mockDbService = {
      createDocument: jest.fn(),
      getDocumentById: jest.fn(),
      updateDocument: jest.fn(),
      deleteDocument: jest.fn(),
      getDocumentsByUserId: jest.fn(),
    } as any;

    mockStorageService = {
      storeFile: jest.fn(),
      retrieveFile: jest.fn(),
      deleteFile: jest.fn(),
    } as any;

    mockVectorStore = {
      addDocument: jest.fn(),
      removeDocument: jest.fn(),
      searchDocuments: jest.fn(),
      getFilesByDocumentId: jest.fn(),
    } as any;

    mockProcessor = {
      canProcess: jest.fn().mockReturnValue(true), // Default to true
      extractText: jest.fn(),
    } as any;

    // Create DocumentService with mocked dependencies
    documentService = new DocumentService({
      pdfProcessor: mockProcessor,
    });

    // Inject mocked dependencies
    (documentService as any).dbService = mockDbService;
    (documentService as any).storageService = mockStorageService;
    (documentService as any).vectorStore = mockVectorStore;
  });

  describe("getDocumentType", () => {
    it('should return "pdf" for PDF files', () => {
      const result = (documentService as any).getDocumentType(
        "application/pdf",
        "test.pdf"
      );
      expect(result).toBe("pdf");
    });

    it('should return "image" for image MIME types', () => {
      const result = (documentService as any).getDocumentType(
        "image/jpeg",
        "test.jpg"
      );
      expect(result).toBe("image");
    });

    it('should return "audio" for audio MIME types', () => {
      const result = (documentService as any).getDocumentType(
        "audio/mp3",
        "test.mp3"
      );
      expect(result).toBe("audio");
    });

    it('should return "video" for video MIME types', () => {
      const result = (documentService as any).getDocumentType(
        "video/mp4",
        "test.mp4"
      );
      expect(result).toBe("video");
    });

    it('should return "word" for Word documents', () => {
      const result = (documentService as any).getDocumentType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "test.docx"
      );
      expect(result).toBe("word");
    });

    it('should return "text" for text MIME types', () => {
      const result = (documentService as any).getDocumentType(
        "text/plain",
        "test.txt"
      );
      expect(result).toBe("text");
    });

    it('should return "text" as fallback for unknown types', () => {
      const result = (documentService as any).getDocumentType(
        "unknown/type",
        "test.unknown"
      );
      expect(result).toBe("text");
    });

    it("should detect file type by extension when MIME type is generic", () => {
      const result = (documentService as any).getDocumentType(
        "application/octet-stream",
        "test.docx"
      );
      expect(result).toBe("word");
    });
  });

  describe("isBinaryFileType", () => {
    it("should return false for text files", () => {
      const result = (documentService as any).isBinaryFileType(
        "text",
        "text/plain"
      );
      expect(result).toBe(false);
    });

    it("should return true for PDF files", () => {
      const result = (documentService as any).isBinaryFileType(
        "pdf",
        "application/pdf"
      );
      expect(result).toBe(true);
    });

    it("should return true for image files", () => {
      const result = (documentService as any).isBinaryFileType(
        "image",
        "image/jpeg"
      );
      expect(result).toBe(true);
    });

    it("should return true for audio files", () => {
      const result = (documentService as any).isBinaryFileType(
        "audio",
        "audio/mp3"
      );
      expect(result).toBe(true);
    });

    it("should return true for video files", () => {
      const result = (documentService as any).isBinaryFileType(
        "video",
        "video/mp4"
      );
      expect(result).toBe(true);
    });

    it("should return true for word documents", () => {
      const result = (documentService as any).isBinaryFileType(
        "word",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      expect(result).toBe(true);
    });
  });

  describe("findProcessor", () => {
    it("should return the first processor that can handle the file", () => {
      const processor1 = {
        canProcess: jest.fn().mockReturnValue(false),
      } as any;
      const processor2 = { canProcess: jest.fn().mockReturnValue(true) } as any;
      const processor3 = { canProcess: jest.fn().mockReturnValue(true) } as any;

      (documentService as any).processors = [
        processor1,
        processor2,
        processor3,
      ];

      const result = (documentService as any).findProcessor(
        "image/jpeg",
        "test.jpg"
      );

      expect(result).toBe(processor2);
      expect(processor1.canProcess).toHaveBeenCalledWith(
        "image/jpeg",
        "test.jpg"
      );
      expect(processor2.canProcess).toHaveBeenCalledWith(
        "image/jpeg",
        "test.jpg"
      );
      expect(processor3.canProcess).not.toHaveBeenCalled();
    });

    it("should return undefined when no processor can handle the file", () => {
      const processor1 = {
        canProcess: jest.fn().mockReturnValue(false),
      } as any;
      const processor2 = {
        canProcess: jest.fn().mockReturnValue(false),
      } as any;

      (documentService as any).processors = [processor1, processor2];

      const result = (documentService as any).findProcessor(
        "unknown/type",
        "test.unknown"
      );

      expect(result).toBeUndefined();
    });

    it("should return undefined when no processors are configured", () => {
      (documentService as any).processors = [];

      const result = (documentService as any).findProcessor(
        "image/jpeg",
        "test.jpg"
      );

      expect(result).toBeUndefined();
    });
  });

  describe("extractText", () => {
    it("should extract text using the appropriate processor", async () => {
      const mockFile: Express.Multer.File = {
        fieldname: "document",
        originalname: "test.jpg",
        encoding: "7bit",
        mimetype: "image/jpeg",
        size: 1024,
        buffer: Buffer.from("test content"),
        stream: {} as any,
        destination: "",
        filename: "test.jpg",
        path: "/tmp/test.jpg",
      };
      const mockResult = {
        content: "extracted text",
        thumbnail: "base64thumbnail",
      };

      mockProcessor.canProcess.mockReturnValue(true);
      mockProcessor.extractText.mockResolvedValue(mockResult);

      (documentService as any).processors = [mockProcessor];

      const result = await (documentService as any).extractText(mockFile);

      expect(mockProcessor.canProcess).toHaveBeenCalledWith(
        "image/jpeg",
        "test.jpg"
      );
      expect(mockProcessor.extractText).toHaveBeenCalledWith(
        mockFile.buffer,
        "test.jpg"
      );
      expect(result).toBe("extracted text");
    });

    it("should return fallback content when no processor can handle the file", async () => {
      const mockFile: Express.Multer.File = {
        fieldname: "document",
        originalname: "test.unknown",
        encoding: "7bit",
        mimetype: "unknown/type",
        size: 1024,
        buffer: Buffer.from("test"),
        stream: {} as any,
        destination: "",
        filename: "test.unknown",
        path: "/tmp/test.unknown",
      };

      mockProcessor.canProcess.mockReturnValue(false);
      (documentService as any).processors = [mockProcessor];

      const result = await (documentService as any).extractText(mockFile);

      expect(result).toBe("[unknown/type file: test.unknown]");
    });

    it("should handle processor errors gracefully", async () => {
      const mockFile: Express.Multer.File = {
        fieldname: "document",
        originalname: "test.jpg",
        encoding: "7bit",
        mimetype: "image/jpeg",
        size: 1024,
        buffer: Buffer.from("test"),
        stream: {} as any,
        destination: "",
        filename: "test.jpg",
        path: "/tmp/test.jpg",
      };

      mockProcessor.canProcess.mockReturnValue(true);
      mockProcessor.extractText.mockRejectedValue(
        new Error("Processing failed")
      );
      (documentService as any).processors = [mockProcessor];

      const result = await (documentService as any).extractText(mockFile);

      expect(result).toBe("[image/jpeg file: test.jpg]");
    });
  });

  describe("uploadDocument", () => {
    const mockFile: Express.Multer.File = {
      fieldname: "document",
      originalname: "test.pdf",
      encoding: "7bit",
      mimetype: "application/pdf",
      size: 1024,
      buffer: Buffer.from("test content"),
      stream: {} as any,
      destination: "",
      filename: "test.pdf",
      path: "/tmp/test.pdf",
    };

    const mockUserId = "user-123";

    beforeEach(() => {
      mockDbService.createDocument.mockResolvedValue({
        id: "doc-123",
        filename: "test.pdf",
        content: "extracted content",
        type: "pdf",
        uploadedAt: new Date(),
        mimeType: "application/pdf",
        fileSize: 1024,
        externalId: "file-123",
      } as Document);

      mockStorageService.storeFile.mockResolvedValue({
        filePath: "/path/to/stored/file",
        fileSize: 1024,
      });
      mockVectorStore.addDocument.mockResolvedValue();
      mockVectorStore.getFilesByDocumentId.mockResolvedValue([
        { id: "file-123", filename: "test.pdf" },
      ]);
      mockDbService.updateDocument.mockResolvedValue({} as any);
    });

    it("should successfully upload a document with all steps", async () => {
      // Mock the extractText method directly
      jest
        .spyOn(documentService as any, "extractText")
        .mockResolvedValue("extracted text");

      try {
        console.log("About to call uploadDocument...");
        const result = await documentService.uploadDocument(
          mockFile,
          mockUserId
        );

        console.log("Upload completed successfully");
        console.log(
          "Vector store calls:",
          mockVectorStore.addDocument.mock.calls.length
        );

        expect(mockVectorStore.addDocument).toHaveBeenCalledWith(
          "doc-123",
          mockFile.buffer, // Should use original buffer for PDF
          expect.objectContaining({
            filename: "test.pdf",
            type: "pdf",
          })
        );
        expect(result).toBeDefined();
      } catch (error) {
        console.error("Upload failed:", error);
        throw error;
      }
    });

    it("should use extracted text content for text files", async () => {
      const textFile: Express.Multer.File = {
        ...mockFile,
        mimetype: "text/plain",
        originalname: "test.txt",
        filename: "test.txt",
      };

      mockProcessor.extractText.mockResolvedValue({
        content: "extracted text content",
      });

      await documentService.uploadDocument(textFile, mockUserId);

      expect(mockVectorStore.addDocument).toHaveBeenCalledWith(
        "doc-123",
        "extracted text content", // Should use extracted text for text files
        expect.objectContaining({
          filename: "test.txt",
          type: "text",
        })
      );
    });

    it("should handle database errors gracefully", async () => {
      mockDbService.createDocument.mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        documentService.uploadDocument(mockFile, mockUserId)
      ).rejects.toThrow("Database error");
    });

    it("should handle storage errors gracefully", async () => {
      mockStorageService.storeFile.mockRejectedValue(
        new Error("Storage error")
      );

      await expect(
        documentService.uploadDocument(mockFile, mockUserId)
      ).rejects.toThrow("Storage error");
    });

    it("should handle vector store errors gracefully", async () => {
      mockProcessor.extractText.mockResolvedValue({
        content: "extracted text",
      });
      mockVectorStore.addDocument.mockRejectedValue(
        new Error("Vector store error")
      );

      const result = await documentService.uploadDocument(mockFile, mockUserId);

      expect(result).toBeDefined();
      expect(mockVectorStore.addDocument).toHaveBeenCalled();
    });

    it("should skip vector store when not configured", async () => {
      (documentService as any).vectorStore = undefined;
      mockProcessor.extractText.mockResolvedValue({
        content: "extracted text",
      });

      const result = await documentService.uploadDocument(mockFile, mockUserId);

      expect(mockVectorStore.addDocument).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });
});
