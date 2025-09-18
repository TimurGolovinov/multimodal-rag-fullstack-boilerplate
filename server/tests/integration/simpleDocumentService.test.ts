import { DocumentService } from "../../src/services/documentService";
import { DocumentServiceFactory } from "../../src/services/documentServiceFactory";

// Mock external dependencies
jest.mock("../../src/database/services/documentService");
jest.mock("../../src/services/storageFactory");
jest.mock("../../src/services/openaiVectorStore");

describe("Simple DocumentService Test", () => {
  let documentService: DocumentService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create DocumentService with all processors
    documentService = DocumentServiceFactory.createWithAllProcessors();

    console.log("DocumentService created");
    console.log(
      "Processors count:",
      (documentService as any).processors.length
    );
    console.log(
      "Processors:",
      (documentService as any).processors.map((p: any) => p.constructor.name)
    );
  });

  it("should create DocumentService with processors", () => {
    expect(documentService).toBeDefined();
    expect((documentService as any).processors.length).toBeGreaterThan(0);
  });

  it("should have text processor", () => {
    const textProcessor = (documentService as any).processors.find(
      (p: any) => p.constructor.name === "TextProcessorAdapter"
    );
    expect(textProcessor).toBeDefined();
  });

  it("should have PDF processor", () => {
    const pdfProcessor = (documentService as any).processors.find(
      (p: any) => p.constructor.name === "PdfProcessorAdapter"
    );
    expect(pdfProcessor).toBeDefined();
  });

  it("should find processor for text file", () => {
    const findProcessor = (documentService as any).findProcessor.bind(
      documentService
    );
    const processor = findProcessor("text/plain", "test.txt");
    expect(processor).toBeDefined();
    expect(processor.constructor.name).toBe("TextProcessorAdapter");
  });

  it("should find processor for PDF file", () => {
    const findProcessor = (documentService as any).findProcessor.bind(
      documentService
    );
    const processor = findProcessor("application/pdf", "test.pdf");
    expect(processor).toBeDefined();
    expect(processor.constructor.name).toBe("PdfProcessorAdapter");
  });

  it("should extract text from text file", async () => {
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

    const extractText = (documentService as any).extractText.bind(
      documentService
    );
    const content = await extractText(textFile);

    console.log("Extracted content:", content);
    expect(content).toBe("This is test content");
  });

  it("should determine document type correctly", () => {
    const getDocumentType = (documentService as any).getDocumentType.bind(
      documentService
    );

    expect(getDocumentType("text/plain", "test.txt")).toBe("text");
    expect(getDocumentType("application/pdf", "test.pdf")).toBe("pdf");
    expect(getDocumentType("image/jpeg", "test.jpg")).toBe("image");
  });

  it("should determine binary file type correctly", () => {
    const isBinaryFileType = (documentService as any).isBinaryFileType.bind(
      documentService
    );

    expect(isBinaryFileType("text", "text/plain")).toBe(false);
    expect(isBinaryFileType("pdf", "application/pdf")).toBe(true);
    expect(isBinaryFileType("image", "image/jpeg")).toBe(true);
  });
});
