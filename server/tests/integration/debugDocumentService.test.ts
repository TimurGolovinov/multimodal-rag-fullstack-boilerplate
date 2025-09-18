import { DocumentServiceFactory } from "../../src/services/documentServiceFactory";

describe("Debug DocumentService", () => {
  it("should create DocumentService without errors", () => {
    console.log("About to create DocumentService...");

    try {
      const documentService = DocumentServiceFactory.createWithAllProcessors();
      console.log("DocumentService created successfully");
      console.log(
        "Processors count:",
        (documentService as any).processors.length
      );

      expect(documentService).toBeDefined();
      expect((documentService as any).processors.length).toBeGreaterThan(0);
    } catch (error) {
      console.error("Error creating DocumentService:", error);
      throw error;
    }
  });

  it("should have required methods", () => {
    const documentService = DocumentServiceFactory.createWithAllProcessors();

    expect(typeof (documentService as any).extractText).toBe("function");
    expect(typeof (documentService as any).findProcessor).toBe("function");
    expect(typeof (documentService as any).getDocumentType).toBe("function");
    expect(typeof (documentService as any).isBinaryFileType).toBe("function");
  });
});
