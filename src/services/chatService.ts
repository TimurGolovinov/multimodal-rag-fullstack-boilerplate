import { ChatRequest, ChatResponse, Document } from "../types";
import { DocumentService } from "./documentService";
import OpenAI from "openai";

export class ChatService {
  private openai: OpenAI;
  private documentService: DocumentService;

  constructor(documentService: DocumentService) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.documentService = documentService;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      // Search for relevant documents
      const relevantDocs = await this.documentService.searchDocuments(
        request.message,
        3
      );
      console.log("Relevant docs", relevantDocs);

      // Format results and create context
      const formattedResults = this.formatResults(relevantDocs);
      const textSources = this.createContext(relevantDocs);
      console.log("Formatted results", formattedResults);
      console.log("Text sources", textSources);

      // Generate response using OpenAI
      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "Produce a concise answer to the query based on the provided sources.",
          },
          {
            role: "user",
            content: `Sources: ${formattedResults}\n\nQuery: '${request.message}'`,
          },
        ],
      });

      const assistantMessage =
        response.choices[0]?.message?.content ||
        "Sorry, I could not generate a response.";

      console.log("Completion response:", assistantMessage);

      return {
        message: assistantMessage,
        sources: relevantDocs,
      };
    } catch (error) {
      console.error("Error in chat service:", error);
      throw new Error("Failed to process chat request");
    }
  }

  private formatResults(documents: Document[]): string {
    if (documents.length === 0) {
      return "No relevant documents found.";
    }

    return documents
      .map(
        (doc, index) =>
          `Document ${index + 1} (${doc.filename}):\n${doc.content}`
      )
      .join("\n\n");
  }

  private createContext(documents: Document[]): string {
    if (documents.length === 0) {
      return "No relevant documents found.";
    }

    // Join the text content of all results
    const textSources = documents.map((doc) => doc.content).join("\n");

    return textSources;
  }
}
