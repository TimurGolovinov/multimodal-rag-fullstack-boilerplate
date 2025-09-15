import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export interface StreamingChunk {
  type: "chunk" | "complete" | "error";
  content?: string;
  timestamp: string;
  error?: string;
}

export class OpenAIStreamingService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Stream chat completion with OpenAI API
   */
  async streamChatCompletion(
    messages: ChatCompletionMessageParam[],
    onChunk: (chunk: StreamingChunk) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      const stream = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        stream: true,
        max_completion_tokens: 2000,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          onChunk({
            type: "chunk",
            content,
            timestamp: new Date().toISOString(),
          });
        }
      }

      onComplete();
    } catch (error) {
      onError(
        error instanceof Error ? error : new Error("Unknown streaming error")
      );
    }
  }

  /**
   * Stream chat completion with document context
   */
  async streamChatWithContext(
    userMessage: string,
    context: string,
    onChunk: (chunk: StreamingChunk) => void,
    onComplete: (fullContent: string) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    const systemPrompt = `You are a helpful AI assistant. Use the following context to answer questions accurately and comprehensively. If the context doesn't contain relevant information, say so clearly.

Context:
${context}

Please provide a helpful response based on the context above.`;

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    let fullContent = "";

    await this.streamChatCompletion(
      messages,
      (chunk) => {
        if (chunk.content) {
          fullContent += chunk.content;
          onChunk(chunk);
        }
      },
      () => {
        onComplete(fullContent);
      },
      onError
    );
  }
}
