import * as fs from "fs";
import * as path from "path";
import { Document } from "../types";

export class DocumentPersistence {
  private readonly dataPath: string;
  private readonly documentsFile: string;

  constructor() {
    this.dataPath = path.resolve(process.cwd(), "data");
    this.documentsFile = path.join(this.dataPath, "documents.json");
    this.ensureDataDirectory();
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
      console.log(`Created data directory: ${this.dataPath}`);
    }
  }

  saveDocuments(documents: Map<string, Document>): void {
    try {
      const documentsArray = Array.from(documents.values());
      const data = JSON.stringify(documentsArray, null, 2);
      fs.writeFileSync(this.documentsFile, data, "utf-8");
      console.log(`Saved ${documentsArray.length} documents to disk`);
    } catch (error) {
      console.error("Failed to save documents to disk:", error);
    }
  }

  loadDocuments(): Map<string, Document> {
    try {
      if (!fs.existsSync(this.documentsFile)) {
        console.log("No existing documents found on disk");
        return new Map();
      }

      const data = fs.readFileSync(this.documentsFile, "utf-8");
      const documentsArray = JSON.parse(data) as Document[];

      // Convert dates back to Date objects
      const documents = new Map<string, Document>();
      documentsArray.forEach((doc) => {
        doc.uploadedAt = new Date(doc.uploadedAt);
        documents.set(doc.id, doc);
      });

      console.log(`Loaded ${documentsArray.length} documents from disk`);
      return documents;
    } catch (error) {
      console.error("Failed to load documents from disk:", error);
      return new Map();
    }
  }
}
