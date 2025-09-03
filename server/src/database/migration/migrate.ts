#!/usr/bin/env ts-node

import { MigrationService } from "./migrationService";
import { dbConnection } from "../config";

/**
 * Migration script to transition from JSON-based storage to PostgreSQL database
 *
 * This script will:
 * 1. Check if old data exists
 * 2. Create backups of existing data
 * 3. Migrate documents to PostgreSQL
 * 4. Migrate files to new storage structure
 * 5. Verify migration success
 * 6. Clean up old files
 */

async function main() {
  console.log("🚀 Starting RAG Application Migration...");
  console.log("=====================================\n");

  try {
    // Initialize migration service
    const migrationService = new MigrationService();

    // Check migration status
    console.log("📋 Checking migration status...");
    const status = await migrationService.getMigrationStatus();

    console.log("Status:");
    console.log(`  - Old data exists: ${status.hasOldData ? "Yes" : "No"}`);
    console.log(`  - Backup exists: ${status.backupExists ? "Yes" : "No"}`);
    console.log(`  - Database ready: ${status.databaseReady ? "Yes" : "No"}`);
    console.log(`  - Old data count: ${status.oldDataCount}`);
    console.log("");

    if (!status.databaseReady) {
      console.error(
        "❌ Database is not ready. Please ensure PostgreSQL is running and accessible."
      );
      process.exit(1);
    }

    if (!status.hasOldData) {
      console.log("✅ No old data found. Migration not needed.");
      console.log("📝 Setting up fresh database...");

      // Just run database setup
      await dbConnection.connect();
      await dbConnection.runMigrations();

      console.log("✅ Fresh database setup completed!");
      process.exit(0);
    }

    // Confirm migration
    console.log(
      "⚠️  Old data detected. This will migrate your existing documents to the new database."
    );
    console.log("📁 A backup will be created before migration begins.");
    console.log("");

    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question("Do you want to proceed with migration? (y/N): ", resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
      console.log("❌ Migration cancelled by user.");
      process.exit(0);
    }

    console.log("");
    console.log("🔄 Starting migration process...");
    console.log("");

    // Progress callback for real-time updates
    const progressCallback = (progress: any) => {
      const barLength = 30;
      const filledLength = Math.round((progress.progress / 100) * barLength);
      const bar =
        "█".repeat(filledLength) + "░".repeat(barLength - filledLength);

      process.stdout.write(
        `\r${progress.stage.toUpperCase()}: [${bar}] ${progress.progress}% ${
          progress.message
        }`
      );

      if (progress.progress === 100) {
        process.stdout.write("\n");
      }
    };

    // Execute migration
    const result = await migrationService.migrateFromJson(progressCallback);

    console.log("");
    console.log("=====================================");

    if (result.success) {
      console.log("✅ Migration completed successfully!");
      console.log("");
      console.log("📊 Migration Summary:");
      console.log(`  - Documents migrated: ${result.documentsMigrated}`);
      console.log(`  - Files migrated: ${result.filesMigrated}`);
      console.log(
        `  - Execution time: ${(result.executionTime / 1000).toFixed(2)}s`
      );
      console.log("");
      console.log("🎉 Your RAG application is now running with PostgreSQL!");
      console.log("");
      console.log("📝 Next steps:");
      console.log("  1. Start your application: npm start");
      console.log("  2. Or use Docker: npm run docker:compose");
      console.log("  3. Verify everything works by visiting your app");
      console.log("");
      console.log(
        "💾 Your old data has been backed up in the backups/ directory"
      );
    } else {
      console.log("❌ Migration failed!");
      console.log("");
      console.log("📋 Error details:");
      result.errors.forEach((error: string) => console.log(`  - ${error}`));

      if (result.warnings.length > 0) {
        console.log("");
        console.log("⚠️  Warnings:");
        result.warnings.forEach((warning: string) =>
          console.log(`  - ${warning}`)
        );
      }

      console.log("");
      console.log(
        "🔄 Rollback has been attempted. Check the backups/ directory for your data."
      );
      console.log(
        "📞 If you need help, check the logs and ensure your database is properly configured."
      );

      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Migration script failed:", error);
    console.log("");
    console.log("🔧 Troubleshooting tips:");
    console.log("  1. Ensure PostgreSQL is running and accessible");
    console.log("  2. Check your .env file configuration");
    console.log("  3. Verify database permissions");
    console.log("  4. Check the logs for detailed error information");

    process.exit(1);
  }
}

// Handle process termination
process.on("SIGINT", async () => {
  console.log("\n\n⚠️  Migration interrupted by user.");
  console.log("🔄 Attempting to clean up...");

  try {
    await dbConnection.disconnect();
    console.log("✅ Cleanup completed.");
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
  }

  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n\n⚠️  Migration terminated.");
  console.log("🔄 Attempting to clean up...");

  try {
    await dbConnection.disconnect();
    console.log("✅ Cleanup completed.");
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
  }

  process.exit(0);
});

// Run migration if this script is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Unhandled error in migration script:", error);
    process.exit(1);
  });
}
