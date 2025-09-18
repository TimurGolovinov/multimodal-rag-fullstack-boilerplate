import { DocumentService } from "../../src/services/documentService";
import { DocumentServiceFactory } from "../../src/services/documentServiceFactory";
import { TextProcessorAdapter } from "../../src/services/processors/textProcessorAdapter";
import { PdfProcessorAdapter } from "../../src/services/processors/pdfProcessorAdapter";

// Mock external dependencies
jest.mock("../../src/database/services/documentService");
jest.mock("../../src/services/storageFactory");
jest.mock("../../src/services/openaiVectorStore");

describe("Document Processing Pipeline Integration", () => {
  let documentService: DocumentService;
  let mockDbService: any;
  let mockStorageService: any;
  let mockVectorStore: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock services
    mockDbService = {
      createDocument: jest.fn(),
      getDocumentById: jest.fn(),
      updateDocument: jest.fn(),
      deleteDocument: jest.fn(),
      getDocumentsByUserId: jest.fn(),
    };

    mockStorageService = {
      storeFile: jest.fn(),
      retrieveFile: jest.fn(),
      deleteFile: jest.fn(),
    };

    mockVectorStore = {
      addDocument: jest.fn(),
      removeDocument: jest.fn(),
      searchDocuments: jest.fn(),
      getFilesByDocumentId: jest.fn(),
    };

    // Create DocumentService with all processors
    documentService = DocumentServiceFactory.createWithAllProcessors();

    // Inject mocked dependencies
    (documentService as any).dbService = mockDbService;
    (documentService as any).storageService = mockStorageService;
    (documentService as any).vectorStore = mockVectorStore;

    // Verify processors are configured
    console.log(
      "Processors configured:",
      (documentService as any).processors.length
    );
    console.log("DocumentService created successfully");

    // Setup default mock responses
    mockDbService.createDocument.mockResolvedValue({
      id: "doc-123",
      filename: "test.txt",
      content: "test content",
      type: "text",
      uploadedAt: new Date(),
      mimeType: "text/plain",
      fileSize: 1024,
      externalId: "file-123",
    });

    mockStorageService.storeFile.mockResolvedValue({
      filePath: "/path/to/stored/file",
      fileSize: 1024,
    });

    mockVectorStore.addDocument.mockResolvedValue();
    mockVectorStore.getFilesByDocumentId.mockResolvedValue([
      { id: "file-123", filename: "test.txt" },
    ]);
    mockDbService.updateDocument.mockResolvedValue({});
  });

  describe("Text File Processing", () => {
    it("should process a text file through the complete pipeline", async () => {
      const textFile: Express.Multer.File = {
        fieldname: "document",
        originalname: "test.txt",
        encoding: "7bit",
        mimetype: "text/plain",
        size: 1024,
        buffer: Buffer.from("This is test content"),
        stream: {} as any,
        destination: "",
        filename: "test.txt",
        path: "/tmp/test.txt",
      };

      // Mock the extractText method to return the expected content
      jest
        .spyOn(documentService as any, "extractText")
        .mockResolvedValue("This is test content");

      console.log("About to call uploadDocument...");
      const result = await documentService.uploadDocument(textFile, "user-123");
      console.log("Upload completed, checking vector store calls...");

      // Verify database document creation
      expect(mockDbService.createDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: "test.txt",
          mimeType: "text/plain",
          fileSize: 1024,
          userId: "user-123",
        })
      );

      // Verify file storage
      expect(mockStorageService.storeFile).toHaveBeenCalledWith(
        textFile,
        "documents"
      );

      // Verify vector store addition (should use extracted text for text files)
      expect(mockVectorStore.addDocument).toHaveBeenCalledWith(
        "doc-123",
        "This is test content", // Should use extracted text
        expect.objectContaining({
          filename: "test.txt",
          type: "text",
        })
      );

      // Verify external ID update
      expect(mockDbService.updateDocument).toHaveBeenCalledWith("doc-123", {
        externalId: "file-123",
      });

      expect(result).toBeDefined();
    });
  });

  describe("PDF File Processing", () => {
    it("should process a PDF file through the complete pipeline", async () => {
      const pdfFile: Express.Multer.File = {
        fieldname: "document",
        originalname: "test.pdf",
        encoding: "7bit",
        mimetype: "application/pdf",
        size: 2048,
        buffer: Buffer.from("PDF content"),
        stream: {} as any,
        destination: "",
        filename: "test.pdf",
        path: "/tmp/test.pdf",
      };

      // Mock PDF processing to return extracted text
      jest
        .spyOn(documentService as any, "extractText")
        .mockResolvedValue("Extracted PDF text content");

      const result = await documentService.uploadDocument(pdfFile, "user-123");

      // Verify database document creation
      expect(mockDbService.createDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: "test.pdf",
          mimeType: "application/pdf",
          fileSize: 2048,
          userId: "user-123",
        })
      );

      // Verify file storage
      expect(mockStorageService.storeFile).toHaveBeenCalledWith(
        pdfFile,
        "documents"
      );

      // Verify vector store addition (should use original buffer for PDF files)
      expect(mockVectorStore.addDocument).toHaveBeenCalledWith(
        "doc-123",
        pdfFile.buffer, // Should use original buffer for PDF
        expect.objectContaining({
          filename: "test.pdf",
          type: "pdf",
        })
      );

      expect(result).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      const textFile: Express.Multer.File = {
        fieldname: "document",
        originalname: "test.txt",
        encoding: "7bit",
        mimetype: "text/plain",
        size: 1024,
        buffer: Buffer.from("test content"),
        stream: {} as any,
        destination: "",
        filename: "test.txt",
        path: "/tmp/test.txt",
      };

      mockDbService.createDocument.mockRejectedValue(
        new Error("Database connection failed")
      );

      await expect(
        documentService.uploadDocument(textFile, "user-123")
      ).rejects.toThrow("Database connection failed");
    });

    it("should handle storage errors gracefully", async () => {
      const textFile: Express.Multer.File = {
        fieldname: "document",
        originalname: "test.txt",
        encoding: "7bit",
        mimetype: "text/plain",
        size: 1024,
        buffer: Buffer.from("test content"),
        stream: {} as any,
        destination: "",
        filename: "test.txt",
        path: "/tmp/test.txt",
      };

      mockStorageService.storeFile.mockRejectedValue(
        new Error("Storage service unavailable")
      );

      await expect(
        documentService.uploadDocument(textFile, "user-123")
      ).rejects.toThrow("Storage service unavailable");
    });

    it("should handle vector store errors gracefully", async () => {
      const textFile: Express.Multer.File = {
        fieldname: "document",
        originalname: "test.txt",
        encoding: "7bit",
        mimetype: "text/plain",
        size: 1024,
        buffer: Buffer.from("test content"),
        stream: {} as any,
        destination: "",
        filename: "test.txt",
        path: "/tmp/test.txt",
      };

      mockVectorStore.addDocument.mockRejectedValue(
        new Error("Vector store API error")
      );

      // Should not throw error, but log warning
      const result = await documentService.uploadDocument(textFile, "user-123");
      expect(result).toBeDefined();
    });
  });

  describe("Processor Selection", () => {
    it("should select the correct processor for different file types", () => {
      const textProcessor = new TextProcessorAdapter();
      const pdfProcessor = new PdfProcessorAdapter();

      // Test text file detection
      expect(textProcessor.canProcess("text/plain", "test.txt")).toBe(true);
      expect(
        textProcessor.canProcess("application/octet-stream", "test.txt")
      ).toBe(true);
      expect(textProcessor.canProcess("text/plain", "test")).toBe(false); // No extension

      // Test PDF file detection
      expect(pdfProcessor.canProcess("application/pdf", "test.pdf")).toBe(true);
      expect(
        pdfProcessor.canProcess("application/octet-stream", "test.pdf")
      ).toBe(true);
      expect(pdfProcessor.canProcess("application/pdf", "test.txt")).toBe(
        false
      );
    });
  });

  describe("File Type Detection", () => {
    it("should correctly identify file types", () => {
      const getDocumentType = (documentService as any).getDocumentType.bind(
        documentService
      );

      expect(getDocumentType("text/plain", "test.txt")).toBe("text");
      expect(getDocumentType("application/pdf", "test.pdf")).toBe("pdf");
      expect(getDocumentType("image/jpeg", "test.jpg")).toBe("image");
      expect(getDocumentType("audio/mp3", "test.mp3")).toBe("audio");
      expect(getDocumentType("video/mp4", "test.mp4")).toBe("video");
      expect(
        getDocumentType(
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "test.docx"
        )
      ).toBe("word");
    });
  });

  describe("Binary vs Text File Handling", () => {
    it("should correctly identify binary vs text files", () => {
      const isBinaryFileType = (documentService as any).isBinaryFileType.bind(
        documentService
      );

      // Text files should use extracted content
      expect(isBinaryFileType("text", "text/plain")).toBe(false);

      // Binary files should use original buffer
      expect(isBinaryFileType("pdf", "application/pdf")).toBe(true);
      expect(isBinaryFileType("image", "image/jpeg")).toBe(true);
      expect(isBinaryFileType("audio", "audio/mp3")).toBe(true);
      expect(isBinaryFileType("video", "video/mp4")).toBe(true);
      expect(isBinaryFileType("word", "application/msword")).toBe(true);
    });
  });
});
