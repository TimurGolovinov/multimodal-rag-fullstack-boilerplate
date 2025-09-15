import { useState, useEffect, useRef, useCallback } from "react";

export interface SSEEvent {
  type: "connected" | "chunk" | "complete" | "error";
  content?: string;
  timestamp: string;
  error?: string;
  messageId?: string;
}

export interface UseSSEOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
  onChunk?: (chunk: SSEEvent) => void;
  onComplete?: (event: SSEEvent) => void;
}

export const useSSE = (url: string, options: UseSSEOptions = {}) => {
  const [data, setData] = useState<SSEEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource(url, {
        withCredentials: true,
      });

      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log("🔌 SSE connection opened");
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
        options.onConnect?.();
      };

      eventSource.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data) as SSEEvent;
          setData((prev) => [...prev, parsedData]);

          // Call appropriate callbacks
          switch (parsedData.type) {
            case "chunk":
              options.onChunk?.(parsedData);
              break;
            case "complete":
              options.onComplete?.(parsedData);
              break;
            case "error":
              options.onError?.(parsedData.error || "Unknown error");
              break;
          }
        } catch (err) {
          console.error("Failed to parse SSE data:", err);
          setError("Failed to parse server data");
        }
      };

      eventSource.onerror = (err) => {
        console.error("SSE connection error:", err);
        setIsConnected(false);
        setError("Connection failed");
        options.onError?.("Connection failed");

        // Attempt to reconnect
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttempts.current),
            30000
          );
          console.log(
            `🔄 Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.error("❌ Max reconnection attempts reached");
          setError("Connection lost. Please refresh the page.");
        }
      };
    } catch (err) {
      console.error("Failed to create SSE connection:", err);
      setError("Failed to create connection");
    }
  }, [url, options]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsConnected(false);
    options.onDisconnect?.();
  }, [options]);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  const clearData = useCallback(() => {
    setData([]);
  }, []);

  return {
    data,
    isConnected,
    error,
    connect,
    disconnect,
    clearData,
  };
};

