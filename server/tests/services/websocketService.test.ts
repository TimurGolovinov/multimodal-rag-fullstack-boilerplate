import {
  WebSocketService,
  WebSocketClient,
  WebSocketMessage,
} from "../../src/services/websocketService";
import { AuthService } from "../../src/services/authService";

// Mock WebSocket
jest.mock("ws", () => {
  const mockWebSocket = jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    ping: jest.fn(),
    readyState: 1, // OPEN
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  }));

  const mockServer = jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn(),
  }));

  // Make Server available as a property of the default export
  mockWebSocket.Server = mockServer;

  return {
    __esModule: true,
    default: mockWebSocket,
    Server: mockServer,
  };
});

// Mock AuthService
jest.mock("../../src/services/authService", () => ({
  AuthService: {
    validateAccessToken: jest.fn(),
  },
}));

describe("WebSocketService", () => {
  let wsService: WebSocketService;
  let mockServer: any;
  let mockWebSocket: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockServer = { on: jest.fn() };
    wsService = new WebSocketService(mockServer);
    mockWebSocket = require("ws").default;
  });

  describe("verifyClient", () => {
    it("should accept valid token", async () => {
      const mockToken = "valid-token";
      const mockUser = { userId: "user-123", email: "test@example.com" };

      (AuthService.validateAccessToken as jest.Mock).mockReturnValue(mockUser);

      const mockReq = {
        headers: {
          authorization: `Bearer ${mockToken}`,
        },
      };

      const result = await wsService["verifyClient"]({
        origin: "http://localhost:3000",
        secure: false,
        req: mockReq as any,
      });

      expect(result).toBe(true);
      expect(AuthService.validateAccessToken).toHaveBeenCalledWith(mockToken);
    });

    it("should reject invalid token", async () => {
      (AuthService.validateAccessToken as jest.Mock).mockReturnValue(null);

      const mockReq = {
        headers: {
          authorization: "Bearer invalid-token",
        },
      };

      const result = await wsService["verifyClient"]({
        origin: "http://localhost:3000",
        secure: false,
        req: mockReq as any,
      });

      expect(result).toBe(false);
    });

    it("should reject request without token", async () => {
      const mockReq = {
        headers: {},
      };

      const result = await wsService["verifyClient"]({
        origin: "http://localhost:3000",
        secure: false,
        req: mockReq as any,
      });

      expect(result).toBe(false);
    });

    it("should extract token from query parameters", async () => {
      const mockToken = "valid-token";
      const mockUser = { userId: "user-123", email: "test@example.com" };

      (AuthService.validateAccessToken as jest.Mock).mockReturnValue(mockUser);

      const mockReq = {
        headers: {},
        url: `http://localhost:3000/ws?token=${mockToken}`,
      };

      const result = await wsService["verifyClient"]({
        origin: "http://localhost:3000",
        secure: false,
        req: mockReq as any,
      });

      expect(result).toBe(true);
      expect(AuthService.validateAccessToken).toHaveBeenCalledWith(mockToken);
    });
  });

  describe("handleMessage", () => {
    let mockClient: WebSocketClient;
    let mockWs: any;

    beforeEach(() => {
      mockWs = {
        on: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        ping: jest.fn(),
        readyState: 1,
      };

      mockClient = {
        id: "client-123",
        userId: "user-123",
        sessionId: "session-123",
        ws: mockWs,
        isAlive: true,
        lastActivity: new Date(),
      };

      // Mock the broadcastToSession method
      jest
        .spyOn(wsService as any, "broadcastToSession")
        .mockImplementation(() => {});
    });

    it("should handle typing message", () => {
      const message: WebSocketMessage = {
        type: "typing",
        data: { isTyping: true },
        timestamp: new Date().toISOString(),
      };

      wsService["handleMessage"]("client-123", JSON.stringify(message));

      expect(wsService["broadcastToSession"]).toHaveBeenCalledWith(
        "session-123",
        expect.objectContaining({
          type: "typing",
          data: {
            userId: "user-123",
            isTyping: true,
          },
        }),
        "client-123"
      );
    });

    it("should handle stop_typing message", () => {
      const message: WebSocketMessage = {
        type: "stop_typing",
        data: { isTyping: false },
        timestamp: new Date().toISOString(),
      };

      wsService["handleMessage"]("client-123", JSON.stringify(message));

      expect(wsService["broadcastToSession"]).toHaveBeenCalledWith(
        "session-123",
        expect.objectContaining({
          type: "stop_typing",
          data: {
            userId: "user-123",
            isTyping: false,
          },
        }),
        "client-123"
      );
    });

    it("should handle presence message", () => {
      const message: WebSocketMessage = {
        type: "presence",
        data: { status: "online" },
        timestamp: new Date().toISOString(),
      };

      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      wsService["handleMessage"]("client-123", JSON.stringify(message));

      expect(consoleSpy).toHaveBeenCalledWith(
        "Presence update from user-123:",
        { status: "online" }
      );

      consoleSpy.mockRestore();
    });

    it("should handle invalid JSON gracefully", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const sendToClientSpy = jest
        .spyOn(wsService as any, "sendToClient")
        .mockImplementation();

      wsService["handleMessage"]("client-123", "invalid json");

      expect(consoleSpy).toHaveBeenCalledWith(
        "❌ Error parsing WebSocket message from client-123:",
        expect.any(Error)
      );

      expect(sendToClientSpy).toHaveBeenCalledWith(
        "client-123",
        expect.objectContaining({
          type: "error",
          data: { message: "Invalid message format" },
        })
      );

      consoleSpy.mockRestore();
      sendToClientSpy.mockRestore();
    });
  });

  describe("getConnectedUsers", () => {
    it("should return all connected users", () => {
      const clients = new Map<string, WebSocketClient>();
      clients.set("client-1", {
        id: "client-1",
        userId: "user-1",
        sessionId: "session-1",
        ws: {} as any,
        isAlive: true,
        lastActivity: new Date(),
      });
      clients.set("client-2", {
        id: "client-2",
        userId: "user-2",
        sessionId: "session-1",
        ws: {} as any,
        isAlive: true,
        lastActivity: new Date(),
      });

      (wsService as any).clients = clients;

      const users = wsService.getConnectedUsers();
      expect(users).toEqual(["user-1", "user-2"]);
    });

    it("should return users for specific session", () => {
      const clients = new Map<string, WebSocketClient>();
      clients.set("client-1", {
        id: "client-1",
        userId: "user-1",
        sessionId: "session-1",
        ws: {} as any,
        isAlive: true,
        lastActivity: new Date(),
      });
      clients.set("client-2", {
        id: "client-2",
        userId: "user-2",
        sessionId: "session-2",
        ws: {} as any,
        isAlive: true,
        lastActivity: new Date(),
      });

      (wsService as any).clients = clients;

      const users = wsService.getConnectedUsers("session-1");
      expect(users).toEqual(["user-1"]);
    });
  });

  describe("getClientCount", () => {
    it("should return total client count", () => {
      const clients = new Map<string, WebSocketClient>();
      clients.set("client-1", {} as WebSocketClient);
      clients.set("client-2", {} as WebSocketClient);

      (wsService as any).clients = clients;

      expect(wsService.getClientCount()).toBe(2);
    });

    it("should return client count for specific session", () => {
      const clients = new Map<string, WebSocketClient>();
      clients.set("client-1", { sessionId: "session-1" } as WebSocketClient);
      clients.set("client-2", { sessionId: "session-2" } as WebSocketClient);
      clients.set("client-3", { sessionId: "session-1" } as WebSocketClient);

      (wsService as any).clients = clients;

      expect(wsService.getClientCount("session-1")).toBe(2);
      expect(wsService.getClientCount("session-2")).toBe(1);
    });
  });
});
