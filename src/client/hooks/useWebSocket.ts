import { useEffect, useRef, useCallback } from 'react';
import type { PhoneNumber, Message } from '../lib/api';

// ---------- WebSocket event types ----------

export interface WSMessageNew {
  type: 'message:new';
  data: Message;
}

export interface WSMessageStatus {
  type: 'message:status';
  data: { id: string; status: string };
}

export interface WSNumberCreated {
  type: 'number:created';
  data: PhoneNumber;
}

export interface WSNumberUpdated {
  type: 'number:updated';
  data: PhoneNumber;
}

export interface WSNumberDeleted {
  type: 'number:deleted';
  data: { id: string };
}

export interface WSMessagesCleared {
  type: 'messages:cleared';
  data: { phone_id: string | null };
}

export interface WSReset {
  type: 'reset';
  data: Record<string, never>;
}

export type WSEvent =
  | WSMessageNew
  | WSMessageStatus
  | WSNumberCreated
  | WSNumberUpdated
  | WSNumberDeleted
  | WSMessagesCleared
  | WSReset;

export interface WSHandlers {
  onMessageNew?: (msg: Message) => void;
  onMessageStatus?: (data: { id: string; status: string }) => void;
  onNumberCreated?: (phone: PhoneNumber) => void;
  onNumberUpdated?: (phone: PhoneNumber) => void;
  onNumberDeleted?: (data: { id: string }) => void;
  onMessagesCleared?: (data: { phone_id: string | null }) => void;
  onReset?: () => void;
}

const RECONNECT_DELAY = 2000;

export function useWebSocket(handlers: WSHandlers) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disposedRef = useRef(false);

  // Keep handlers ref current without triggering reconnect
  handlersRef.current = handlers;

  const connect = useCallback(() => {
    // Don't reconnect if the hook has been disposed (StrictMode cleanup)
    if (disposedRef.current) return;

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(url);

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as WSEvent;
        const h = handlersRef.current;

        switch (parsed.type) {
          case 'message:new':
            h.onMessageNew?.(parsed.data);
            break;
          case 'message:status':
            h.onMessageStatus?.(parsed.data);
            break;
          case 'number:created':
            h.onNumberCreated?.(parsed.data);
            break;
          case 'number:updated':
            h.onNumberUpdated?.(parsed.data);
            break;
          case 'number:deleted':
            h.onNumberDeleted?.(parsed.data);
            break;
          case 'messages:cleared':
            h.onMessagesCleared?.(parsed.data);
            break;
          case 'reset':
            h.onReset?.();
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      // Only reconnect if not disposed
      if (!disposedRef.current) {
        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, RECONNECT_DELAY);
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror, triggering reconnect
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    disposedRef.current = false;
    connect();

    return () => {
      disposedRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);
}
