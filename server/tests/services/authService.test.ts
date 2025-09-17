import {
  AuthService,
  JWTPayload,
  RefreshTokenPayload,
} from "../../src/services/authService";
import { Pool } from "pg";
import * as jwt from "jsonwebtoken";

// Mock the database pool
const mockPool = {
  connect: jest.fn(),
} as unknown as Pool;

const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

// Mock the PasswordService
jest.mock("../../src/services/passwordService", () => ({
  PasswordService: {
    hashPassword: jest.fn().mockResolvedValue("hashed-password"),
    comparePassword: jest.fn().mockResolvedValue(true),
  },
}));

// Mock environment variables
const originalEnv = process.env;

describe("AuthService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      JWT_SECRET: "test-jwt-secret",
      REFRESH_TOKEN_SECRET: "test-refresh-secret",
    };
    (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);

    // Reset mock implementations
    (mockClient.query as jest.Mock).mockReset();
    (mockClient.release as jest.Mock).mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("generateTokens", () => {
    it("should generate valid access and refresh tokens", async () => {
      const user = {
        userId: "user123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        role: "user",
        isVerified: true,
      };

      mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await AuthService.generateTokens(
        user,
        mockPool,
        "test-user-agent",
        "127.0.0.1"
      );

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toEqual(user);

      // Verify access token
      const accessToken = result.accessToken!;
      const decodedAccess = jwt.verify(
        accessToken,
        process.env.JWT_SECRET!
      ) as JWTPayload;
      expect(decodedAccess.userId).toBe(user.userId);
      expect(decodedAccess.email).toBe(user.email);
      expect(decodedAccess.role).toBe(user.role);

      // Verify refresh token
      const refreshToken = result.refreshToken!;
      const decodedRefresh = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET!
      ) as RefreshTokenPayload;
      expect(decodedRefresh.userId).toBe(user.userId);
    });

    it("should set correct expiration times", async () => {
      const user = {
        userId: "user123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        role: "user",
        isVerified: true,
      };

      mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await AuthService.generateTokens(user, mockPool);

      expect(result.success).toBe(true);

      const accessToken = result.accessToken!;
      const decodedAccess = jwt.verify(
        accessToken,
        process.env.JWT_SECRET!
      ) as JWTPayload;

      // Check that access token expires in 24 hours
      const now = Math.floor(Date.now() / 1000);
      const expectedExp = now + 24 * 60 * 60; // 24 hours
      expect(decodedAccess.exp).toBeGreaterThanOrEqual(expectedExp - 60); // Allow 1 minute tolerance
      expect(decodedAccess.exp).toBeLessThanOrEqual(expectedExp + 60);

      const refreshToken = result.refreshToken!;
      const decodedRefresh = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET!
      ) as RefreshTokenPayload;

      // Check that refresh token expires in 7 days
      const expectedRefreshExp = now + 7 * 24 * 60 * 60; // 7 days
      expect(decodedRefresh.exp).toBeGreaterThanOrEqual(
        expectedRefreshExp - 60
      );
      expect(decodedRefresh.exp).toBeLessThanOrEqual(expectedRefreshExp + 60);
    });

    it("should fail when JWT secrets are not configured", async () => {
      // Temporarily clear the secrets
      const originalJwtSecret = process.env.JWT_SECRET;
      const originalRefreshSecret = process.env.REFRESH_TOKEN_SECRET;

      delete process.env.JWT_SECRET;
      delete process.env.REFRESH_TOKEN_SECRET;

      const user = {
        userId: "user123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        role: "user",
        isVerified: true,
      };

      const result = await AuthService.generateTokens(user, mockPool);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to generate authentication tokens");

      // Restore the secrets
      process.env.JWT_SECRET = originalJwtSecret;
      process.env.REFRESH_TOKEN_SECRET = originalRefreshSecret;
    });

    it("should handle database errors gracefully", async () => {
      const user = {
        userId: "user123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        role: "user",
        isVerified: true,
      };

      mockClient.query.mockRejectedValueOnce(new Error("Database error"));

      const result = await AuthService.generateTokens(user, mockPool);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to generate authentication tokens");
    });
  });

  describe("validateAccessToken", () => {
    it("should validate a valid access token", () => {
      const payload: JWTPayload = {
        userId: "user123",
        email: "test@example.com",
        role: "user",
        jti: "jwt-id-123",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET!, {
        issuer: "rag-app",
        audience: "rag-client",
      });

      const result = AuthService.validateAccessToken(token);

      expect(result).toEqual({
        ...payload,
        iss: "rag-app",
        aud: "rag-client",
      });
    });

    it("should return null for invalid token", () => {
      const result = AuthService.validateAccessToken("invalid-token");
      expect(result).toBeNull();
    });

    it("should return null for expired token", () => {
      const payload: JWTPayload = {
        userId: "user123",
        email: "test@example.com",
        role: "user",
        jti: "jwt-id-123",
        iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (expired)
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET!, {
        issuer: "rag-app",
        audience: "rag-client",
      });

      const result = AuthService.validateAccessToken(token);
      expect(result).toBeNull();
    });

    it("should return null when JWT_SECRET is not configured", () => {
      const originalJwtSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      const payload: JWTPayload = {
        userId: "user123",
        email: "test@example.com",
        role: "user",
        jti: "jwt-id-123",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = jwt.sign(payload, "test-jwt-secret", {
        issuer: "rag-app",
        audience: "rag-client",
      });

      const result = AuthService.validateAccessToken(token);
      expect(result).toBeNull();

      // Restore the secret
      process.env.JWT_SECRET = originalJwtSecret;
    });
  });

  describe("validateRefreshToken", () => {
    it("should validate a valid refresh token", () => {
      const payload: RefreshTokenPayload = {
        userId: "user123",
        jti: "refresh-jwt-id-123",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days from now
      };

      const token = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET!, {
        issuer: "rag-app",
        audience: "rag-client",
      });

      const result = AuthService.validateRefreshToken(token);

      expect(result).toEqual({
        ...payload,
        iss: "rag-app",
        aud: "rag-client",
      });
    });

    it("should return null for invalid refresh token", () => {
      const result = AuthService.validateRefreshToken("invalid-token");
      expect(result).toBeNull();
    });

    it("should return null for expired refresh token", () => {
      const payload: RefreshTokenPayload = {
        userId: "user123",
        jti: "refresh-jwt-id-123",
        iat: Math.floor(Date.now() / 1000) - 8 * 24 * 60 * 60, // 8 days ago
        exp: Math.floor(Date.now() / 1000) - 24 * 60 * 60, // 1 day ago (expired)
      };

      const token = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET!, {
        issuer: "rag-app",
        audience: "rag-client",
      });

      const result = AuthService.validateRefreshToken(token);
      expect(result).toBeNull();
    });
  });

  describe("refreshAccessToken", () => {
    it("should refresh access token with valid refresh token", async () => {
      const refreshPayload: RefreshTokenPayload = {
        userId: "user123",
        jti: "refresh-jwt-id-123",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
      };

      const refreshToken = jwt.sign(refreshPayload, "test-refresh-secret", {
        issuer: "rag-app",
        audience: "rag-client",
      });

      // Mock database response
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            user_id: "user123",
            email: "test@example.com",
            first_name: "John",
            last_name: "Doe",
            role: "user",
            is_verified: true,
            is_active: true,
            refresh_token_hash: "hashed-refresh-token",
            user_agent: "test-agent",
            ip_address: "127.0.0.1",
          },
        ],
      });

      // PasswordService is already mocked at the top of the file

      // Mock generateTokens to return new tokens
      const generateTokensSpy = jest
        .spyOn(AuthService, "generateTokens")
        .mockResolvedValue({
          success: true,
          accessToken: "new-access-token",
          refreshToken: "new-refresh-token",
        });

      mockClient.query.mockResolvedValueOnce({ rowCount: 1 }); // For revoke old session

      const result = await AuthService.refreshAccessToken(
        refreshToken,
        mockPool
      );

      expect(result).toEqual({
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
      });

      expect(generateTokensSpy).toHaveBeenCalled();
    });

    it("should return null for invalid refresh token", async () => {
      const result = await AuthService.refreshAccessToken(
        "invalid-token",
        mockPool
      );
      expect(result).toBeNull();
    });

    it("should return null when session is not found", async () => {
      const refreshPayload: RefreshTokenPayload = {
        userId: "user123",
        jti: "refresh-jwt-id-123",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
      };

      const refreshToken = jwt.sign(refreshPayload, "test-refresh-secret", {
        issuer: "rag-app",
        audience: "rag-client",
      });

      mockClient.query.mockResolvedValueOnce({ rows: [] }); // No session found

      const result = await AuthService.refreshAccessToken(
        refreshToken,
        mockPool
      );
      expect(result).toBeNull();
    });

    it("should return null when user is inactive", async () => {
      const refreshPayload: RefreshTokenPayload = {
        userId: "user123",
        jti: "refresh-jwt-id-123",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
      };

      const refreshToken = jwt.sign(refreshPayload, "test-refresh-secret", {
        issuer: "rag-app",
        audience: "rag-client",
      });

      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            user_id: "user123",
            email: "test@example.com",
            first_name: "John",
            last_name: "Doe",
            role: "user",
            is_verified: true,
            is_active: false, // Inactive user
            refresh_token_hash: "hashed-refresh-token",
            user_agent: "test-agent",
            ip_address: "127.0.0.1",
          },
        ],
      });

      const result = await AuthService.refreshAccessToken(
        refreshToken,
        mockPool
      );
      expect(result).toBeNull();
    });
  });

  describe("revokeSession", () => {
    it("should revoke a session successfully", async () => {
      mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await AuthService.revokeSession("jwt-id-123", mockPool);

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        "UPDATE user_sessions SET is_revoked = TRUE WHERE token_jti = $1",
        ["jwt-id-123"]
      );
    });

    it("should return false when no session is found", async () => {
      mockClient.query.mockResolvedValueOnce({ rowCount: 0 });

      const result = await AuthService.revokeSession("jwt-id-123", mockPool);

      expect(result).toBe(false);
    });

    it("should handle database errors gracefully", async () => {
      mockClient.query.mockRejectedValueOnce(new Error("Database error"));

      const result = await AuthService.revokeSession("jwt-id-123", mockPool);

      expect(result).toBe(false);
    });
  });

  describe("revokeAllUserSessions", () => {
    it("should revoke all sessions for a user", async () => {
      mockClient.query.mockResolvedValueOnce({ rowCount: 3 });

      const result = await AuthService.revokeAllUserSessions(
        "user123",
        mockPool
      );

      expect(result).toBe(3);
      expect(mockClient.query).toHaveBeenCalledWith(
        "UPDATE user_sessions SET is_revoked = TRUE WHERE user_id = $1 AND is_revoked = FALSE",
        ["user123"]
      );
    });

    it("should return 0 when no sessions are found", async () => {
      mockClient.query.mockResolvedValueOnce({ rowCount: 0 });

      const result = await AuthService.revokeAllUserSessions(
        "user123",
        mockPool
      );

      expect(result).toBe(0);
    });
  });

  describe("getUserSessions", () => {
    it("should return user sessions", async () => {
      const mockSessions = [
        {
          id: "session1",
          user_id: "user123",
          token_jti: "jwt-id-1",
          expires_at: new Date("2024-12-31"),
          created_at: new Date("2024-01-01"),
          user_agent: "Mozilla/5.0",
          ip_address: "127.0.0.1",
        },
        {
          id: "session2",
          user_id: "user123",
          token_jti: "jwt-id-2",
          expires_at: new Date("2024-12-30"),
          created_at: new Date("2024-01-02"),
          user_agent: "Chrome/91.0",
          ip_address: "192.168.1.1",
        },
      ];

      mockClient.query.mockResolvedValueOnce({ rows: mockSessions });

      const result = await AuthService.getUserSessions("user123", mockPool);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "session1",
        userId: "user123",
        tokenJti: "jwt-id-1",
        expiresAt: new Date("2024-12-31"),
        createdAt: new Date("2024-01-01"),
        userAgent: "Mozilla/5.0",
        ipAddress: "127.0.0.1",
      });
    });

    it("should return empty array when no sessions found", async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await AuthService.getUserSessions("user123", mockPool);

      expect(result).toEqual([]);
    });
  });
});
