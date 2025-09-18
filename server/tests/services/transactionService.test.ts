import {
  TransactionService,
  TransactionResult,
} from "../../src/services/transactionService";
import { Pool, PoolClient } from "pg";

// Mock the database connection
jest.mock("../../src/database/config", () => ({
  dbConnection: {
    getPool: jest.fn(),
  },
}));

describe("TransactionService", () => {
  let mockPool: jest.Mocked<Pool>;
  let mockClient: jest.Mocked<PoolClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock PoolClient
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    } as any;

    // Mock Pool
    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
    } as any;

    // Mock the database connection
    const { dbConnection } = require("../../src/database/config");
    dbConnection.getPool.mockReturnValue(mockPool);

    // Initialize TransactionService
    TransactionService.initialize();
  });

  describe("executeTransaction", () => {
    it("should execute a successful transaction", async () => {
      const mockResult = { id: "123", name: "test" };
      const operation = jest.fn().mockResolvedValue(mockResult);

      const result = await TransactionService.executeTransaction(operation);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
      expect(mockClient.query).toHaveBeenCalledWith(
        "BEGIN ISOLATION LEVEL READ COMMITTED"
      );
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should rollback on error", async () => {
      const mockError = new Error("Database error");
      const operation = jest.fn().mockRejectedValue(mockError);

      const result = await TransactionService.executeTransaction(operation);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
      expect(mockClient.query).toHaveBeenCalledWith(
        "BEGIN ISOLATION LEVEL READ COMMITTED"
      );
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should use custom isolation level", async () => {
      const operation = jest.fn().mockResolvedValue({});

      await TransactionService.executeTransaction(operation, {
        isolationLevel: "SERIALIZABLE",
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        "BEGIN ISOLATION LEVEL SERIALIZABLE"
      );
    });

    it("should use read-only transaction", async () => {
      const operation = jest.fn().mockResolvedValue({});

      await TransactionService.executeTransaction(operation, {
        readOnly: true,
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        "BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY"
      );
    });

    it("should use deferrable transaction", async () => {
      const operation = jest.fn().mockResolvedValue({});

      await TransactionService.executeTransaction(operation, {
        deferrable: true,
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        "BEGIN ISOLATION LEVEL READ COMMITTED DEFERRABLE"
      );
    });
  });

  describe("executeBatchTransaction", () => {
    it("should execute multiple operations in a single transaction", async () => {
      const operation1 = jest.fn().mockResolvedValue("result1");
      const operation2 = jest.fn().mockResolvedValue("result2");
      const operation3 = jest.fn().mockResolvedValue("result3");

      const result = await TransactionService.executeBatchTransaction([
        operation1,
        operation2,
        operation3,
      ]);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(["result1", "result2", "result3"]);
      expect(operation1).toHaveBeenCalledWith(mockClient);
      expect(operation2).toHaveBeenCalledWith(mockClient);
      expect(operation3).toHaveBeenCalledWith(mockClient);
    });

    it("should rollback all operations if any fails", async () => {
      const operation1 = jest.fn().mockResolvedValue("result1");
      const operation2 = jest
        .fn()
        .mockRejectedValue(new Error("Operation failed"));
      const operation3 = jest.fn().mockResolvedValue("result3");

      const result = await TransactionService.executeBatchTransaction([
        operation1,
        operation2,
        operation3,
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Operation failed");
      expect(operation1).toHaveBeenCalledWith(mockClient);
      expect(operation2).toHaveBeenCalledWith(mockClient);
      expect(operation3).not.toHaveBeenCalled();
    });
  });

  describe("savepoint operations", () => {
    it("should create and release savepoint", async () => {
      await TransactionService.createSavepoint(mockClient, "test_savepoint");
      expect(mockClient.query).toHaveBeenCalledWith("SAVEPOINT test_savepoint");

      await TransactionService.releaseSavepoint(mockClient, "test_savepoint");
      expect(mockClient.query).toHaveBeenCalledWith(
        "RELEASE SAVEPOINT test_savepoint"
      );
    });

    it("should rollback to savepoint", async () => {
      await TransactionService.rollbackToSavepoint(
        mockClient,
        "test_savepoint"
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        "ROLLBACK TO SAVEPOINT test_savepoint"
      );
    });
  });

  describe("executeReadOnlyTransaction", () => {
    it("should execute read-only transaction", async () => {
      const operation = jest.fn().mockResolvedValue({});

      await TransactionService.executeReadOnlyTransaction(operation);

      expect(mockClient.query).toHaveBeenCalledWith(
        "BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY"
      );
    });
  });

  describe("executeSerializableTransaction", () => {
    it("should execute serializable transaction", async () => {
      const operation = jest.fn().mockResolvedValue({});

      await TransactionService.executeSerializableTransaction(operation);

      expect(mockClient.query).toHaveBeenCalledWith(
        "BEGIN ISOLATION LEVEL SERIALIZABLE"
      );
    });
  });

  describe("executeWithRetry", () => {
    it("should retry on serialization failure", async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error("serialization failure"))
        .mockRejectedValueOnce(new Error("serialization failure"))
        .mockResolvedValueOnce({ success: true });

      const result = await TransactionService.executeWithRetry(
        operation,
        3,
        10
      );

      expect(result.success).toBe(true);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("should not retry on non-serialization errors", async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new Error("Database connection failed"));

      const result = await TransactionService.executeWithRetry(
        operation,
        3,
        10
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database connection failed");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should retry on deadlock detected", async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error("deadlock detected"))
        .mockResolvedValueOnce({ success: true });

      const result = await TransactionService.executeWithRetry(
        operation,
        3,
        10
      );

      expect(result.success).toBe(true);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it("should fail after max retries", async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new Error("serialization failure"));

      const result = await TransactionService.executeWithRetry(
        operation,
        2,
        10
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("serialization failure");
      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe("error handling", () => {
    it("should handle non-Error objects", async () => {
      const operation = jest.fn().mockRejectedValue("String error");

      const result = await TransactionService.executeTransaction(operation);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown transaction error");
    });

    it("should handle rollback errors gracefully", async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new Error("Operation failed"));
      mockClient.query.mockImplementation((query) => {
        if (query === "ROLLBACK") {
          throw new Error("Rollback failed");
        }
        return Promise.resolve();
      });

      const result = await TransactionService.executeTransaction(operation);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Operation failed");
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
