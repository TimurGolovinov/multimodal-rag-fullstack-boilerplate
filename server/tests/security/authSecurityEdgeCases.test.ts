import { AuthService } from "../../src/services/authService";
import { UserService } from "../../src/services/userService";

// Mock dependencies
jest.mock("../../src/database/config", () => ({
  dbConnection: { getPool: jest.fn() },
}));
jest.mock("bcryptjs", () => ({ hash: jest.fn(), compare: jest.fn() }));
jest.mock("jsonwebtoken", () => ({ sign: jest.fn(), verify: jest.fn() }));

describe("Authentication Security Edge Cases", () => {
  let mockPool: any;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = { query: jest.fn(), release: jest.fn() };
    mockPool = { connect: jest.fn().mockResolvedValue(mockClient) };
    const { dbConnection } = require("../../src/database/config");
    dbConnection.getPool.mockReturnValue(mockPool);
  });

  describe("JWT Token Security", () => {
    it("should reject tokens with invalid signature", async () => {
      const jwt = require("jsonwebtoken");
      jwt.verify.mockImplementation(() => {
        throw new Error("invalid signature");
      });

      const result = await AuthService.validateAccessToken("invalid-token");
      expect(result).toBeNull();
    });

    it("should reject expired tokens", async () => {
      const jwt = require("jsonwebtoken");
      jwt.verify.mockImplementation(() => {
        throw new Error("jwt expired");
      });

      const result = await AuthService.validateAccessToken("expired-token");
      expect(result).toBeNull();
    });

    it("should reject tokens with wrong audience", async () => {
      const jwt = require("jsonwebtoken");
      jwt.verify.mockReturnValue({
        userId: "user-123",
        aud: "wrong-audience", // Wrong audience
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const result = await AuthService.validateAccessToken(
        "wrong-audience-token"
      );
      expect(result).toBeNull();
    });

    it("should reject tokens with wrong issuer", async () => {
      const jwt = require("jsonwebtoken");
      jwt.verify.mockReturnValue({
        userId: "user-123",
        iss: "wrong-issuer", // Wrong issuer
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const result = await AuthService.validateAccessToken(
        "wrong-issuer-token"
      );
      expect(result).toBeNull();
    });

    it("should handle malformed JWT tokens", async () => {
      const result = await AuthService.validateAccessToken("not.a.valid.jwt");
      expect(result).toBeNull();
    });

    it("should handle empty or null tokens", async () => {
      expect(await AuthService.validateAccessToken("")).toBeNull();
      expect(await AuthService.validateAccessToken(null as any)).toBeNull();
      expect(
        await AuthService.validateAccessToken(undefined as any)
      ).toBeNull();
    });
  });

  describe("Password Security", () => {
    it("should reject weak passwords", async () => {
      const weakPasswords = [
        "123", // Too short
        "password", // Common password
        "12345678", // Only numbers
        "abcdefgh", // Only letters
        "Password", // No numbers/special chars
      ];

      for (const password of weakPasswords) {
        const result = await UserService.validatePasswordStrength(password);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Password does not meet security requirements"
        );
      }
    });

    it("should accept strong passwords", async () => {
      const strongPasswords = [
        "MyStr0ng!Pass",
        "Complex#Pass123",
        "Secure$Password9",
      ];

      for (const password of strongPasswords) {
        const result = await UserService.validatePasswordStrength(password);
        expect(result.isValid).toBe(true);
      }
    });

    it("should prevent password reuse", async () => {
      const bcrypt = require("bcryptjs");
      bcrypt.compare.mockResolvedValue(true);

      // Mock previous password hashes
      mockClient.query.mockResolvedValue({
        rows: [
          { password_hash: "old_hash_1" },
          { password_hash: "old_hash_2" },
        ],
      });

      const result = await UserService.checkPasswordReuse(
        "user-123",
        "OldPassword123!",
        mockPool
      );

      expect(result).toBe(true); // Password was reused
    });
  });

  describe("Session Security", () => {
    it("should invalidate all sessions on password change", async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await AuthService.invalidateAllUserSessions("user-123", mockPool);

      expect(mockClient.query).toHaveBeenCalledWith(
        "DELETE FROM user_sessions WHERE user_id = $1",
        ["user-123"]
      );
    });

    it("should handle concurrent session creation", async () => {
      const jwt = require("jsonwebtoken");
      jwt.sign.mockReturnValue("mock-token");

      // Simulate concurrent session creation
      const promises = Array(5)
        .fill(null)
        .map(() =>
          AuthService.generateTokens(
            { userId: "user-123", email: "test@example.com", role: "user" },
            mockPool,
            "127.0.0.1",
            "test-agent"
          )
        );

      await Promise.all(promises);

      // Should handle concurrent database writes gracefully
      expect(mockClient.query).toHaveBeenCalledTimes(10); // 5 sessions * 2 queries each
    });

    it("should clean up expired sessions", async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await AuthService.cleanupExpiredSessions(mockPool);

      expect(mockClient.query).toHaveBeenCalledWith(
        "DELETE FROM user_sessions WHERE expires_at < NOW()"
      );
    });
  });

  describe("Rate Limiting", () => {
    it("should block after multiple failed login attempts", async () => {
      const bcrypt = require("bcryptjs");
      bcrypt.compare.mockResolvedValue(false); // Wrong password

      // Simulate multiple failed attempts
      for (let i = 0; i < 6; i++) {
        await AuthService.authenticateUser(
          "test@example.com",
          "wrong-password",
          mockPool
        );
      }

      // Should be rate limited
      const result = await AuthService.authenticateUser(
        "test@example.com",
        "wrong-password",
        mockPool
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("rate limit");
    });

    it("should reset rate limit after successful login", async () => {
      const bcrypt = require("bcryptjs");
      bcrypt.compare
        .mockResolvedValueOnce(false) // Failed attempts
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true); // Successful login

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // Failed attempts
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: "user-123", email: "test@example.com" }],
        }); // Success

      // Failed attempts
      await AuthService.authenticateUser("test@example.com", "wrong", mockPool);
      await AuthService.authenticateUser("test@example.com", "wrong", mockPool);

      // Successful login should reset rate limit
      const result = await AuthService.authenticateUser(
        "test@example.com",
        "correct-password",
        mockPool
      );
      expect(result.success).toBe(true);
    });
  });

  describe("Input Validation", () => {
    it("should sanitize malicious input in email", async () => {
      const maliciousEmails = [
        "test@example.com<script>alert('xss')</script>",
        "test@example.com'; DROP TABLE users; --",
        "test@example.com\0",
        "test@example.com\n",
      ];

      for (const email of maliciousEmails) {
        const result = await UserService.sanitizeEmail(email);
        expect(result).not.toContain("<script>");
        expect(result).not.toContain("DROP TABLE");
        expect(result).not.toContain("\0");
        expect(result).not.toContain("\n");
      }
    });

    it("should handle SQL injection attempts", async () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; INSERT INTO users VALUES ('hacker', 'hacker@evil.com'); --",
      ];

      for (const input of sqlInjectionAttempts) {
        const result = await UserService.sanitizeInput(input);
        expect(result).not.toContain("DROP TABLE");
        expect(result).not.toContain("OR '1'='1");
        expect(result).not.toContain("INSERT INTO");
      }
    });
  });

  describe("Concurrent Access", () => {
    it("should handle concurrent password changes", async () => {
      const bcrypt = require("bcryptjs");
      bcrypt.hash.mockResolvedValue("hashed-password");

      // Simulate concurrent password changes
      const promises = Array(3)
        .fill(null)
        .map(() =>
          UserService.changePassword(
            "user-123",
            "old-password",
            "new-password",
            mockPool
          )
        );

      const results = await Promise.allSettled(promises);

      // Only one should succeed, others should fail gracefully
      const successful = results.filter((r) => r.status === "fulfilled");
      expect(successful.length).toBe(1);
    });

    it("should handle concurrent session creation", async () => {
      const jwt = require("jsonwebtoken");
      jwt.sign.mockReturnValue("mock-token");

      // Simulate concurrent session creation
      const promises = Array(10)
        .fill(null)
        .map(() =>
          AuthService.generateTokens(
            { userId: "user-123", email: "test@example.com", role: "user" },
            mockPool,
            "127.0.0.1",
            "test-agent"
          )
        );

      const results = await Promise.allSettled(promises);

      // All should succeed or fail gracefully
      results.forEach((result) => {
        expect(result.status).toBe("fulfilled");
      });
    });
  });
});
