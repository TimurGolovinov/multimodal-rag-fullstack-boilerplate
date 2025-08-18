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

      // Create context from relevant documents
      const context = this.createContext(relevantDocs);

      // Generate response using OpenAI
      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant that answers questions based on the provided documents. 
            Use only the information from the documents to answer questions. 
            If the documents don't contain relevant information, say so. 
            Always cite which document(s) you used to answer the question.
            
            Context from documents:
            ${context}`,
          },
          {
            role: "user",
            content: request.message,
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const assistantMessage =
        response.choices[0]?.message?.content ||
        "Sorry, I could not generate a response.";

      return {
        message: assistantMessage,
        sources: relevantDocs,
      };
    } catch (error) {
      console.error("Error in chat service:", error);
      throw new Error("Failed to process chat request");
    }
  }

  private createContext(documents: Document[]): string {
    if (documents.length === 0) {
      return "No relevant documents found.";
    }

    return documents
      .map(
        (doc, index) =>
          `Document ${index + 1} (${doc.filename}):\n${doc.content.substring(
            0,
            500
          )}...`
      )
      .join("\n\n");
  }
}
