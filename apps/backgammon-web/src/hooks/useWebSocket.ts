import { useCallback, useEffect, useRef, useState } from "react";

type ServerMessage = Record<string, unknown> & { type: string };

export function useWebSocket(url: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);
  const handlersRef = useRef<Map<string, Set<(msg: ServerMessage) => void>>>(
    new Map()
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 2s
      setTimeout(connect, 2000);
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        setLastMessage(msg);
        const handlers = handlersRef.current.get(msg.type);
        if (handlers) {
          handlers.forEach((h) => h(msg));
        }
        // Also fire wildcard handlers
        const allHandlers = handlersRef.current.get("*");
        if (allHandlers) {
          allHandlers.forEach((h) => h(msg));
        }
      } catch {
        /* ignore parse errors */
      }
    };
  }, [url]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  const sendMessage = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const on = useCallback(
    (type: string, handler: (msg: ServerMessage) => void) => {
      if (!handlersRef.current.has(type)) {
        handlersRef.current.set(type, new Set());
      }
      handlersRef.current.get(type)!.add(handler);
      return () => {
        handlersRef.current.get(type)?.delete(handler);
      };
    },
    []
  );

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return { connect, disconnect, sendMessage, connected, lastMessage, on };
}
