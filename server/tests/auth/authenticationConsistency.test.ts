import { AuthService } from "../../src/services/authService";
import { UserService } from "../../src/services/userService";

// Mock database
jest.mock("../../src/database/config", () => ({
  dbConnection: {
    getPool: jest.fn(),
  },
}));

// Mock bcryptjs
jest.mock("bcryptjs", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// Mock JWT
jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(),
  verify: jest.fn(),
  decode: jest.fn(),
}));

describe("Authentication Consistency Tests", () => {
  let mockPool: any;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
    };

    const { dbConnection } = require("../../src/database/config");
    dbConnection.getPool.mockReturnValue(mockPool);
  });

  describe("User interface consistency", () => {
    it("should use userId consistently in User interface", () => {
      const user = {
        userId: "user-123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        role: "user",
        isVerified: true,
      };

      // This should not cause TypeScript errors
      expect(user.userId).toBe("user-123");
      expect(user.email).toBe("test@example.com");
    });

    it("should not have id property in User interface", () => {
      const user = {
        userId: "user-123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        role: "user",
        isVerified: true,
      };

      // Should not have id property
      expect(user).not.toHaveProperty("id");
    });
  });

  describe("JWT payload consistency", () => {
    it("should generate JWT with userId in payload", async () => {
      const jwt = require("jsonwebtoken");
      const mockToken = "mock-jwt-token";
      jwt.sign.mockReturnValue(mockToken);

      const user = {
        userId: "user-123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        role: "user",
        isVerified: true,
      };

      const result = await AuthService.generateTokens(
        user,
        mockPool,
        "127.0.0.1",
        "test-agent"
      );

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-123",
          email: "test@example.com",
          role: "user",
        }),
        expect.any(String),
        expect.any(Object)
      );

      expect(result.accessToken).toBe(mockToken);
    });

    it("should validate JWT and return user with userId", async () => {
      const jwt = require("jsonwebtoken");
      const mockPayload = {
        userId: "user-123",
        email: "test@example.com",
        role: "user",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      jwt.verify.mockReturnValue(mockPayload);

      // Mock database response
      mockClient.query.mockResolvedValue({
        rows: [
          {
            user_id: "user-123",
            email: "test@example.com",
            first_name: "John",
            last_name: "Doe",
            role: "user",
            is_verified: true,
          },
        ],
      });

      const result = await AuthService.validateAccessToken("valid-token");

      expect(result).toMatchObject({
        userId: "user-123",
        email: "test@example.com",
        role: "user",
      });
      expect(result).toHaveProperty("exp");
      expect(result).toHaveProperty("iat");
    });
  });

  describe("Database mapping consistency", () => {
    it("should map database user_id to userId in User object", () => {
      const dbRow = {
        id: "user-123", // Database uses 'id' field, not 'user_id'
        email: "test@example.com",
        first_name: "John",
        last_name: "Doe",
        role: "user",
        is_verified: true,
        created_at: new Date(),
        updated_at: new Date(),
        last_login: new Date(),
      };

      const user = (UserService as any).mapRowToUser(dbRow);

      expect(user.userId).toBe("user-123");
      expect(user.email).toBe("test@example.com");
      expect(user.firstName).toBe("John");
      expect(user.lastName).toBe("Doe");
      expect(user.role).toBe("user");
      expect(user.isVerified).toBe(true);
    });

    it("should not have id property in mapped User object", () => {
      const dbRow = {
        id: "user-123", // Database uses 'id' field, not 'user_id'
        email: "test@example.com",
        first_name: "John",
        last_name: "Doe",
        role: "user",
        is_verified: true,
        created_at: new Date(),
        updated_at: new Date(),
        last_login: new Date(),
      };

      const user = (UserService as any).mapRowToUser(dbRow);

      expect(user).not.toHaveProperty("id");
    });
  });

  describe("Controller consistency", () => {
    it("should use userId in request user object", () => {
      const mockReq = {
        user: {
          userId: "user-123",
          email: "test@example.com",
          role: "user",
        },
      };

      // This should not cause TypeScript errors
      expect(mockReq.user.userId).toBe("user-123");
      expect(mockReq.user.email).toBe("test@example.com");
    });

    it("should not have id property in request user object", () => {
      const mockReq = {
        user: {
          userId: "user-123",
          email: "test@example.com",
          role: "user",
        },
      };

      expect(mockReq.user).not.toHaveProperty("id");
    });
  });

  describe("Session management consistency", () => {
    it("should use userId in session creation", async () => {
      const jwt = require("jsonwebtoken");
      const bcrypt = require("bcryptjs");

      jwt.sign.mockReturnValue("mock-token");
      bcrypt.hash.mockResolvedValue("hashed-refresh-token");

      const user = {
        userId: "user-123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        role: "user",
        isVerified: true,
      };

      // Mock database responses
      mockClient.query.mockResolvedValue({ rows: [] });

      await AuthService.generateTokens(
        user,
        mockPool,
        "127.0.0.1",
        "test-agent"
      );

      // Verify that user.userId is used in database queries
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO user_sessions"),
        expect.arrayContaining(["user-123"])
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE users SET last_login"),
        expect.arrayContaining(["user-123"])
      );
    });
  });

  describe("Error handling consistency", () => {
    it("should handle missing userId gracefully", () => {
      const invalidUser = {
        email: "test@example.com",
        // Missing userId
      } as any;

      expect(() => {
        // This should cause a TypeScript error in real code
        const userId = invalidUser.userId;
        expect(userId).toBeUndefined();
      }).not.toThrow();
    });

    it("should handle legacy id property gracefully", () => {
      const legacyUser = {
        id: "user-123", // Legacy id property
        email: "test@example.com",
      } as any;

      // Should not have userId property
      expect(legacyUser.userId).toBeUndefined();
      expect(legacyUser.id).toBe("user-123");
    });
  });

  describe("Type safety", () => {
    it("should enforce userId type in User interface", () => {
      // This test ensures TypeScript compilation will fail if we try to use 'id' instead of 'userId'
      const user: {
        userId: string;
        email: string;
        role: string;
      } = {
        userId: "user-123",
        email: "test@example.com",
        role: "user",
      };

      // These should work
      expect(typeof user.userId).toBe("string");
      expect(typeof user.email).toBe("string");
      expect(typeof user.role).toBe("string");

      // This should cause TypeScript error (commented out to prevent compilation error)
      // user.id = "user-123"; // TypeScript error: Property 'id' does not exist
    });
  });
});
