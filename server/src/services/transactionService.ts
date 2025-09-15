import { Pool, PoolClient } from "pg";
import { dbConnection } from "../database/config";

/**
 * Transaction result interface
 */
export interface TransactionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Transaction options
 */
export interface TransactionOptions {
  isolationLevel?:
    | "READ_UNCOMMITTED"
    | "READ_COMMITTED"
    | "REPEATABLE_READ"
    | "SERIALIZABLE";
  readOnly?: boolean;
  deferrable?: boolean;
}

/**
 * TransactionService - Provides consistent database transaction management
 *
 * Features:
 * - Automatic transaction management with rollback on errors
 * - Configurable isolation levels
 * - Proper connection cleanup
 * - Consistent error handling
 * - Support for nested transactions (savepoints)
 */
export class TransactionService {
  private static pool: Pool;

  /**
   * Initialize the transaction service with database pool
   */
  public static initialize(): void {
    this.pool = dbConnection.getPool();
  }

  /**
   * Execute a function within a database transaction
   * @param operation - Function to execute within the transaction
   * @param options - Transaction options
   * @returns Promise<TransactionResult<T>>
   */
  public static async executeTransaction<T>(
    operation: (client: PoolClient) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<TransactionResult<T>> {
    const client = await this.pool.connect();

    try {
      // Begin transaction with specified options
      const isolationLevel = options.isolationLevel || "READ_COMMITTED";
      const readOnly = options.readOnly || false;
      const deferrable = options.deferrable || false;

      // Convert isolation level to PostgreSQL format
      const pgIsolationLevel = isolationLevel.replace(/_/g, " ");
      let beginQuery = `BEGIN ISOLATION LEVEL ${pgIsolationLevel}`;
      if (readOnly) {
        beginQuery += " READ ONLY";
      }
      if (deferrable) {
        beginQuery += " DEFERRABLE";
      }

      await client.query(beginQuery);

      // Execute the operation
      const result = await operation(client);

      // Commit the transaction
      await client.query("COMMIT");

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      // Rollback on error
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Failed to rollback transaction:", rollbackError);
      }

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown transaction error",
      };
    } finally {
      // Always release the client
      client.release();
    }
  }

  /**
   * Execute multiple operations within a single transaction
   * @param operations - Array of operations to execute
   * @param options - Transaction options
   * @returns Promise<TransactionResult<T[]>>
   */
  public static async executeBatchTransaction<T>(
    operations: Array<(client: PoolClient) => Promise<T>>,
    options: TransactionOptions = {}
  ): Promise<TransactionResult<T[]>> {
    return this.executeTransaction(async (client) => {
      const results: T[] = [];

      for (const operation of operations) {
        const result = await operation(client);
        results.push(result);
      }

      return results;
    }, options);
  }

  /**
   * Create a savepoint for nested transactions
   * @param client - Database client
   * @param name - Savepoint name
   */
  public static async createSavepoint(
    client: PoolClient,
    name: string
  ): Promise<void> {
    await client.query(`SAVEPOINT ${name}`);
  }

  /**
   * Release a savepoint
   * @param client - Database client
   * @param name - Savepoint name
   */
  public static async releaseSavepoint(
    client: PoolClient,
    name: string
  ): Promise<void> {
    await client.query(`RELEASE SAVEPOINT ${name}`);
  }

  /**
   * Rollback to a savepoint
   * @param client - Database client
   * @param name - Savepoint name
   */
  public static async rollbackToSavepoint(
    client: PoolClient,
    name: string
  ): Promise<void> {
    await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
  }

  /**
   * Execute a read-only transaction
   * @param operation - Function to execute within the read-only transaction
   * @returns Promise<TransactionResult<T>>
   */
  public static async executeReadOnlyTransaction<T>(
    operation: (client: PoolClient) => Promise<T>
  ): Promise<TransactionResult<T>> {
    return this.executeTransaction(operation, {
      readOnly: true,
      isolationLevel: "READ_COMMITTED",
    });
  }

  /**
   * Execute a transaction with serializable isolation level
   * @param operation - Function to execute within the transaction
   * @returns Promise<TransactionResult<T>>
   */
  public static async executeSerializableTransaction<T>(
    operation: (client: PoolClient) => Promise<T>
  ): Promise<TransactionResult<T>> {
    return this.executeTransaction(operation, {
      isolationLevel: "SERIALIZABLE",
    });
  }

  /**
   * Execute a transaction with retry logic for serialization failures
   * @param operation - Function to execute within the transaction
   * @param maxRetries - Maximum number of retries
   * @param retryDelay - Delay between retries in milliseconds
   * @returns Promise<TransactionResult<T>>
   */
  public static async executeWithRetry<T>(
    operation: (client: PoolClient) => Promise<T>,
    maxRetries: number = 3,
    retryDelay: number = 100
  ): Promise<TransactionResult<T>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await this.executeSerializableTransaction(operation);

      if (result.success) {
        return result;
      }

      // Check if it's a serialization failure that we can retry
      if (
        result.error?.includes("serialization failure") ||
        result.error?.includes("deadlock detected")
      ) {
        lastError = new Error(result.error);

        if (attempt < maxRetries) {
          // Wait before retrying
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelay * Math.pow(2, attempt))
          );
          continue;
        }
      }

      // If it's not a retryable error, return immediately
      return result;
    }

    return {
      success: false,
      error: lastError?.message || "Transaction failed after maximum retries",
    };
  }
}
