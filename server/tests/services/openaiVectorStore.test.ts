import { OpenAIVectorStore } from "../../src/services/openaiVectorStore";
import OpenAI from "openai";

// Mock OpenAI
jest.mock("openai");
const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

describe("OpenAIVectorStore", () => {
  let vectorStore: OpenAIVectorStore;
  let mockOpenAI: jest.Mocked<OpenAI>;
  let mockFiles: jest.Mocked<OpenAI.Files>;
  let mockVectorStores: jest.Mocked<OpenAI.Beta.VectorStores>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock OpenAI instance
    mockOpenAI = {
      files: {} as any,
      beta: {
        vectorStores: {} as any,
      },
    } as any;

    mockFiles = {
      create: jest.fn(),
      retrieve: jest.fn(),
      del: jest.fn(),
    } as any;

    mockVectorStores = {
      create: jest.fn(),
      retrieve: jest.fn(),
      files: {
        create: jest.fn(),
        list: jest.fn(),
        del: jest.fn(),
      },
    } as any;

    mockOpenAI.files = mockFiles;
    mockOpenAI.beta.vectorStores = mockVectorStores;

    MockedOpenAI.mockImplementation(() => mockOpenAI);

    // Create vector store instance
    vectorStore = new OpenAIVectorStore();
  });

  describe("addDocument", () => {
    const mockMetadata = {
      filename: "test.pdf",
      type: "pdf",
      uploadedAt: "2024-01-01T00:00:00.000Z",
      size: "1024",
      mimetype: "application/pdf",
      userId: "user-123",
    };

    beforeEach(() => {
      // Mock successful file creation
      mockFiles.create.mockResolvedValue({
        id: "file-123",
        object: "file",
        bytes: 1024,
        created_at: 1640995200,
        filename: "test.pdf",
        purpose: "assistants",
        status: "uploaded",
      } as any);

      // Mock successful file processing
      mockFiles.retrieve.mockResolvedValue({
        id: "file-123",
        object: "file",
        bytes: 1024,
        created_at: 1640995200,
        filename: "test.pdf",
        purpose: "assistants",
        status: "processed",
      } as any);

      // Mock vector store file creation
      mockVectorStores.files.create.mockResolvedValue({
        id: "vs_file-123",
        object: "vector_store_file",
        created_at: 1640995200,
        file_id: "file-123",
        status: "completed",
        usage_bytes: 1024,
      } as any);
    });

    it("should successfully add a document with Buffer content", async () => {
      const bufferContent = Buffer.from("test content");

      await vectorStore.addDocument("doc-123", bufferContent, mockMetadata);

      expect(mockFiles.create).toHaveBeenCalledWith({
        file: expect.any(File),
        purpose: "assistants",
      });
      expect(mockVectorStores.files.create).toHaveBeenCalledWith(
        expect.any(String),
        {
          file_id: "file-123",
          chunking_strategy: {
            type: "static",
            static: {
              max_chunk_size_tokens: 800,
              chunk_overlap_tokens: 400,
            },
          },
        }
      );
    });

    it("should successfully add a document with string content", async () => {
      const stringContent = "test text content";

      await vectorStore.addDocument("doc-123", stringContent, mockMetadata);

      expect(mockFiles.create).toHaveBeenCalledWith({
        file: expect.any(File),
        purpose: "assistants",
      });
      expect(mockVectorStores.files.create).toHaveBeenCalledWith(
        expect.any(String),
        {
          file_id: "file-123",
          chunking_strategy: {
            type: "static",
            static: {
              max_chunk_size_tokens: 800,
              chunk_overlap_tokens: 400,
            },
          },
        }
      );
    });

    it("should handle file creation errors", async () => {
      mockFiles.create.mockRejectedValue(new Error("File creation failed"));

      await expect(
        vectorStore.addDocument("doc-123", Buffer.from("test"), mockMetadata)
      ).rejects.toThrow("File creation failed");
    });

    it("should handle file processing timeout", async () => {
      // Mock file that never processes
      mockFiles.retrieve.mockResolvedValue({
        id: "file-123",
        status: "uploaded",
      } as any);

      // Mock setTimeout to simulate timeout
      jest.spyOn(global, "setTimeout").mockImplementation((callback) => {
        // Don't call the callback to simulate timeout
        return {} as any;
      });

      await expect(
        vectorStore.addDocument("doc-123", Buffer.from("test"), mockMetadata)
      ).rejects.toThrow("File processing timeout");
    });

    it("should handle file processing errors", async () => {
      mockFiles.retrieve.mockResolvedValue({
        id: "file-123",
        status: "error",
        status_details: "Processing failed",
      } as any);

      await expect(
        vectorStore.addDocument("doc-123", Buffer.from("test"), mockMetadata)
      ).rejects.toThrow("File processing failed: Processing failed");
    });

    it("should handle cancelled file processing", async () => {
      mockFiles.retrieve.mockResolvedValue({
        id: "file-123",
        status: "cancelled",
        status_details: "File was cancelled",
      } as any);

      await expect(
        vectorStore.addDocument("doc-123", Buffer.from("test"), mockMetadata)
      ).rejects.toThrow("File processing was cancelled: File was cancelled");
    });

    it("should handle vector store file creation errors", async () => {
      mockVectorStores.files.create.mockRejectedValue(
        new Error("Vector store error")
      );

      await expect(
        vectorStore.addDocument("doc-123", Buffer.from("test"), mockMetadata)
      ).rejects.toThrow("Vector store error");
    });
  });

  describe("waitForFileProcessing", () => {
    it("should return when file is processed successfully", async () => {
      mockFiles.retrieve.mockResolvedValue({
        id: "file-123",
        status: "processed",
      } as any);

      const result = await (vectorStore as any).waitForFileProcessing(
        "file-123",
        "test.pdf"
      );

      expect(result).toBeDefined();
      expect(mockFiles.retrieve).toHaveBeenCalledWith("file-123");
    });

    it("should poll until file is processed", async () => {
      let callCount = 0;
      mockFiles.retrieve.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            id: "file-123",
            status: "uploaded",
          } as any);
        } else if (callCount === 2) {
          return Promise.resolve({
            id: "file-123",
            status: "processing",
          } as any);
        } else {
          return Promise.resolve({
            id: "file-123",
            status: "processed",
          } as any);
        }
      });

      const result = await (vectorStore as any).waitForFileProcessing(
        "file-123",
        "test.pdf"
      );

      expect(result).toBeDefined();
      expect(mockFiles.retrieve).toHaveBeenCalledTimes(3);
    });

    it("should throw error when file processing fails", async () => {
      mockFiles.retrieve.mockResolvedValue({
        id: "file-123",
        status: "error",
        status_details: "Processing failed",
      } as any);

      await expect(
        (vectorStore as any).waitForFileProcessing("file-123", "test.pdf")
      ).rejects.toThrow("File processing failed: Processing failed");
    });

    it("should throw error when file processing is cancelled", async () => {
      mockFiles.retrieve.mockResolvedValue({
        id: "file-123",
        status: "cancelled",
        status_details: "File was cancelled",
      } as any);

      await expect(
        (vectorStore as any).waitForFileProcessing("file-123", "test.pdf")
      ).rejects.toThrow("File processing was cancelled: File was cancelled");
    });

    it("should timeout after maximum attempts", async () => {
      mockFiles.retrieve.mockResolvedValue({
        id: "file-123",
        status: "uploaded",
      } as any);

      // Mock setTimeout to immediately resolve to simulate timeout
      jest.spyOn(global, "setTimeout").mockImplementation((callback) => {
        setTimeout(() => callback(), 0);
        return {} as any;
      });

      await expect(
        (vectorStore as any).waitForFileProcessing("file-123", "test.pdf")
      ).rejects.toThrow("File processing timeout");
    });
  });

  describe("removeDocument", () => {
    it("should successfully remove a document", async () => {
      mockVectorStores.files.del.mockResolvedValue({
        id: "vs_file-123",
        object: "vector_store_file.deleted",
        deleted: true,
      } as any);

      await vectorStore.removeDocument("doc-123");

      expect(mockVectorStores.files.del).toHaveBeenCalledWith("doc-123");
    });

    it("should handle removal errors", async () => {
      mockVectorStores.files.del.mockRejectedValue(new Error("Removal failed"));

      await expect(vectorStore.removeDocument("doc-123")).rejects.toThrow(
        "Removal failed"
      );
    });
  });

  describe("searchDocuments", () => {
    it("should successfully search documents", async () => {
      const mockResults = {
        data: [
          {
            id: "vs_file-123",
            object: "vector_store_file",
            created_at: 1640995200,
            file_id: "file-123",
            status: "completed",
            usage_bytes: 1024,
          },
        ],
        object: "list",
        first_id: "vs_file-123",
        last_id: "vs_file-123",
        has_more: false,
      };

      mockVectorStores.files.list.mockResolvedValue(mockResults as any);

      const result = await vectorStore.searchDocuments("test query");

      expect(mockVectorStores.files.list).toHaveBeenCalledWith(
        expect.any(String),
        {
          limit: 10,
          order: "desc",
        }
      );
      expect(result).toBe(mockResults);
    });

    it("should handle search errors", async () => {
      mockVectorStores.files.list.mockRejectedValue(new Error("Search failed"));

      await expect(vectorStore.searchDocuments("test query")).rejects.toThrow(
        "Search failed"
      );
    });
  });

  describe("content handling", () => {
    it("should create File object with correct properties for Buffer content", async () => {
      const bufferContent = Buffer.from("test content");
      const mockFile = new File([bufferContent], "test.pdf", {
        type: "application/pdf",
      });

      // Mock File constructor to capture the call
      const FileSpy = jest
        .spyOn(global, "File")
        .mockImplementation(() => mockFile);

      await vectorStore.addDocument("doc-123", bufferContent, mockMetadata);

      expect(FileSpy).toHaveBeenCalledWith([bufferContent], "test.pdf", {
        type: "application/pdf",
      });
    });

    it("should create File object with correct properties for string content", async () => {
      const stringContent = "test text content";
      const mockFile = new File([Buffer.from(stringContent)], "test.txt", {
        type: "text/plain",
      });

      const FileSpy = jest
        .spyOn(global, "File")
        .mockImplementation(() => mockFile);

      await vectorStore.addDocument("doc-123", stringContent, mockMetadata);

      expect(FileSpy).toHaveBeenCalledWith(
        [Buffer.from(stringContent)],
        "test.pdf",
        { type: "application/pdf" }
      );
    });
  });
});

