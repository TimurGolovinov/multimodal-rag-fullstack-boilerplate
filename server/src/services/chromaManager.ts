import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";

export class ChromaManager {
  private chromaProcess: ChildProcess | null = null;
  private isRunning: boolean = false;
  private readonly port: number = 8000;
  private readonly dataPath: string;

  constructor() {
    this.dataPath = path.resolve(process.cwd(), "chroma_db");
  }

  async ensureChromaRunning(): Promise<boolean> {
    if (this.isRunning) {
      return true;
    }

    // Check if ChromaDB is already running
    if (await this.isChromaHealthy()) {
      console.log("ChromaDB is already running and healthy");
      this.isRunning = true;
      return true;
    }

    // Start ChromaDB server
    return await this.startChromaServer();
  }

  private async isChromaHealthy(): Promise<boolean> {
    try {
      const response = await fetch(
        `http://localhost:${this.port}/api/v2/heartbeat`
      );
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  private async startChromaServer(): Promise<boolean> {
    try {
      console.log("Starting ChromaDB server...");

      // Ensure data directory exists
      if (!fs.existsSync(this.dataPath)) {
        fs.mkdirSync(this.dataPath, { recursive: true });
        console.log(`Created ChromaDB data directory: ${this.dataPath}`);
      }

      // Start ChromaDB server
      this.chromaProcess = spawn(
        "npx",
        [
          "chromadb",
          "run",
          "--path",
          this.dataPath,
          "--port",
          this.port.toString(),
        ],
        {
          stdio: "pipe",
          detached: false,
        }
      );

      // Wait for server to start
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds timeout

      while (attempts < maxAttempts) {
        if (await this.isChromaHealthy()) {
          console.log("ChromaDB server started successfully");
          this.isRunning = true;
          return true;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;

        if (attempts % 5 === 0) {
          console.log(`Waiting for ChromaDB server... (${attempts}s)`);
        }
      }

      console.error("ChromaDB server failed to start within timeout");
      return false;
    } catch (error) {
      console.error("Failed to start ChromaDB server:", error);
      return false;
    }
  }

  async stopChromaServer(): Promise<void> {
    if (this.chromaProcess) {
      console.log("Stopping ChromaDB server...");
      this.chromaProcess.kill();
      this.chromaProcess = null;
      this.isRunning = false;
    }
  }

  getChromaUrl(): string {
    return `http://localhost:${this.port}`;
  }

  isChromaRunning(): boolean {
    return this.isRunning;
  }
}
