import { Pool } from "pg";
import fs from "fs";
import path from "path";

export interface MigrationResult {
  success: boolean;
  appliedMigrations: string[];
  error?: string;
}

export class MigrationRunner {
  private pool: Pool;
  private migrationsDir: string;
  private seedsDir: string;

  constructor(pool: Pool) {
    this.pool = pool;
    // Use the correct path for migrations and seeds in the container
    this.migrationsDir = path.join(
      process.cwd(),
      "src",
      "database",
      "migrations"
    );
    this.seedsDir = path.join(process.cwd(), "src", "database", "seeds");
  }

  /**
   * Run all pending migrations
   */
  public async runMigrations(): Promise<MigrationResult> {
    try {
      console.log("🔄 Starting database migrations...");

      // Create migrations table if it doesn't exist
      await this.createMigrationsTable();

      // Get current schema version
      const currentVersion = await this.getCurrentVersion();
      console.log(`📊 Current schema version: ${currentVersion}`);

      // Find and apply pending migrations
      const appliedMigrations: string[] = [];

      if (fs.existsSync(this.migrationsDir)) {
        const migrationFiles = fs
          .readdirSync(this.migrationsDir)
          .filter((file) => file.endsWith(".sql"))
          .sort();

        for (const file of migrationFiles) {
          const version = file.replace(".sql", "");

          if (version > currentVersion) {
            console.log(`📝 Applying migration: ${version}`);
            await this.applyMigration(
              path.join(this.migrationsDir, file),
              version
            );
            appliedMigrations.push(version);
          } else {
            console.log(`⏭️  Migration ${version} already applied, skipping`);
          }
        }
      } else {
        console.log("⚠️  No migrations directory found");
      }

      // Apply seeds
      await this.applySeeds();

      console.log("✅ Database migrations completed successfully!");
      return {
        success: true,
        appliedMigrations,
      };
    } catch (error) {
      console.error("❌ Database migrations failed:", error);
      return {
        success: false,
        appliedMigrations: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Create migrations table
   */
  private async createMigrationsTable(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        description TEXT
      );
    `);
  }

  /**
   * Get current schema version
   */
  private async getCurrentVersion(): Promise<string> {
    const result = await this.pool.query(`
      SELECT COALESCE(MAX(version), '000') as version 
      FROM schema_migrations;
    `);
    return result.rows[0]?.version || "000";
  }

  /**
   * Apply a single migration
   */
  private async applyMigration(
    migrationFile: string,
    version: string
  ): Promise<void> {
    const migrationContent = fs.readFileSync(migrationFile, "utf8");
    const description = this.extractDescription(migrationContent);

    // Start transaction
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Execute migration
      await client.query(migrationContent);

      // Record migration
      await client.query(
        "INSERT INTO schema_migrations (version, description) VALUES ($1, $2)",
        [version, description]
      );

      await client.query("COMMIT");
      console.log(`✅ Migration ${version} applied successfully`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Extract description from migration file
   */
  private extractDescription(content: string): string {
    const lines = content.split("\n");
    for (const line of lines) {
      if (line.startsWith("-- Description:")) {
        return line.replace("-- Description:", "").trim();
      }
    }
    return "No description";
  }

  /**
   * Apply seeds for current environment
   */
  private async applySeeds(): Promise<void> {
    const environment = process.env.NODE_ENV || "development";
    const seedFile = path.join(this.seedsDir, `${environment}.sql`);

    if (fs.existsSync(seedFile)) {
      console.log(`🌱 Applying seeds for environment: ${environment}`);
      const seedContent = fs.readFileSync(seedFile, "utf8");
      await this.pool.query(seedContent);
      console.log("✅ Seeds applied successfully");
    } else {
      console.log(`⚠️  No seed file found for environment: ${environment}`);
    }
  }

  /**
   * Get migration status
   */
  public async getStatus(): Promise<{
    appliedMigrations: Array<{
      version: string;
      description: string;
      applied_at: string;
    }>;
    availableMigrations: string[];
  }> {
    await this.createMigrationsTable();

    const appliedResult = await this.pool.query(`
      SELECT version, description, applied_at 
      FROM schema_migrations 
      ORDER BY version;
    `);

    const availableMigrations: string[] = [];
    if (fs.existsSync(this.migrationsDir)) {
      const files = fs
        .readdirSync(this.migrationsDir)
        .filter((file) => file.endsWith(".sql"))
        .map((file) => file.replace(".sql", ""))
        .sort();
      availableMigrations.push(...files);
    }

    return {
      appliedMigrations: appliedResult.rows,
      availableMigrations,
    };
  }
}
