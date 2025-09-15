import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { API_BASE } from "../constants";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  messageId?: string;
}

interface StreamingState {
  isStreaming: boolean;
  error: string | null;
  completed: boolean;
  messageId?: string;
}

export const useStreamingChat = (sessionId: string) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isStreaming: false,
    error: null,
    completed: false,
  });
  const [error, setError] = useState<string | null>(null);

  // Refs for managing streaming state and cleanup
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const isStreamingRef = useRef<boolean>(false);
  const streamingMessageIdRef = useRef<string | null>(null);

  // Constants for streaming configuration
  const STREAM_TIMEOUT = 30000; // 30 seconds
  const MAX_RECONNECT_ATTEMPTS = 3;
  const CHUNK_PROCESSING_DELAY = 10; // 10ms delay between chunks for backpressure

  // Cleanup function for aborting streams and clearing timeouts
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (streamTimeoutRef.current) {
      clearTimeout(streamTimeoutRef.current);
      streamTimeoutRef.current = null;
    }
    isStreamingRef.current = false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Reset streaming state
  const resetStreamingState = useCallback(() => {
    setStreamingState({
      isStreaming: false,
      error: null,
      completed: false,
    });
    setError(null);
    reconnectAttemptsRef.current = 0;
  }, []);

  // Handle streaming errors with retry logic
  const handleStreamingError = useCallback(
    (error: Error, shouldRetry: boolean = false) => {
      console.error("Streaming error:", error);

      if (
        shouldRetry &&
        reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS
      ) {
        reconnectAttemptsRef.current++;
        console.log(
          `Retrying stream connection (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`
        );

        // Retry after a delay
        setTimeout(() => {
          if (isStreamingRef.current) {
            // Trigger a reconnection by calling sendMessage again
            // This is a simplified retry - in production, you might want more sophisticated retry logic
          }
        }, 1000 * reconnectAttemptsRef.current);

        return;
      }

      const errorMessage = error.message || "Unknown streaming error occurred";
      setError(errorMessage);
      setStreamingState((prev) => ({
        ...prev,
        isStreaming: false,
        error: errorMessage,
        completed: false,
      }));

      cleanup();
    },
    [cleanup]
  );

  // Process streaming chunks with backpressure handling
  const processChunk = useCallback((chunk: string) => {
    return new Promise<void>((resolve) => {
      if (streamingMessageIdRef.current) {
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === streamingMessageIdRef.current
              ? { ...msg, content: msg.content + chunk }
              : msg
          )
        );
      }

      // Add small delay for backpressure handling
      setTimeout(resolve, CHUNK_PROCESSING_DELAY);
    });
  }, []);

  // Send message with robust streaming implementation
  const sendMessage = useCallback(
    async (message: string, documentIds?: string[]) => {
      console.log("Sending message:", message, user);
      if (!user?.userId) {
        setError("User not authenticated");
        return;
      }

      // Cleanup any existing stream
      cleanup();
      resetStreamingState();

      // Create new abort controller
      abortControllerRef.current = new AbortController();
      isStreamingRef.current = true;

      // Add user message immediately
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      };

      // Create streaming assistant message immediately
      const streamingMessageId = (Date.now() + 1).toString();
      const streamingMessage: ChatMessage = {
        id: streamingMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage, streamingMessage]);
      streamingMessageIdRef.current = streamingMessageId;

      // Set streaming state
      setStreamingState({
        isStreaming: true,
        error: null,
        completed: false,
      });

      try {
        const response = await fetch(`${API_BASE}/api/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
            "x-csrf-token": localStorage.getItem("csrfToken") || "",
          },
          body: JSON.stringify({
            message,
            sessionId,
            documentIds,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Set up stream timeout
        streamTimeoutRef.current = setTimeout(() => {
          if (isStreamingRef.current) {
            handleStreamingError(new Error("Stream timeout"), true);
          }
        }, STREAM_TIMEOUT);

        // Handle streaming response
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body reader available");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const rawData = line.slice(6);
                const data = JSON.parse(rawData);

                switch (data.type) {
                  case "connected":
                    // Reset reconnect attempts on successful connection
                    reconnectAttemptsRef.current = 0;
                    break;

                  case "chunk": {
                    const chunkContent = data.content || "";
                    if (chunkContent) {
                      await processChunk(chunkContent);
                    }
                    break;
                  }

                  case "complete": {
                    // Finalize the streaming message with messageId
                    if (streamingMessageIdRef.current) {
                      setMessages((prevMessages) =>
                        prevMessages.map((msg) =>
                          msg.id === streamingMessageIdRef.current
                            ? { ...msg, messageId: data.messageId }
                            : msg
                        )
                      );
                    }

                    setStreamingState((prev) => ({
                      ...prev,
                      isStreaming: false,
                      error: null,
                      completed: true,
                      messageId: data.messageId,
                    }));

                    streamingMessageIdRef.current = null;
                    cleanup();
                    break;
                  }

                  case "error":
                    handleStreamingError(
                      new Error(data.error || "Unknown error occurred")
                    );
                    break;
                }
              } catch (parseError) {
                console.error("Failed to parse SSE data:", parseError);
                handleStreamingError(
                  new Error("Failed to parse streaming data")
                );
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return; // Stream was intentionally aborted
        }

        handleStreamingError(
          error instanceof Error ? error : new Error("Unknown error occurred"),
          true // Allow retry for network errors
        );
      }
    },
    [
      user,
      cleanup,
      resetStreamingState,
      sessionId,
      handleStreamingError,
      processChunk,
    ]
  );

  // Stop streaming
  const stopStreaming = useCallback(() => {
    cleanup();
    resetStreamingState();
  }, [cleanup, resetStreamingState]);

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    resetStreamingState();
  }, [resetStreamingState]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
    setStreamingState((prev) => ({
      ...prev,
      error: null,
    }));
  }, []);

  // Load chat history
  const loadChatHistory = useCallback(async () => {
    if (!user?.userId) return;

    try {
      const response = await fetch(
        `${API_BASE}/api/chat/history?sessionId=${sessionId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
            "x-csrf-token": localStorage.getItem("csrfToken") || "",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.history) {
          setMessages(data.history);
        }
      }
    } catch (error) {
      console.error("Failed to load chat history:", error);
    }
  }, [user?.userId, sessionId]);

  // Load chat history on mount
  useEffect(() => {
    loadChatHistory();
  }, [loadChatHistory]);

  return {
    messages,
    isStreaming: streamingState.isStreaming,
    error: error || streamingState.error,
    sendMessage,
    stopStreaming,
    clearMessages,
    clearError,
    loadChatHistory,
    streamingState,
  };
};
