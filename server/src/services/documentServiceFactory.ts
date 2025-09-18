import { DocumentService, DocumentServiceConfig } from "./documentService";
import {
  ImageProcessorAdapter,
  AudioProcessorAdapter,
  PdfProcessorAdapter,
  WordProcessorAdapter,
  TextProcessorAdapter,
} from "./processors";

export class DocumentServiceFactory {
  /**
   * Creates a DocumentService with all processors enabled
   */
  static createWithAllProcessors(): DocumentService {
    return new DocumentService({
      imageProcessor: new ImageProcessorAdapter(),
      audioProcessor: new AudioProcessorAdapter(),
      pdfProcessor: new PdfProcessorAdapter(),
      wordProcessor: new WordProcessorAdapter(),
      textProcessor: new TextProcessorAdapter(),
    });
  }

  /**
   * Creates a DocumentService with only text-based processors (PDF, Word)
   */
  static createTextOnly(): DocumentService {
    return new DocumentService({
      pdfProcessor: new PdfProcessorAdapter(),
      wordProcessor: new WordProcessorAdapter(),
      textProcessor: new TextProcessorAdapter(),
    });
  }

  /**
   * Creates a DocumentService with only media processors (Image, Audio)
   */
  static createMediaOnly(): DocumentService {
    return new DocumentService({
      imageProcessor: new ImageProcessorAdapter(),
      audioProcessor: new AudioProcessorAdapter(),
    });
  }

  /**
   * Creates a DocumentService with custom processor configuration
   */
  static createCustom(config: DocumentServiceConfig): DocumentService {
    return new DocumentService(config);
  }

  /**
   * Creates a DocumentService with no processors (text files only)
   */
  static createMinimal(): DocumentService {
    return new DocumentService();
  }
}
