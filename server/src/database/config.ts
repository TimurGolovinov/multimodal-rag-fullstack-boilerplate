import { Pool, PoolConfig, PoolClient } from "pg";
import dotenv from "dotenv";

dotenv.config();

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  maxConnections: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool: Pool;
  private isConnected: boolean = false;

  private constructor() {
    const config: DatabaseConfig = {
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME || "rag_app",
      user: process.env.DB_USER || "rag_user",
      password: process.env.DB_PASSWORD || "",
      ssl: process.env.DB_SSL === "true",
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || "20"),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || "30000"),
      connectionTimeoutMillis: parseInt(
        process.env.DB_CONNECTION_TIMEOUT || "2000"
      ),
    };

    const poolConfig: PoolConfig = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: config.maxConnections,
      idleTimeoutMillis: config.idleTimeoutMillis,
      connectionTimeoutMillis: config.connectionTimeoutMillis,

      // Error handling
      allowExitOnIdle: false,

      // Logging
      log: (msg: string, level: string) => {
        if (level === "error") {
          console.error(`[DB] ${msg}`);
        } else if (level === "warn") {
          console.warn(`[DB] ${msg}`);
        } else {
          console.log(`[DB] ${msg}`);
        }
      },
    };

    this.pool = new Pool(poolConfig);

    // Handle pool errors
    this.pool.on("error", (err: Error, client: PoolClient) => {
      console.error("Unexpected error on idle client", err);
      this.isConnected = false;
    });

    // Handle pool connection
    this.pool.on("connect", (client: PoolClient) => {
      console.log("New client connected to database");
    });

    // Handle pool removal
    this.pool.on("remove", (client: PoolClient) => {
      console.log("Client removed from pool");
    });
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public async connect(): Promise<void> {
    try {
      // Test connection
      const client = await this.pool.connect();
      await client.query("SELECT NOW()");
      client.release();

      this.isConnected = true;
      console.log("✅ Database connected successfully");

      // Test schema
      await this.testSchema();
    } catch (error) {
      this.isConnected = false;
      console.error("❌ Database connection failed:", error);
      throw new Error(
        `Database connection failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      console.log("✅ Database disconnected successfully");
    } catch (error) {
      console.error("❌ Database disconnection failed:", error);
      throw error;
    }
  }

  public getPool(): Pool {
    if (!this.isConnected) {
      throw new Error("Database not connected. Call connect() first.");
    }
    return this.pool;
  }

  public async testConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      await client.query("SELECT 1");
      client.release();
      return true;
    } catch (error) {
      return false;
    }
  }

  public async testSchema(): Promise<void> {
    try {
      const client = await this.pool.connect();

      // Test if tables exist
      const result = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('documents', 'chat_messages', 'document_embeddings', 'file_storage')
        ORDER BY table_name
      `);

      client.release();

      const expectedTables = [
        "documents",
        "chat_messages",
        "document_embeddings",
        "file_storage",
      ];
      const foundTables = result.rows.map((row) => row.table_name);

      if (foundTables.length === expectedTables.length) {
        console.log("✅ Database schema verified successfully");
      } else {
        console.warn("⚠️  Some database tables are missing:", {
          expected: expectedTables,
          found: foundTables,
        });
      }
    } catch (error) {
      console.error("❌ Schema verification failed:", error);
      throw error;
    }
  }

  public async getConnectionStats(): Promise<{
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  }> {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  public async runMigrations(): Promise<void> {
    try {
      const client = await this.pool.connect();

      // Read and execute schema.sql
      const fs = require("fs");
      const path = require("path");
      const schemaPath = path.join(__dirname, "schema.sql");

      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, "utf8");
        await client.query(schema);
        console.log("✅ Database migrations completed successfully");
      } else {
        console.warn("⚠️  Schema file not found, skipping migrations");
      }

      client.release();
    } catch (error) {
      console.error("❌ Database migrations failed:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const dbConnection = DatabaseConnection.getInstance();

// Export types for use in other modules
