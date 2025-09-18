import { describe, it, expect, jest } from "@jest/globals";
import { AuthService } from "../src/services/authService";

// Mock JWT
jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(),
  verify: jest.fn(),
  decode: jest.fn(),
}));

// Mock database
jest.mock("../../src/database/config", () => ({
  dbConnection: {
    getPool: jest.fn().mockReturnValue({
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      connect: jest.fn().mockResolvedValue(undefined),
      end: jest.fn().mockResolvedValue(undefined),
    } as any),
  },
}));

describe("AuthService", () => {
  describe("validateAccessToken", () => {
    it("should be a static method", () => {
      expect(typeof AuthService.validateAccessToken).toBe("function");
    });

    it("should return null for invalid token", () => {
      const result = AuthService.validateAccessToken("invalid-token");
      expect(result).toBeNull();
    });

    it("should return null for empty token", () => {
      const result = AuthService.validateAccessToken("");
      expect(result).toBeNull();
    });

    it("should return null for null token", () => {
      const result = AuthService.validateAccessToken(null as any);
      expect(result).toBeNull();
    });
  });

  describe("JWT_SECRET validation", () => {
    it("should handle missing JWT_SECRET", () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      const result = AuthService.validateAccessToken("any-token");
      expect(result).toBeNull();

      process.env.JWT_SECRET = originalSecret;
    });
  });
});
