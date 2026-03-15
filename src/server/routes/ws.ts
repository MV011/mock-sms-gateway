import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'node:http';
import type { AppContext } from '../context.js';

/**
 * Attaches a WebSocket server to the existing HTTP server on `/ws`.
 * Adds each client's send function to the broadcast set managed in AppContext.
 */
export function attachWebSocket(server: HttpServer, ctx: AppContext): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  const clients = new Set<(data: string) => void>();

  // Wire the broadcast function into AppContext so all routes can push events
  ctx.broadcast = (event: { type: string; data: unknown }) => {
    const payload = JSON.stringify(event);
    for (const send of clients) {
      try {
        send(payload);
      } catch {
        // Client already gone — will be cleaned up on close/error
      }
    }
  };

  wss.on('connection', (ws: WebSocket) => {
    const send = (data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    };

    clients.add(send);

    ws.on('close', () => {
      clients.delete(send);
    });

    ws.on('error', () => {
      clients.delete(send);
    });
  });
}
