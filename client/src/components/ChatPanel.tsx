import { useState } from "react";
import type { ChatResponse } from "../types";
import { API_BASE } from "../constants";

export function ChatPanel() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/chat/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    <section className="panel chat-panel">
      <div className="panel-header">
        <h2>💬 Chat</h2>
        <div className="panel-subtitle">Ask questions about your documents</div>
      </div>
      <div className="chat-box">
        {messages.length === 0 && (
          <div className="chat-placeholder">
            <div className="placeholder-icon">💭</div>
            <div className="placeholder-text">
              Start a conversation about your documents
            </div>
          </div>
        )}
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
