import { DocumentServiceFactory } from "../../src/services/documentServiceFactory";
import { DocumentService } from "../../src/services/documentService";
import {
  ImageProcessorAdapter,
  AudioProcessorAdapter,
  VideoProcessorAdapter,
  PdfProcessorAdapter,
  WordProcessorAdapter,
  TextProcessorAdapter,
} from "../../src/services/processors";

// Mock the processor adapters
jest.mock("../../src/services/processors", () => ({
  ImageProcessorAdapter: jest.fn(),
  AudioProcessorAdapter: jest.fn(),
  VideoProcessorAdapter: jest.fn(),
  PdfProcessorAdapter: jest.fn(),
  WordProcessorAdapter: jest.fn(),
  TextProcessorAdapter: jest.fn(),
}));

// Mock DocumentService
jest.mock("../../src/services/documentService");

describe("DocumentServiceFactory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createWithAllProcessors", () => {
    it("should create DocumentService with all processors", () => {
      const mockDocumentService = {} as DocumentService;
      (
        DocumentService as jest.MockedClass<typeof DocumentService>
      ).mockImplementation(() => mockDocumentService);

      const result = DocumentServiceFactory.createWithAllProcessors();

      expect(DocumentService).toHaveBeenCalledWith({
        imageProcessor: expect.any(ImageProcessorAdapter),
        audioProcessor: expect.any(AudioProcessorAdapter),
        videoProcessor: expect.any(VideoProcessorAdapter),
        pdfProcessor: expect.any(PdfProcessorAdapter),
        wordProcessor: expect.any(WordProcessorAdapter),
        textProcessor: expect.any(TextProcessorAdapter),
      });
      expect(result).toBe(mockDocumentService);
    });

    it("should instantiate all processor adapters", () => {
      DocumentServiceFactory.createWithAllProcessors();

      expect(ImageProcessorAdapter).toHaveBeenCalledTimes(1);
      expect(AudioProcessorAdapter).toHaveBeenCalledTimes(1);
      expect(VideoProcessorAdapter).toHaveBeenCalledTimes(1);
      expect(PdfProcessorAdapter).toHaveBeenCalledTimes(1);
      expect(WordProcessorAdapter).toHaveBeenCalledTimes(1);
      expect(TextProcessorAdapter).toHaveBeenCalledTimes(1);
    });
  });

  describe("createTextOnly", () => {
    it("should create DocumentService with only text-based processors", () => {
      const mockDocumentService = {} as DocumentService;
      (
        DocumentService as jest.MockedClass<typeof DocumentService>
      ).mockImplementation(() => mockDocumentService);

      const result = DocumentServiceFactory.createTextOnly();

      expect(DocumentService).toHaveBeenCalledWith({
        pdfProcessor: expect.any(PdfProcessorAdapter),
        wordProcessor: expect.any(WordProcessorAdapter),
        textProcessor: expect.any(TextProcessorAdapter),
      });
      expect(result).toBe(mockDocumentService);
    });

    it("should not include media processors", () => {
      DocumentServiceFactory.createTextOnly();

      expect(ImageProcessorAdapter).not.toHaveBeenCalled();
      expect(AudioProcessorAdapter).not.toHaveBeenCalled();
      expect(VideoProcessorAdapter).not.toHaveBeenCalled();
    });

    it("should instantiate text-based processor adapters", () => {
      DocumentServiceFactory.createTextOnly();

      expect(PdfProcessorAdapter).toHaveBeenCalledTimes(1);
      expect(WordProcessorAdapter).toHaveBeenCalledTimes(1);
      expect(TextProcessorAdapter).toHaveBeenCalledTimes(1);
    });
  });

  describe("createMediaOnly", () => {
    it("should create DocumentService with only media processors", () => {
      const mockDocumentService = {} as DocumentService;
      (
        DocumentService as jest.MockedClass<typeof DocumentService>
      ).mockImplementation(() => mockDocumentService);

      const result = DocumentServiceFactory.createMediaOnly();

      expect(DocumentService).toHaveBeenCalledWith({
        imageProcessor: expect.any(ImageProcessorAdapter),
        audioProcessor: expect.any(AudioProcessorAdapter),
        videoProcessor: expect.any(VideoProcessorAdapter),
      });
      expect(result).toBe(mockDocumentService);
    });

    it("should not include text-based processors", () => {
      DocumentServiceFactory.createMediaOnly();

      expect(PdfProcessorAdapter).not.toHaveBeenCalled();
      expect(WordProcessorAdapter).not.toHaveBeenCalled();
      expect(TextProcessorAdapter).not.toHaveBeenCalled();
    });

    it("should instantiate media processor adapters", () => {
      DocumentServiceFactory.createMediaOnly();

      expect(ImageProcessorAdapter).toHaveBeenCalledTimes(1);
      expect(AudioProcessorAdapter).toHaveBeenCalledTimes(1);
      expect(VideoProcessorAdapter).toHaveBeenCalledTimes(1);
    });
  });

  describe("createCustom", () => {
    it("should create DocumentService with custom configuration", () => {
      const mockDocumentService = {} as DocumentService;
      const customConfig = {
        pdfProcessor: new PdfProcessorAdapter(),
        textProcessor: new TextProcessorAdapter(),
      };
      (
        DocumentService as jest.MockedClass<typeof DocumentService>
      ).mockImplementation(() => mockDocumentService);

      const result = DocumentServiceFactory.createCustom(customConfig);

      expect(DocumentService).toHaveBeenCalledWith(customConfig);
      expect(result).toBe(mockDocumentService);
    });

    it("should handle empty configuration", () => {
      const mockDocumentService = {} as DocumentService;
      (
        DocumentService as jest.MockedClass<typeof DocumentService>
      ).mockImplementation(() => mockDocumentService);

      const result = DocumentServiceFactory.createCustom({});

      expect(DocumentService).toHaveBeenCalledWith({});
      expect(result).toBe(mockDocumentService);
    });

    it("should pass through all provided processors", () => {
      const mockDocumentService = {} as DocumentService;
      const customConfig = {
        imageProcessor: new ImageProcessorAdapter(),
        pdfProcessor: new PdfProcessorAdapter(),
        wordProcessor: new WordProcessorAdapter(),
      };
      (
        DocumentService as jest.MockedClass<typeof DocumentService>
      ).mockImplementation(() => mockDocumentService);

      DocumentServiceFactory.createCustom(customConfig);

      expect(DocumentService).toHaveBeenCalledWith({
        imageProcessor: expect.any(ImageProcessorAdapter),
        pdfProcessor: expect.any(PdfProcessorAdapter),
        wordProcessor: expect.any(WordProcessorAdapter),
      });
    });
  });

  describe("createMinimal", () => {
    it("should create DocumentService with no processors", () => {
      const mockDocumentService = {} as DocumentService;
      (
        DocumentService as jest.MockedClass<typeof DocumentService>
      ).mockImplementation(() => mockDocumentService);

      const result = DocumentServiceFactory.createMinimal();

      expect(DocumentService).toHaveBeenCalledWith(undefined);
      expect(result).toBe(mockDocumentService);
    });

    it("should not instantiate any processor adapters", () => {
      DocumentServiceFactory.createMinimal();

      expect(ImageProcessorAdapter).not.toHaveBeenCalled();
      expect(AudioProcessorAdapter).not.toHaveBeenCalled();
      expect(VideoProcessorAdapter).not.toHaveBeenCalled();
      expect(PdfProcessorAdapter).not.toHaveBeenCalled();
      expect(WordProcessorAdapter).not.toHaveBeenCalled();
      expect(TextProcessorAdapter).not.toHaveBeenCalled();
    });
  });

  describe("factory method consistency", () => {
    it("should return DocumentService instances from all factory methods", () => {
      const mockDocumentService = {} as DocumentService;
      (
        DocumentService as jest.MockedClass<typeof DocumentService>
      ).mockImplementation(() => mockDocumentService);

      const allProcessors = DocumentServiceFactory.createWithAllProcessors();
      const textOnly = DocumentServiceFactory.createTextOnly();
      const mediaOnly = DocumentServiceFactory.createMediaOnly();
      const custom = DocumentServiceFactory.createCustom({});
      const minimal = DocumentServiceFactory.createMinimal();

      expect(allProcessors).toBe(mockDocumentService);
      expect(textOnly).toBe(mockDocumentService);
      expect(mediaOnly).toBe(mockDocumentService);
      expect(custom).toBe(mockDocumentService);
      expect(minimal).toBe(mockDocumentService);
    });

    it("should call DocumentService constructor with correct parameters", () => {
      const mockDocumentService = {} as DocumentService;
      (
        DocumentService as jest.MockedClass<typeof DocumentService>
      ).mockImplementation(() => mockDocumentService);

      // Test each factory method
      DocumentServiceFactory.createWithAllProcessors();
      expect(DocumentService).toHaveBeenCalledWith(
        expect.objectContaining({
          imageProcessor: expect.any(ImageProcessorAdapter),
          audioProcessor: expect.any(AudioProcessorAdapter),
          videoProcessor: expect.any(VideoProcessorAdapter),
          pdfProcessor: expect.any(PdfProcessorAdapter),
          wordProcessor: expect.any(WordProcessorAdapter),
          textProcessor: expect.any(TextProcessorAdapter),
        })
      );

      DocumentServiceFactory.createTextOnly();
      expect(DocumentService).toHaveBeenCalledWith(
        expect.objectContaining({
          pdfProcessor: expect.any(PdfProcessorAdapter),
          wordProcessor: expect.any(WordProcessorAdapter),
          textProcessor: expect.any(TextProcessorAdapter),
        })
      );

      DocumentServiceFactory.createMediaOnly();
      expect(DocumentService).toHaveBeenCalledWith(
        expect.objectContaining({
          imageProcessor: expect.any(ImageProcessorAdapter),
          audioProcessor: expect.any(AudioProcessorAdapter),
          videoProcessor: expect.any(VideoProcessorAdapter),
        })
      );

      DocumentServiceFactory.createMinimal();
      expect(DocumentService).toHaveBeenCalledWith(undefined);
    });
  });
});

