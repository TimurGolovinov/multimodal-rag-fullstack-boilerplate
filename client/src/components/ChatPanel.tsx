import { useState, useCallback, useEffect } from "react";
import type { ChatResponse } from "../types";
import { API_BASE } from "../constants";
import { useAuth } from "../contexts/AuthContext";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  documentIds: string[];
  timestamp: string;
  metadata: Record<string, unknown>;
}

export function ChatPanel() {
  const { isAuthenticated, user } = useAuth();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(user?.id || "default"); // Use user ID as session ID

  // Update session ID when user changes
  useEffect(() => {
    if (user?.id) {
      console.log(`🔄 Switching to user session: ${user.id}`);
      setSessionId(user.id);
    } else {
      console.log("🔄 Switching to default session (no user)");
      setSessionId("default");
    }
  }, [user?.id]);

  // Helper function to create authenticated fetch headers
  const getAuthHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add Authorization header if token exists
    const accessToken = localStorage.getItem("accessToken");
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    // Add CSRF token if exists
    const csrfToken = localStorage.getItem("csrfToken");
    if (csrfToken) {
      headers["x-csrf-token"] = csrfToken;
    }

    return headers;
  }, []);

  // Load chat history when component mounts or user authenticates
  const loadChatHistory = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const res = await fetch(
        `${API_BASE}/api/chat/history?sessionId=${sessionId}`,
        {
          method: "GET",
          headers: getAuthHeaders(),
          credentials: "include",
        }
      );

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.history) {
          setMessages(data.history);
        }
      }
    } catch (error) {
      console.error("Failed to load chat history:", error);
    }
  }, [isAuthenticated, sessionId, getAuthHeaders]);

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
          setMessages([]);
          console.log("Chat history cleared successfully");
        }
      }
    } catch (error) {
      console.error("Failed to clear chat history:", error);
    }
  }, [isAuthenticated, sessionId, getAuthHeaders]);

  // Load chat history on mount and when authentication or session changes
  useEffect(() => {
    loadChatHistory();
  }, [loadChatHistory, sessionId]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;

    if (!isAuthenticated) {
      console.error("User not authenticated, cannot send chat messages");
      return;
    }

    // Add user message to local state immediately
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: text,
      documentIds: [],
      timestamp: new Date().toISOString(),
      metadata: {},
    };
    setMessages((m) => [...m, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({
          message: text,
          sessionId: sessionId,
        }),
      });
      const data: ChatResponse = await res.json();
      const answer = data.success ? data.message : `Error: ${data.message}`;

      // Add assistant message to local state
      const assistantMessage: ChatMessage = {
        id: data.messageId || `temp-${Date.now()}`,
        role: "assistant",
        content: answer,
        documentIds: data.sources?.map((s) => s.id) || [],
        timestamp: new Date().toISOString(),
        metadata: {},
      };
      setMessages((m) => [...m, assistantMessage]);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      const errorChatMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `Error: ${errorMessage}`,
        documentIds: [],
        timestamp: new Date().toISOString(),
        metadata: {},
      };
      setMessages((m) => [...m, errorChatMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="chat-panel">
      <div className="chat-header">
        <h3>Chat History</h3>
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
      </div>

      <div className="chat-box">
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>No messages yet. Start a conversation!</p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`msg ${m.role}`}>
              <div className="msg-content">{m.content}</div>
              <div className="msg-timestamp">
                {new Date(m.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="msg assistant loading">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
      </div>
      <div className="input-container">
        <div className="input-wrapper">
          <input
            placeholder="Ask about your documents..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            className="chat-input"
            disabled={!isAuthenticated}
          />
          <div className="input-buttons">
            <button
              onClick={send}
              disabled={loading || !input.trim() || !isAuthenticated}
              className="send-button primary"
            >
              <span className="button-icon">→</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
