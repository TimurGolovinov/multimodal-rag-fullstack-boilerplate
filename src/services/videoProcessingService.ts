import OpenAI from "openai";
import { VideoAnalysis, ProcessingProgress } from "../types";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export class VideoProcessingService {
  private openai: OpenAI;
  private readonly maxFrames = 12; // Stay well under GPT-4o's image limit
  private readonly frameInterval = 5; // Extract frame every 5 seconds
  private videoCache = new Map<string, VideoAnalysis>(); // Simple cache for processed videos
  private ffmpegPath: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Use ffmpeg-static for the path
    try {
      this.ffmpegPath = require("ffmpeg-static");
    } catch (error) {
      // Fallback to system ffmpeg
      this.ffmpegPath = "ffmpeg";
    }
  }

  async processVideo(
    videoBuffer: Buffer,
    filename: string,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<VideoAnalysis> {
    try {
      // Check cache first using filename and buffer size as simple key
      const cacheKey = `${filename}_${videoBuffer.length}`;
      if (this.videoCache.has(cacheKey)) {
        console.log(`Using cached video analysis for "${filename}"`);
        onProgress?.({
          stage: "synthesizing",
          progress: 100,
          message: "Using cached results",
        });
        return this.videoCache.get(cacheKey)!;
      }

      console.log(`Processing video "${filename}" with FFmpeg pipeline...`);

      onProgress?.({
        stage: "extracting",
        progress: 0,
        message: "Extracting key frames...",
      });

      // Create temporary directory for processing
      const tempDir = await fs.promises.mkdtemp(
        path.join(os.tmpdir(), "video-processing-")
      );
      const inputPath = path.join(tempDir, `input_${Date.now()}.mp4`);

      try {
        // Write video buffer to temporary file
        await fs.promises.writeFile(inputPath, videoBuffer);

        // Extract real frames using FFmpeg
        const frameCount = this.calculateOptimalFrameCount(videoBuffer.length);
        const frameResult = await this.extractKeyFrames(
          inputPath,
          tempDir,
          frameCount,
          onProgress
        );

        const { frames, thumbnail } = frameResult;

        onProgress?.({
          stage: "extracting",
          progress: 50,
          message: `Extracted ${frames.length} frames`,
        });

        // Process frames with GPT-4o
        onProgress?.({
          stage: "analyzing",
          progress: 60,
          message: "Analyzing frames with AI...",
        });

        let visualAnalysis;
        try {
          visualAnalysis = await this.analyzeFrames(
            frames,
            filename,
            onProgress
          );
        } catch (error) {
          console.error(
            "Frame analysis failed, continuing with audio only:",
            error
          );
          visualAnalysis = {
            summary:
              "Frame analysis failed - continuing with audio transcript only",
            keyMoments: ["Visual analysis unavailable due to processing error"],
          };
        }

        onProgress?.({
          stage: "analyzing",
          progress: 80,
          message: "Extracting audio transcript...",
        });

        // Extract and transcribe audio using real FFmpeg + Whisper
        let audioAnalysis;
        try {
          audioAnalysis = await this.extractAudioTranscript(
            inputPath,
            tempDir,
            onProgress
          );
        } catch (error) {
          console.error(
            "Audio extraction failed, continuing with visual only:",
            error
          );
          audioAnalysis = {
            transcript:
              "Audio transcript extraction failed - continuing with visual analysis only",
            duration: 0,
          };
        }

        // Combine results into unified content
        onProgress?.({
          stage: "synthesizing",
          progress: 90,
          message: "Synthesizing content...",
        });

        const combinedContent = this.synthesizeContent(
          visualAnalysis,
          audioAnalysis
        );

        onProgress?.({
          stage: "synthesizing",
          progress: 100,
          message: "Video processing completed!",
        });

        console.log(`Video processing completed for "${filename}"`);

        const result = {
          visualSummary: visualAnalysis.summary,
          audioTranscript: audioAnalysis.transcript,
          keyMoments: visualAnalysis.keyMoments,
          duration: audioAnalysis.duration || 0,
          frameCount: frames.length,
          combinedContent,
          confidence: 0.9,
          thumbnail: thumbnail ? thumbnail.toString("base64") : null,
        };

        // Cache the result
        this.videoCache.set(cacheKey, result);

        return result;
      } finally {
        // Clean up temporary files
        try {
          await fs.promises.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
          console.warn("Failed to clean up temporary directory:", error);
        }
      }
    } catch (error) {
      console.error("Error processing video:", error);
      throw new Error(
        `Failed to process video: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async extractTextFromVideo(
    videoBuffer: Buffer,
    filename: string
  ): Promise<{ content: string; thumbnail: string | null }> {
    try {
      const analysis = await this.processVideo(videoBuffer, filename);
      return {
        content: analysis.combinedContent,
        thumbnail: analysis.thumbnail || null,
      };
    } catch (error) {
      console.error("Error extracting text from video:", error);
      throw error;
    }
  }

  private calculateOptimalFrameCount(videoSize: number): number {
    // Estimate frame count based on video size
    // Larger files get more frames, but cap at maxFrames
    const estimatedDuration = Math.max(10, (videoSize / (1024 * 1024)) * 10); // Rough estimate
    const optimalFrames = Math.min(
      this.maxFrames,
      Math.max(3, Math.ceil(estimatedDuration / this.frameInterval))
    );

    console.log(
      `Estimated duration: ${estimatedDuration}s, extracting ${optimalFrames} frames`
    );
    return optimalFrames;
  }

  private async extractKeyFrames(
    inputPath: string,
    tempDir: string,
    frameCount: number,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<{ frames: Buffer[]; thumbnail: Buffer | null }> {
    try {
      console.log(
        `Extracting ${frameCount} key frames from video using FFmpeg...`
      );

      // Get video duration first
      const duration = await this.getVideoDuration(inputPath);
      const frameInterval = Math.max(1, Math.floor(duration / frameCount));

      const frames: Buffer[] = [];
      let thumbnail: Buffer | null = null;

      for (let i = 0; i < frameCount; i++) {
        const timestamp = i * frameInterval;
        const frameFileName = `frame_${i}.png`;
        const framePath = path.join(tempDir, frameFileName);

        // Extract frame at specific timestamp using FFmpeg
        await this.runFFmpeg([
          "-i",
          inputPath,
          "-ss",
          timestamp.toString(),
          "-vframes",
          "1",
          "-q:v",
          "2", // High quality
          framePath,
        ]);

        // Wait a moment for file to be written
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Check if frame file exists and read it
        if (
          await fs.promises
            .access(framePath)
            .then(() => true)
            .catch(() => false)
        ) {
          const frameData = await fs.promises.readFile(framePath);
          frames.push(frameData);

          // Use the first frame as thumbnail
          if (i === 0) {
            thumbnail = frameData;
          }

          // Update progress
          const progress = (i / frameCount) * 50; // 0-50% for frame extraction
          onProgress?.({
            stage: "extracting",
            progress,
            message: `Extracted frame ${i + 1}/${frameCount}`,
          });

          // Clean up frame file (except thumbnail)
          if (i > 0) {
            try {
              await fs.promises.unlink(framePath);
            } catch (error) {
              console.warn(`Failed to delete frame file ${framePath}:`, error);
            }
          }
        } else {
          console.warn(`Frame file ${framePath} was not created, skipping...`);
          continue;
        }
      }

      console.log(`Successfully extracted ${frames.length} frames`);
      return { frames, thumbnail };
    } catch (error) {
      console.error("Error extracting frames with FFmpeg:", error);
      throw new Error(
        `Frame extraction failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private async getVideoDuration(inputPath: string): Promise<number> {
    try {
      return new Promise((resolve, reject) => {
        const ffprobe = spawn(this.ffmpegPath.replace("ffmpeg", "ffprobe"), [
          "-v",
          "quiet",
          "-show_entries",
          "format=duration",
          "-of",
          "csv=p=0",
          inputPath,
        ]);

        let output = "";
        let errorOutput = "";

        ffprobe.stdout.on("data", (data) => {
          output += data.toString();
        });

        ffprobe.stderr.on("data", (data) => {
          errorOutput += data.toString();
        });

        ffprobe.on("close", (code) => {
          if (code === 0) {
            const duration = parseFloat(output.trim());
            if (isNaN(duration)) {
              resolve(120); // Default 2 minutes if parsing fails
            } else {
              resolve(duration);
            }
          } else {
            console.warn(
              "Could not determine video duration, using default:",
              errorOutput
            );
            resolve(120); // Default fallback
          }
        });

        ffprobe.on("error", (error) => {
          console.warn("FFprobe error, using default duration:", error);
          resolve(120);
        });
      });
    } catch (error) {
      console.warn("Could not determine video duration, using default:", error);
      return 120; // Default fallback
    }
  }

  private async runFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn(this.ffmpegPath, args);

      let errorOutput = "";

      ffmpeg.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg failed with code ${code}: ${errorOutput}`));
        }
      });

      ffmpeg.on("error", (error) => {
        reject(new Error(`FFmpeg error: ${error.message}`));
      });
    });
  }

  private async analyzeFrames(
    frames: Buffer[],
    filename: string,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<{
    summary: string;
    keyMoments: string[];
  }> {
    try {
      console.log(`Analyzing ${frames.length} frames with GPT-4o...`);

      // Process frames in batches to stay under API limits
      const batchSize = 10; // GPT-4o limit
      const batches = this.chunkArray(frames, batchSize);

      let allKeyMoments: string[] = [];
      let frameDescriptions: string[] = [];

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(
          `Processing batch ${i + 1}/${batches.length} (${batch.length} frames)`
        );

        const batchAnalysis = await this.analyzeFrameBatch(batch, filename, i);
        allKeyMoments.push(...batchAnalysis.keyMoments);
        frameDescriptions.push(...batchAnalysis.descriptions);

        // Update progress for each batch
        const batchProgress = 60 + ((i + 1) / batches.length) * 20; // 60% to 80%
        onProgress?.({
          stage: "analyzing",
          progress: batchProgress,
          message: `Analyzed batch ${i + 1}/${batches.length}`,
        });
      }

      // Generate summary from all frame descriptions
      const summary = await this.generateVideoSummary(
        frameDescriptions,
        filename
      );

      return {
        summary,
        keyMoments: allKeyMoments,
      };
    } catch (error) {
      console.error("Error analyzing frames:", error);
      throw error;
    }
  }

  private async analyzeFrameBatch(
    frames: Buffer[],
    filename: string,
    batchIndex: number
  ): Promise<{
    keyMoments: string[];
    descriptions: string[];
  }> {
    try {
      const base64Frames = frames.map((frame) => frame.toString("base64"));
      const imageFormat = this.getVideoImageFormat(filename);

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze these video frames (batch ${
                  batchIndex + 1
                }) and provide:
1. A brief description of what you see in each frame
2. Any key moments, actions, or important visual elements
3. Text, charts, or data visible in the frames
4. Overall scene context and progression

Be concise but thorough. Focus on content that would be useful for search and retrieval.`,
              },
              ...base64Frames.map((frame) => ({
                type: "image_url" as const,
                image_url: {
                  url: `data:image/${imageFormat};base64,${frame}`,
                },
              })),
            ],
          },
        ],
        max_tokens: 800,
      });

      const analysis = response.choices[0]?.message?.content || "";

      // Parse the response to extract key moments and descriptions
      const parsed = this.parseFrameAnalysis(analysis);

      return {
        keyMoments: parsed.keyMoments,
        descriptions: parsed.descriptions,
      };
    } catch (error) {
      console.error(`Error analyzing frame batch ${batchIndex + 1}:`, error);
      throw error;
    }
  }

  private async generateVideoSummary(
    frameDescriptions: string[],
    filename: string
  ): Promise<string> {
    try {
      const combinedDescriptions = frameDescriptions.join("\n\n");

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: `Based on these video frame descriptions, provide a comprehensive summary of the video content:

${combinedDescriptions}

Please create a coherent summary that:
1. Describes the main content and flow of the video
2. Highlights key visual elements and moments
3. Identifies any recurring themes or important information
4. Is optimized for search and retrieval

Keep it under 300 words but be thorough.`,
          },
        ],
        max_tokens: 400,
      });

      return (
        response.choices[0]?.message?.content ||
        "Video content analysis completed."
      );
    } catch (error) {
      console.error("Error generating video summary:", error);
      return "Video content analysis completed with limited summary.";
    }
  }

  private async extractAudioTranscript(
    inputPath: string,
    tempDir: string,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<{
    transcript: string;
    duration?: number;
  }> {
    try {
      console.log(`Extracting audio from video using FFmpeg...`);

      const audioFileName = `audio_${Date.now()}.wav`;
      const audioPath = path.join(tempDir, audioFileName);

      // Extract audio track from video
      await this.runFFmpeg([
        "-i",
        inputPath,
        "-vn", // No video
        "-acodec",
        "pcm_s16le", // PCM 16-bit
        "-ar",
        "16000", // 16kHz sample rate (optimal for Whisper)
        "-ac",
        "1", // Mono
        audioPath,
      ]);

      // Read the extracted audio
      const audioData = await fs.promises.readFile(audioPath);
      const audioBuffer = Buffer.from(audioData);

      // Clean up audio file
      try {
        await fs.promises.unlink(audioPath);
      } catch (error) {
        console.warn(`Failed to delete audio file ${audioPath}:`, error);
      }

      onProgress?.({
        stage: "analyzing",
        progress: 85,
        message: "Transcribing audio with Whisper...",
      });

      // Transcribe using OpenAI Whisper API
      const transcript = await this.transcribeAudioWithWhisper(
        audioBuffer,
        path.basename(inputPath)
      );

      // Estimate duration (simplified - in production you might want more accurate detection)
      const duration = this.estimateAudioDuration(audioBuffer.length);

      return {
        transcript,
        duration,
      };
    } catch (error) {
      console.error("Error extracting audio transcript:", error);
      throw new Error(
        `Audio extraction failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private async transcribeAudioWithWhisper(
    audioBuffer: Buffer,
    filename: string
  ): Promise<string> {
    try {
      // Create a file-like object for OpenAI API
      const file = new File([audioBuffer], filename, {
        type: "audio/wav",
      });

      const response = await this.openai.audio.transcriptions.create({
        file: file as any, // OpenAI types expect File but we can pass Buffer
        model: "whisper-1",
        response_format: "verbose_json",
        language: "en", // You can make this configurable
      });

      return response.text;
    } catch (error) {
      console.error("Error transcribing audio with Whisper:", error);
      throw new Error(
        `Whisper transcription failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private estimateAudioDuration(audioBufferSize: number): number {
    // Rough estimation: 16-bit mono at 16kHz = 32 bytes per second
    const bytesPerSecond = 16000 * 2; // 16kHz * 2 bytes (16-bit)
    return Math.round(audioBufferSize / bytesPerSecond);
  }

  private synthesizeContent(
    visualAnalysis: { summary: string; keyMoments: string[] },
    audioAnalysis: { transcript: string; duration?: number }
  ): string {
    const duration = audioAnalysis.duration || 0;
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    const timeString =
      duration > 0
        ? `${minutes}:${seconds.toString().padStart(2, "0")}`
        : "Unknown";

    return `VIDEO CONTENT ANALYSIS

Visual Summary:
${visualAnalysis.summary}

Key Visual Moments:
${visualAnalysis.keyMoments
  .map((moment, i) => `${i + 1}. ${moment}`)
  .join("\n")}

Audio Transcript:
${audioAnalysis.transcript}

Video Metadata:
Duration: ${timeString} | Frames Analyzed: ${visualAnalysis.keyMoments.length}

This content has been processed using AI-powered video analysis combining real frame extraction with GPT-4o visual analysis and Whisper audio transcription for comprehensive searchability.`;
  }

  private parseFrameAnalysis(analysis: string): {
    keyMoments: string[];
    descriptions: string[];
  } {
    // Simple parsing - in production, you might want more sophisticated parsing
    const lines = analysis.split("\n");
    const keyMoments: string[] = [];
    const descriptions: string[] = [];

    let currentSection = "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (
        trimmed.toLowerCase().includes("key moment") ||
        trimmed.toLowerCase().includes("important")
      ) {
        currentSection = "keyMoments";
        const moment = trimmed.replace(/^[^:]*:\s*/, "").trim();
        if (moment) keyMoments.push(moment);
      } else if (
        trimmed.toLowerCase().includes("frame") ||
        trimmed.toLowerCase().includes("scene")
      ) {
        currentSection = "descriptions";
        descriptions.push(trimmed);
      } else if (currentSection === "keyMoments" && trimmed.length > 10) {
        keyMoments.push(trimmed);
      } else if (currentSection === "descriptions" && trimmed.length > 10) {
        descriptions.push(trimmed);
      }
    }

    // If parsing failed, use the whole analysis
    if (keyMoments.length === 0 && descriptions.length === 0) {
      descriptions.push(analysis);
    }

    return { keyMoments, descriptions };
  }

  private getVideoImageFormat(filename: string): string {
    // For extracted frames, we'll use PNG as default
    return "png";
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  isVideoFile(filename: string): boolean {
    const ext = filename.split(".").pop()?.toLowerCase();
    return [
      "mp4",
      "mov",
      "avi",
      "webm",
      "mkv",
      "flv",
      "wmv",
      "m4v",
      "3gp",
      "ogv",
    ].includes(ext || "");
  }
}
