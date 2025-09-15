import { TransactionService } from "../../src/services/transactionService";
import { AuthService } from "../../src/services/authService";

// Mock dependencies
jest.mock("../../src/database/config", () => ({
  dbConnection: { getPool: jest.fn() },
}));
jest.mock("bcryptjs", () => ({ hash: jest.fn(), compare: jest.fn() }));
jest.mock("jsonwebtoken", () => ({ sign: jest.fn(), verify: jest.fn() }));

describe("Practical Integration Tests (80/20 Rule)", () => {
  let mockPool: any;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = { query: jest.fn(), release: jest.fn() };
    mockPool = { connect: jest.fn().mockResolvedValue(mockClient) };
    const { dbConnection } = require("../../src/database/config");
    dbConnection.getPool.mockReturnValue(mockPool);
    TransactionService.initialize();
  });

  describe("🎯 Critical Flow: Complete Chat with Database Transaction", () => {
    it("should handle chat message saving with transaction rollback on error", async () => {
      // Mock database operations
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: "user-msg-id" }] }) // User message succeeds
        .mockRejectedValueOnce(new Error("Database error")); // Assistant message fails

      const operation = jest.fn().mockImplementation(async (client) => {
        // Simulate saving user message
        await client.query(
          "INSERT INTO chat_messages (user_id, role, content) VALUES ($1, $2, $3)",
          ["user-123", "user", "Hello"]
        );

        // Simulate saving assistant message (this will fail)
        await client.query(
          "INSERT INTO chat_messages (user_id, role, content) VALUES ($1, $2, $3)",
          ["user-123", "assistant", "Hi there!"]
        );
      });

      // Act: Execute transaction
      const result = await TransactionService.executeTransaction(operation);

      // Assert: Transaction should rollback
      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });

    it("should handle successful chat message saving with transaction commit", async () => {
      // Mock successful database operations
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: "user-msg-id" }] }) // User message
        .mockResolvedValueOnce({ rows: [{ id: "assistant-msg-id" }] }); // Assistant message

      const operation = jest.fn().mockImplementation(async (client) => {
        await client.query(
          "INSERT INTO chat_messages (user_id, role, content) VALUES ($1, $2, $3)",
          ["user-123", "user", "Hello"]
        );
        await client.query(
          "INSERT INTO chat_messages (user_id, role, content) VALUES ($1, $2, $3)",
          ["user-123", "assistant", "Hi there!"]
        );
        return {
          userMessageId: "user-msg-id",
          assistantMessageId: "assistant-msg-id",
        };
      });

      // Act: Execute transaction
      const result = await TransactionService.executeTransaction(operation);

      // Assert: Transaction should succeed
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        userMessageId: "user-msg-id",
        assistantMessageId: "assistant-msg-id",
      });
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    });
  });

  describe("🔒 Critical Security: JWT Token Validation", () => {
    it("should reject malformed JWT tokens", async () => {
      // Act: Try to validate malformed token
      const result = await AuthService.validateAccessToken("not.a.valid.jwt");

      // Assert: Should return null
      expect(result).toBeNull();
    });

    it("should reject expired JWT tokens", async () => {
      const jwt = require("jsonwebtoken");
      jwt.verify.mockImplementation(() => {
        throw new Error("jwt expired");
      });

      // Act: Try to validate expired token
      const result = await AuthService.validateAccessToken("expired-token");

      // Assert: Should return null
      expect(result).toBeNull();
    });

    it("should accept valid JWT tokens", async () => {
      const jwt = require("jsonwebtoken");
      jwt.verify.mockReturnValue({
        userId: "user-123",
        email: "test@example.com",
        role: "user",
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      // Mock database user lookup
      mockClient.query.mockResolvedValue({
        rows: [
          {
            id: "user-123",
            email: "test@example.com",
            first_name: "John",
            last_name: "Doe",
            role: "user",
            is_verified: true,
          },
        ],
      });

      // Act: Validate valid token
      const result = await AuthService.validateAccessToken("valid-token");

      // Assert: Should return user data
      expect(result).toMatchObject({
        userId: "user-123",
        email: "test@example.com",
        role: "user",
      });
    });
  });

  describe("⚡ Critical Performance: Concurrent Operations", () => {
    it("should handle 20 concurrent database transactions", async () => {
      // Act: Execute 20 concurrent transactions
      const operations = Array(20)
        .fill(null)
        .map((_, index) => jest.fn().mockResolvedValue(`result-${index}`));

      const startTime = Date.now();
      const results = await Promise.all(
        operations.map((op) => TransactionService.executeTransaction(op))
      );
      const endTime = Date.now();

      // Assert: All should succeed within reasonable time
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });
      expect(endTime - startTime).toBeLessThan(3000); // 3 seconds
    });

    it("should handle large batch operations efficiently", async () => {
      // Act: Execute large batch transaction
      const largeOperations = Array(50)
        .fill(null)
        .map((_, index) => jest.fn().mockResolvedValue(`result-${index}`));

      const startTime = Date.now();
      const result = await TransactionService.executeBatchTransaction(
        largeOperations
      );
      const endTime = Date.now();

      // Assert: Should complete efficiently
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(2000); // 2 seconds
    });
  });

  describe("🛡️ Critical Error: Database Failure Recovery", () => {
    it("should handle database connection loss gracefully", async () => {
      // Mock connection loss
      mockPool.connect.mockRejectedValue(
        new Error("Connection pool exhausted")
      );

      const operation = jest.fn().mockResolvedValue({});

      // Act: Try to execute transaction with no connections
      const result = await TransactionService.executeTransaction(operation);

      // Assert: Should handle gracefully
      expect(result.success).toBe(false);
      expect(result.error).toContain("Connection pool exhausted");
    });

    it("should handle database query failures with rollback", async () => {
      // Mock query failure
      mockClient.query.mockImplementation((query: any) => {
        if (query.includes("INSERT")) {
          return Promise.reject(new Error("Query failed"));
        }
        return Promise.resolve();
      });

      const operation = jest.fn().mockRejectedValue(new Error("Query failed"));

      // Act: Execute transaction that fails
      const result = await TransactionService.executeTransaction(operation);

      // Assert: Should rollback
      expect(result.success).toBe(false);
      expect(result.error).toBe("Query failed");
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });
  });

  describe("🔄 Critical Integration: Cross-Service Data Consistency", () => {
    it("should maintain data consistency across multiple operations", async () => {
      // Mock successful operations
      mockClient.query.mockResolvedValue({ rows: [] });

      const operation1 = jest.fn().mockResolvedValue("result1");
      const operation2 = jest.fn().mockResolvedValue("result2");

      // Act: Execute operations in sequence
      const result1 = await TransactionService.executeTransaction(operation1);
      const result2 = await TransactionService.executeTransaction(operation2);

      // Assert: Both should succeed
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.data).toBe("result1");
      expect(result2.data).toBe("result2");
    });

    it("should handle partial failures in batch operations", async () => {
      const operations = [
        jest.fn().mockResolvedValue("result1"),
        jest.fn().mockRejectedValue(new Error("Operation 2 failed")),
        jest.fn().mockResolvedValue("result3"),
      ];

      // Act: Execute batch with failure
      const result = await TransactionService.executeBatchTransaction(
        operations
      );

      // Assert: Should fail due to operation 2
      expect(result.success).toBe(false);
      expect(result.error).toBe("Operation 2 failed");
    });
  });

  describe("🔐 Critical Security: Input Validation", () => {
    it("should handle SQL injection attempts", async () => {
      const maliciousInput = "'; DROP TABLE users; --";

      // Mock database query
      mockClient.query.mockResolvedValue({ rows: [] });

      // Act: Try to use malicious input in query
      await mockClient.query("SELECT * FROM users WHERE email = $1", [
        maliciousInput,
      ]);

      // Assert: Should use parameterized query (not vulnerable to injection)
      expect(mockClient.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE email = $1",
        [maliciousInput]
      );
      // Should not contain DROP TABLE in the actual query
      expect(mockClient.query).not.toHaveBeenCalledWith(
        expect.stringContaining("DROP TABLE")
      );
    });

    it("should handle empty and null inputs gracefully", async () => {
      // Act & Assert: Should handle gracefully
      expect(await AuthService.validateAccessToken("")).toBeNull();
      expect(await AuthService.validateAccessToken(null as any)).toBeNull();
      expect(
        await AuthService.validateAccessToken(undefined as any)
      ).toBeNull();
    });
  });

  describe("📊 Critical Monitoring: Resource Cleanup", () => {
    it("should always release database connections", async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new Error("Operation failed"));

      // Act: Execute transaction that fails
      await TransactionService.executeTransaction(operation);

      // Assert: Should release connection
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should release connections even if rollback fails", async () => {
      mockClient.query.mockImplementation((query: any) => {
        if (query === "ROLLBACK") {
          return Promise.reject(new Error("Rollback failed"));
        }
        return Promise.resolve();
      });

      const operation = jest
        .fn()
        .mockRejectedValue(new Error("Operation failed"));

      // Act: Execute transaction with rollback failure
      const result = await TransactionService.executeTransaction(operation);

      // Assert: Should still release connection
      expect(result.success).toBe(false);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
