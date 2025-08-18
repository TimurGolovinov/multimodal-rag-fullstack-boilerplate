import { DocumentChunk, ChunkingConfig } from "../types";
import { v4 as uuidv4 } from "uuid";

export class DocumentChunkingService {
  private defaultConfig: ChunkingConfig = {
    maxChunkSize: 1000, // Maximum characters per chunk
    overlapSize: 200, // Overlap between chunks for context continuity
    separator: "\n\n", // Natural separator for chunks
    minChunkSize: 100, // Minimum chunk size to avoid tiny fragments
  };

  constructor(config?: Partial<ChunkingConfig>) {
    if (config) {
      this.defaultConfig = { ...this.defaultConfig, ...config };
    }
  }

  /**
   * Chunk a document into smaller pieces for better vector search
   */
  chunkDocument(
    documentId: string,
    content: string,
    metadata: Record<string, any>,
    config?: Partial<ChunkingConfig>
  ): DocumentChunk[] {
    const chunkingConfig = config
      ? { ...this.defaultConfig, ...config }
      : this.defaultConfig;
    const chunks: DocumentChunk[] = [];

    // Handle different content types
    if (this.isStructuredContent(content)) {
      chunks.push(
        ...this.chunkStructuredContent(
          documentId,
          content,
          metadata,
          chunkingConfig
        )
      );
    } else {
      chunks.push(
        ...this.chunkUnstructuredContent(
          documentId,
          content,
          metadata,
          chunkingConfig
        )
      );
    }

    return chunks;
  }

  /**
   * Chunk structured content (like paragraphs, sections)
   */
  private chunkStructuredContent(
    documentId: string,
    content: string,
    metadata: Record<string, any>,
    config: ChunkingConfig
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const paragraphs = content
      .split(config.separator)
      .filter((p) => p.trim().length > 0);

    let currentChunk = "";
    let chunkIndex = 0;
    let startChar = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      const potentialChunk =
        currentChunk + (currentChunk ? config.separator : "") + paragraph;

      if (
        potentialChunk.length > config.maxChunkSize &&
        currentChunk.length >= config.minChunkSize
      ) {
        // Create chunk and start new one
        chunks.push(
          this.createChunk(
            documentId,
            currentChunk.trim(),
            chunkIndex,
            startChar,
            startChar + currentChunk.length,
            metadata
          )
        );

        // Start new chunk with overlap
        const overlapStart = Math.max(
          0,
          currentChunk.length - config.overlapSize
        );
        const overlapText = currentChunk.slice(overlapStart);
        currentChunk = overlapText + config.separator + paragraph;
        startChar = startChar + overlapStart;
        chunkIndex++;
      } else {
        currentChunk = potentialChunk;
      }
    }

    // Add the last chunk if it has content
    if (currentChunk.trim().length >= config.minChunkSize) {
      chunks.push(
        this.createChunk(
          documentId,
          currentChunk.trim(),
          chunkIndex,
          startChar,
          startChar + currentChunk.length,
          metadata
        )
      );
    }

