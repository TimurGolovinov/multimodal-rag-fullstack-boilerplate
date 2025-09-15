import { TransactionService } from "../../src/services/transactionService";
import { OpenAIStreamingService } from "../../src/services/openaiStreamingService";

// Mock dependencies
jest.mock("../../src/database/config", () => ({
  dbConnection: { getPool: jest.fn() },
}));
jest.mock("openai", () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: jest.fn() } },
  })),
}));

describe("Performance and Load Tests", () => {
  let mockPool: any;
  let mockClient: any;
  let streamingService: OpenAIStreamingService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = { query: jest.fn(), release: jest.fn() };
    mockPool = { connect: jest.fn().mockResolvedValue(mockClient) };
    const { dbConnection } = require("../../src/database/config");
    dbConnection.getPool.mockReturnValue(mockPool);
    TransactionService.initialize();

    streamingService = new OpenAIStreamingService();
  });

  describe("Database Performance", () => {
    it("should handle 100 concurrent transactions", async () => {
      const operations = Array(100)
        .fill(null)
        .map((_, index) => jest.fn().mockResolvedValue(`result-${index}`));

      const startTime = Date.now();
      const results = await Promise.all(
        operations.map((op) => TransactionService.executeTransaction(op))
      );
      const endTime = Date.now();

      // All should succeed
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });

      // Should complete within reasonable time (5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it("should handle large batch operations efficiently", async () => {
      const largeOperations = Array(1000)
        .fill(null)
        .map((_, index) => jest.fn().mockResolvedValue(`result-${index}`));

      const startTime = Date.now();
      const result = await TransactionService.executeBatchTransaction(
        largeOperations
      );
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds
    });

    it("should handle memory efficiently with large datasets", async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Simulate processing large dataset
      const operations = Array(100)
        .fill(null)
        .map(
          () => jest.fn().mockResolvedValue({ data: "x".repeat(10000) }) // 10KB per result
        );

      await Promise.all(
        operations.map((op) => TransactionService.executeTransaction(op))
      );

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe("Streaming Performance", () => {
    it("should handle 50 concurrent streaming requests", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [
              { delta: { content: "Response" }, finish_reason: "stop" },
            ],
          };
        },
      };

      const mockOpenAI = (streamingService as any).openai;
      mockOpenAI.chat.completions.create.mockResolvedValue(mockStream);

      const startTime = Date.now();
      const promises = Array(50)
        .fill(null)
        .map(() => {
          const onChunk = jest.fn();
          const onComplete = jest.fn();
          const onError = jest.fn();

          return streamingService
            .streamChatWithContext(
              "Test message",
              "Test context",
              onChunk,
              onComplete,
              onError
            )
            .then(() => ({ onChunk, onComplete, onError }));
        });

      const results = await Promise.all(promises);
      const endTime = Date.now();

      // All should complete successfully
      results.forEach(({ onComplete, onError }) => {
        expect(onComplete).toHaveBeenCalledWith("Response");
        expect(onError).not.toHaveBeenCalled();
      });

      // Should complete within reasonable time (10 seconds)
      expect(endTime - startTime).toBeLessThan(10000);
    });

    it("should handle large context efficiently", async () => {
      const largeContext = "x".repeat(100000); // 100KB context

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [
              { delta: { content: "Response" }, finish_reason: "stop" },
            ],
          };
        },
      };

      const mockOpenAI = (streamingService as any).openai;
      mockOpenAI.chat.completions.create.mockResolvedValue(mockStream);

      const startTime = Date.now();
      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      await streamingService.streamChatWithContext(
        "Test message",
        largeContext,
        onChunk,
        onComplete,
        onError
      );

      const endTime = Date.now();

      expect(onComplete).toHaveBeenCalledWith("Response");
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds
    });

    it("should handle rapid successive requests", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [
              { delta: { content: "Response" }, finish_reason: "stop" },
            ],
          };
        },
      };

      const mockOpenAI = (streamingService as any).openai;
      mockOpenAI.chat.completions.create.mockResolvedValue(mockStream);

      const startTime = Date.now();

      // Send 20 rapid requests
      for (let i = 0; i < 20; i++) {
        const onChunk = jest.fn();
        const onComplete = jest.fn();
        const onError = jest.fn();

        await streamingService.streamChatWithContext(
          `Test message ${i}`,
          "Test context",
          onChunk,
          onComplete,
          onError
        );

        expect(onComplete).toHaveBeenCalledWith("Response");
      }

      const endTime = Date.now();

      // Should complete within reasonable time (15 seconds)
      expect(endTime - startTime).toBeLessThan(15000);
    });
  });

  describe("Memory Leak Detection", () => {
    it("should not leak memory with repeated operations", async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform 1000 operations
      for (let i = 0; i < 1000; i++) {
        const operation = jest.fn().mockResolvedValue(`result-${i}`);
        await TransactionService.executeTransaction(operation);
      }

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it("should not leak memory with streaming operations", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [
              { delta: { content: "Response" }, finish_reason: "stop" },
            ],
          };
        },
      };

      const mockOpenAI = (streamingService as any).openai;
      mockOpenAI.chat.completions.create.mockResolvedValue(mockStream);

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform 100 streaming operations
      for (let i = 0; i < 100; i++) {
        const onChunk = jest.fn();
        const onComplete = jest.fn();
        const onError = jest.fn();

        await streamingService.streamChatWithContext(
          `Test message ${i}`,
          "Test context",
          onChunk,
          onComplete,
          onError
        );
      }

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 20MB)
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024);
    });
  });

  describe("Connection Pool Stress", () => {
    it("should handle connection pool exhaustion gracefully", async () => {
      // Simulate limited connection pool
      let connectionCount = 0;
      const maxConnections = 5;

      mockPool.connect.mockImplementation(() => {
        if (connectionCount >= maxConnections) {
          return Promise.reject(new Error("Connection pool exhausted"));
        }
        connectionCount++;
        return Promise.resolve(mockClient);
      });

      mockClient.release.mockImplementation(() => {
        connectionCount--;
      });

      const operations = Array(10)
        .fill(null)
        .map((_, index) => jest.fn().mockResolvedValue(`result-${index}`));

      const results = await Promise.allSettled(
        operations.map((op) => TransactionService.executeTransaction(op))
      );

      // Some should succeed, some should fail gracefully
      const successful = results.filter((r) => r.status === "fulfilled");
      const failed = results.filter((r) => r.status === "rejected");

      expect(successful.length).toBeGreaterThan(0);
      expect(failed.length).toBeGreaterThan(0);
    });
  });

  describe("Error Recovery Under Load", () => {
    it("should recover from temporary failures under load", async () => {
      let attemptCount = 0;
      const operation = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error("Temporary failure");
        }
        return "success";
      });

      const startTime = Date.now();
      const result = await TransactionService.executeWithRetry(
        operation,
        5,
        10
      );
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3);
      expect(endTime - startTime).toBeLessThan(5000); // Should retry quickly
    });

    it("should handle mixed success/failure scenarios", async () => {
      const operations = [
        jest.fn().mockResolvedValue("success1"),
        jest.fn().mockRejectedValue(new Error("failure1")),
        jest.fn().mockResolvedValue("success2"),
        jest.fn().mockRejectedValue(new Error("failure2")),
        jest.fn().mockResolvedValue("success3"),
      ];

      const results = await Promise.allSettled(
        operations.map((op) => TransactionService.executeTransaction(op))
      );

      const successful = results.filter((r) => r.status === "fulfilled");
      const failed = results.filter((r) => r.status === "rejected");

      expect(successful.length).toBe(3);
      expect(failed.length).toBe(2);
    });
  });
});
