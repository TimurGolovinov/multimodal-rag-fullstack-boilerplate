import { useState, useCallback, useEffect } from "react";
import { API_BASE } from "../constants";
import { useAuth } from "../contexts/AuthContext";
import { useStreamingChat } from "../hooks/useStreamingChat";

export function ChatPanel() {
  const { isAuthenticated, user } = useAuth();
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState(user?.userId || "default");

  // Use streaming chat hook
  const {
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearMessages,
    clearError,
  } = useStreamingChat(sessionId);

  // Update session ID when user changes
  useEffect(() => {
    if (user?.userId) {
      setSessionId(user.userId);
    } else {
      setSessionId("default");
    }
  }, [user?.userId]);

  // Helper function to create authenticated fetch headers
  const getAuthHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const accessToken = localStorage.getItem("accessToken");
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const csrfToken = localStorage.getItem("csrfToken");
    if (csrfToken) {
      headers["x-csrf-token"] = csrfToken;
    }

    return headers;
  }, []);

  // Clear chat history
  const clearChatHistory = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const res = await fetch(`${API_BASE}/api/chat/history`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ sessionId }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          clearMessages();
          console.log("Chat history cleared successfully");
        }
      }
    } catch (error) {
      console.error("Failed to clear chat history:", error);
    }
  }, [isAuthenticated, sessionId, getAuthHeaders, clearMessages]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInput(e.target.value);
    },
    []
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text) return;

    if (!isAuthenticated) {
      console.error("User not authenticated, cannot send chat messages");
      return;
    }

    setInput("");
    clearError();

    try {
      await sendMessage(text);
    } catch (error) {
      console.error("Chat error:", error);
    }
  }, [isAuthenticated, sendMessage, clearError, input]);

  return (
    <section className="chat-panel">
      <div className="chat-header-main">
        <h3>Chat History</h3>
      </div>

      <div className="chat-box">
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>No messages yet. Start a conversation!</p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`msg ${m.role} ${
                isStreaming && m.role === "assistant" && !m.messageId
                  ? "streaming"
                  : ""
              }`}
            >
              <div className="msg-content">
                {m.content ||
                  (isStreaming && m.role === "assistant" ? "Thinking..." : "")}
                {isStreaming &&
                  m.role === "assistant" &&
                  !m.messageId &&
                  m.content && <span className="streaming-cursor">|</span>}
              </div>
              <div className="msg-timestamp">
                {new Date(m.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}

        {/* Show error message */}
        {error && (
          <div className="msg assistant error">
            <div className="msg-content">
              <strong>Error:</strong> {error}
            </div>
            <div className="msg-timestamp">
              {new Date().toLocaleTimeString()}
            </div>
          </div>
        )}
      </div>
      <div className="input-container">
        {messages.length > 0 && (
          <button
            onClick={clearChatHistory}
            disabled={!isAuthenticated || messages.length === 0}
            className="clear-button"
            title="Clear chat history"
          >
            🗑️
          </button>
        )}
        <div className="input-wrapper">
          <input
            placeholder="Ask about your documents..."
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === "Enter" && send()}
            className="chat-input"
            disabled={!isAuthenticated}
          />
          <div className="input-buttons">
            {isStreaming ? (
              <button
                onClick={stopStreaming}
                className="send-button stop"
                title="Stop streaming"
              >
                <span className="button-icon">⏹</span>
              </button>
            ) : (
              <button
                onClick={send}
                disabled={!input.trim() || !isAuthenticated}
                className="send-button primary"
              >
                <span className="button-icon">→</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
