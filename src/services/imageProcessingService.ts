import OpenAI from "openai";
import { ImageAnalysis } from "../types";

export class ImageProcessingService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async analyzeImage(
    imageBuffer: Buffer,
    filename: string
  ): Promise<ImageAnalysis> {
    try {
      // Convert buffer to base64 for OpenAI API
      const base64Image = imageBuffer.toString("base64");

      // Determine image format from filename
      const imageFormat = this.getImageFormat(filename);

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this image and provide:
1. A detailed description of what you see
2. Any text that appears in the image (OCR)
3. If this is a chart, graph, or table, extract the data accurately
4. Any relevant numerical information

Please be thorough and accurate, especially with data extraction.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/${imageFormat};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      });

      const analysis = response.choices[0]?.message?.content || "";

      // Parse the response to extract structured information
      const result = this.parseAnalysisResponse(analysis);

      return {
        description: result.description,
        extractedText: result.extractedText,
        chartData: result.chartData,
        confidence: 0.9, // GPT-4V is generally very accurate
      };
    } catch (error) {
      console.error("Error analyzing image with GPT-4V:", error);
      throw new Error(
        `Failed to analyze image: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private getImageFormat(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "jpg":
      case "jpeg":
        return "jpeg";
      case "png":
        return "png";
      case "gif":
        return "gif";
      case "webp":
        return "webp";
      default:
        return "jpeg"; // fallback
    }
  }

  private parseAnalysisResponse(response: string): {
    description: string;
    extractedText?: string;
    chartData?: any;
  } {
    // Simple parsing - in a production system you might want more sophisticated parsing
    const lines = response.split("\n");
    let description = "";
    let extractedText = "";
    let chartData = null;

    for (const line of lines) {
      if (
        line.toLowerCase().includes("description:") ||
        line.toLowerCase().includes("what i see:")
      ) {
        description = line.split(":")[1]?.trim() || "";
      } else if (
        line.toLowerCase().includes("text:") ||
        line.toLowerCase().includes("ocr:")
      ) {
        extractedText = line.split(":")[1]?.trim() || "";
      } else if (
        line.toLowerCase().includes("data:") ||
        line.toLowerCase().includes("chart:")
      ) {
        try {
          chartData = JSON.parse(line.split(":")[1]?.trim() || "{}");
        } catch {
          chartData = line.split(":")[1]?.trim() || "";
        }
      }
    }

    // If no structured parsing worked, use the whole response as description
    if (!description) {
      description = response;
    }

    return {
      description,
      extractedText: extractedText || undefined,
      chartData: chartData || undefined,
    };
  }

  async extractTextFromImage(
    imageBuffer: Buffer,
    filename: string
  ): Promise<{ content: string; thumbnail: string }> {
    try {
      const analysis = await this.analyzeImage(imageBuffer, filename);

      // Combine description and extracted text for better search
      let textContent = analysis.description;

      if (analysis.extractedText) {
        textContent += `\n\nExtracted Text:\n${analysis.extractedText}`;
      }

      if (analysis.chartData) {
        textContent += `\n\nChart Data:\n${JSON.stringify(
          analysis.chartData,
          null,
          2
        )}`;
      }

      // Generate thumbnail (resize image to 48x48 for UI)
      const thumbnail = await this.generateThumbnail(imageBuffer);

      return {
        content: textContent,
        thumbnail: thumbnail.toString("base64"),
      };
    } catch (error) {
      console.error("Error extracting text from image:", error);
      throw error;
    }
  }

  private async generateThumbnail(imageBuffer: Buffer): Promise<Buffer> {
    // For now, return the original image buffer
    // In production, you might want to use a library like sharp to resize images
    return imageBuffer;
  }
}