    return chunks;
  }

  /**
   * Chunk unstructured content (like continuous text)
   */
  private chunkUnstructuredContent(
    documentId: string,
    content: string,
    metadata: Record<string, any>,
    config: ChunkingConfig
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    let chunkIndex = 0;
    let startChar = 0;

    while (startChar < content.length) {
      const endChar = Math.min(startChar + config.maxChunkSize, content.length);
      let chunkContent = content.slice(startChar, endChar);

      // Try to find a better break point near the end
      if (endChar < content.length) {
        const betterBreakPoint = this.findBetterBreakPoint(
          content,
          endChar,
          config.maxChunkSize,
          config.overlapSize
        );

        if (betterBreakPoint > startChar + config.minChunkSize) {
          chunkContent = content.slice(startChar, betterBreakPoint);
          startChar = betterBreakPoint - config.overlapSize;
        } else {
          startChar = endChar - config.overlapSize;
        }
      } else {
        startChar = endChar;
      }

      if (chunkContent.trim().length >= config.minChunkSize) {
        chunks.push(
          this.createChunk(
            documentId,
            chunkContent.trim(),
            chunkIndex,
            startChar,
            startChar + chunkContent.length,
            metadata
          )
        );
        chunkIndex++;
      }
    }

    return chunks;
  }

  /**
   * Find a better break point for chunking (sentence or word boundary)
   */
  private findBetterBreakPoint(
    content: string,
    targetPosition: number,
    maxChunkSize: number,
    overlapSize: number
  ): number {
    const searchStart = Math.max(
      targetPosition - overlapSize,
      targetPosition - maxChunkSize / 2
    );
    const searchEnd = Math.min(targetPosition + overlapSize, content.length);

    // Look for sentence endings first
    for (let i = targetPosition; i >= searchStart; i--) {
      if (content[i] === "." || content[i] === "!" || content[i] === "?") {
        if (
          i + 1 < content.length &&
          (content[i + 1] === " " || content[i + 1] === "\n")
        ) {
          return i + 1;
        }
      }
    }

    // Look for paragraph breaks
    for (let i = targetPosition; i >= searchStart; i--) {
      if (content[i] === "\n" && (i === 0 || content[i - 1] === "\n")) {
        return i;
      }
    }

    // Look for word boundaries
    for (let i = targetPosition; i >= searchStart; i--) {
      if (content[i] === " ") {
        return i;
      }
    }

    return targetPosition;
  }

  /**
   * Check if content has natural structure (paragraphs, sections)
   */
  private isStructuredContent(content: string): boolean {
    const paragraphBreaks = (content.match(/\n\s*\n/g) || []).length;
    const totalLength = content.length;

    // If there are many paragraph breaks relative to content length, consider it structured
    return paragraphBreaks > 0 && (paragraphBreaks / totalLength) * 1000 > 5;
  }

  /**
   * Create a document chunk with proper metadata
   */
  private createChunk(
    documentId: string,
    content: string,
    chunkIndex: number,
    startChar: number,
    endChar: number,
    metadata: Record<string, any>
  ): DocumentChunk {
    return {
      id: uuidv4(),
      documentId,
      content,
      chunkIndex,
      startChar,
      endChar,
      metadata: {
        ...metadata,
        chunkIndex,
        startChar,
        endChar,
        chunkSize: content.length,
      },
    };
  }

  /**
   * Get chunking statistics for a document
   */
  getChunkingStats(chunks: DocumentChunk[]): {
    totalChunks: number;
    averageChunkSize: number;
    totalContentLength: number;
    chunkSizeDistribution: Record<string, number>;
  } {
    if (chunks.length === 0) {
      return {
        totalChunks: 0,
        averageChunkSize: 0,
        totalContentLength: 0,
        chunkSizeDistribution: {},
      };
    }

    const totalContentLength = chunks.reduce(
      (sum, chunk) => sum + chunk.content.length,
      0
    );
    const averageChunkSize = totalContentLength / chunks.length;

    // Analyze chunk size distribution
    const sizeRanges = {
      small: 0, // < 500 chars
      medium: 0, // 500-1000 chars
      large: 0, // 1000-1500 chars
      xlarge: 0, // > 1500 chars
    };

    chunks.forEach((chunk) => {
      if (chunk.content.length < 500) sizeRanges.small++;
      else if (chunk.content.length < 1000) sizeRanges.medium++;
      else if (chunk.content.length < 1500) sizeRanges.large++;
      else sizeRanges.xlarge++;
    });

    return {
      totalChunks: chunks.length,
      averageChunkSize: Math.round(averageChunkSize),
      totalContentLength,
      chunkSizeDistribution: sizeRanges,
    };
  }

  /**
   * Merge overlapping chunks if they're too small
   */
  mergeSmallChunks(
    chunks: DocumentChunk[],
    minSize: number = 100
  ): DocumentChunk[] {
    if (chunks.length <= 1) return chunks;

    const merged: DocumentChunk[] = [];
    let currentChunk = { ...chunks[0] };

    for (let i = 1; i < chunks.length; i++) {
      const nextChunk = chunks[i];

      if (
        currentChunk.content.length < minSize &&
        nextChunk.chunkIndex === currentChunk.chunkIndex + 1
      ) {
        // Merge chunks
        currentChunk.content += "\n\n" + nextChunk.content;
        currentChunk.endChar = nextChunk.endChar;
        currentChunk.metadata = {
          ...currentChunk.metadata,
          endChar: nextChunk.endChar,
          chunkSize: currentChunk.content.length,
          merged: true,
        };
      } else {
        // Add current chunk and start new one
        if (currentChunk.content.length >= minSize) {
          merged.push(currentChunk);
        }
        currentChunk = { ...nextChunk };
      }
    }

    // Add the last chunk
    if (currentChunk.content.length >= minSize) {
      merged.push(currentChunk);
    }

    return merged;
  }
}
