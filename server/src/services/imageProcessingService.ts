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
        model: "gpt-5-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this image comprehensively and provide a detailed description that includes:
1. What you see in the image (objects, people, scenes, etc.)
2. Any text, numbers, or symbols visible in the image
3. If this is a document, chart, or diagram, extract all relevant information
4. Colors, layout, and visual composition
5. Any business-relevant details (logos, brands, products, etc.)

Provide a thorough, searchable description that captures all the important visual information.`,
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
      });

      const analysis = response.choices[0]?.message?.content || "";

      // Parse the response to extract structured information
      const result = this.parseAnalysisResponse(analysis);

      return {
        description: result.description,
        extractedText: result.extractedText,
        chartData: result.chartData,
        confidence: 0.9,
      };
    } catch (error) {
      console.error("Error analyzing image:", error);
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

  /**
   * Get a comprehensive text representation of the image for vector storage
   */
  async getImageTextRepresentation(
    imageBuffer: Buffer,
    filename: string
  ): Promise<string> {
    try {
      const analysis = await this.analyzeImage(imageBuffer, filename);

      // Create a comprehensive text representation
      let textRepresentation = `Image Analysis for ${filename}:\n\n`;
      textRepresentation += `Description: ${analysis.description}\n\n`;

      if (analysis.extractedText) {
        textRepresentation += `Extracted Text: ${analysis.extractedText}\n\n`;
      }

      if (analysis.chartData) {
        textRepresentation += `Chart/Data Information: ${JSON.stringify(
          analysis.chartData,
          null,
          2
        )}\n\n`;
      }

      textRepresentation += `Analysis Confidence: ${analysis.confidence}`;

      return textRepresentation;
    } catch (error) {
      console.error("Error getting image text representation:", error);
      // Fallback to basic filename description
      return `Image file: ${filename} - Unable to analyze content`;
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
