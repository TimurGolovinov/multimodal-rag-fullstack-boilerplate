import { renderHook, act, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { useStreamingChat } from "../../hooks/useStreamingChat";
import { useAuth } from "../../contexts/AuthContext";

// Mock useAuth
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("useStreamingChat", () => {
  const mockUser = { id: "user-123", email: "test@example.com" };
  const mockAuth = { user: mockUser };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue(mockAuth);
    localStorage.setItem("accessToken", "test-token");
    localStorage.setItem("csrfToken", "test-csrf");
  });

  it("should initialize with empty state", () => {
    const { result } = renderHook(() => useStreamingChat("session-123"));

    expect(result.current.messages).toEqual([]);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should send message successfully", async () => {
    const mockResponse = {
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                'data: {"type":"connected","timestamp":"2023-01-01T00:00:00Z"}\n\n'
              ),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                'data: {"type":"chunk","content":"Hello","timestamp":"2023-01-01T00:00:00Z"}\n\n'
              ),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                'data: {"type":"chunk","content":" world","timestamp":"2023-01-01T00:00:00Z"}\n\n'
              ),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                'data: {"type":"complete","messageId":"msg-123","timestamp":"2023-01-01T00:00:00Z"}\n\n'
              ),
            })
            .mockResolvedValueOnce({ done: true, value: undefined }),
        }),
      },
    };

    mockFetch.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useStreamingChat("session-123"));

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/chat/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
        "x-csrf-token": "test-csrf",
      },
      body: JSON.stringify({
        message: "Hello",
        sessionId: "session-123",
        documentIds: [],
      }),
      signal: expect.any(AbortSignal),
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2); // User message + assistant message
      expect(result.current.messages[0].role).toBe("user");
      expect(result.current.messages[0].content).toBe("Hello");
      expect(result.current.messages[1].role).toBe("assistant");
      expect(result.current.messages[1].content).toBe("Hello world");
    });
  });

  it("should handle streaming errors", async () => {
    const mockResponse = {
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                'data: {"type":"error","error":"Streaming failed","timestamp":"2023-01-01T00:00:00Z"}\n\n'
              ),
            })
            .mockResolvedValueOnce({ done: true, value: undefined }),
        }),
      },
    };

    mockFetch.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useStreamingChat("session-123"));

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Streaming failed");
      expect(result.current.isStreaming).toBe(false);
    });
  });

  it("should handle network errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useStreamingChat("session-123"));

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Network error");
      expect(result.current.isStreaming).toBe(false);
    });
  });

  it("should handle unauthenticated user", async () => {
    (useAuth as any).mockReturnValue({ user: null });

    const { result } = renderHook(() => useStreamingChat("session-123"));

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    expect(result.current.error).toBe("User not authenticated");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should stop streaming", async () => {
    const mockAbortController = {
      abort: vi.fn(),
      signal: new AbortController().signal,
    };

    // Mock AbortController
    global.AbortController = vi.fn(() => mockAbortController) as any;

    const { result } = renderHook(() => useStreamingChat("session-123"));

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    act(() => {
      result.current.stopStreaming();
    });

    expect(mockAbortController.abort).toHaveBeenCalled();
    expect(result.current.isStreaming).toBe(false);
  });

  it("should clear messages", () => {
    const { result } = renderHook(() => useStreamingChat("session-123"));

    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("should clear error", () => {
    const { result } = renderHook(() => useStreamingChat("session-123"));

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it("should call onMessageComplete callback", async () => {
    const onMessageComplete = vi.fn();
    const mockResponse = {
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                'data: {"type":"connected","timestamp":"2023-01-01T00:00:00Z"}\n\n'
              ),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                'data: {"type":"complete","messageId":"msg-123","timestamp":"2023-01-01T00:00:00Z"}\n\n'
              ),
            })
            .mockResolvedValueOnce({ done: true, value: undefined }),
        }),
      },
    };

    mockFetch.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useStreamingChat("session-123"));

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    await waitFor(() => {
      expect(onMessageComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          role: "assistant",
          content: "",
          messageId: "msg-123",
        })
      );
    });
  });

  it("should call onError callback", async () => {
    const onError = vi.fn();
    const mockResponse = {
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                'data: {"type":"error","error":"Test error","timestamp":"2023-01-01T00:00:00Z"}\n\n'
              ),
            })
            .mockResolvedValueOnce({ done: true, value: undefined }),
        }),
      },
    };

    mockFetch.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useStreamingChat("session-123"));

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith("Test error");
    });
  });
});
