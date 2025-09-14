import { useState, useCallback } from "react";
import type { ChatResponse } from "../types";
import { API_BASE } from "../constants";
import { useAuth } from "../contexts/AuthContext";

export function ChatPanel() {
  const { isAuthenticated } = useAuth();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [loading, setLoading] = useState(false);

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

  const send = async () => {
    const text = input.trim();
    if (!text) return;

    if (!isAuthenticated) {
      console.error("User not authenticated, cannot send chat messages");
      return;
    }

    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ message: text }),
      });
      const data: ChatResponse = await res.json();
      const answer = data.success ? data.message : `Error: ${data.message}`;
      setMessages((m) => [...m, { role: "assistant", content: answer }]);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Error: ${errorMessage}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="chat-panel">
      <div className="chat-box">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.content}
          </div>
        ))}
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
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="send-button primary"
          >
            <span className="button-icon">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}
