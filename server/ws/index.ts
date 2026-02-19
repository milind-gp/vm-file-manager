import type { WebSocket } from "ws";
import type { IncomingMessage } from "http";
import { handleTerminalMessage } from "./terminal.handler";
import { handleTransferMessage, cleanupStaleTransfers } from "./transfer.handler";

export interface WSMessage {
  type: string;
  id?: string;
  connectionId: string;
  payload: Record<string, unknown>;
}

export interface WSResponse {
  type: string;
  id?: string;
  connectionId?: string;
  payload: Record<string, unknown>;
  error?: string;
}

export function sendMessage(ws: WebSocket, message: WSResponse) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function sendError(ws: WebSocket, type: string, error: string, id?: string, connectionId?: string) {
  sendMessage(ws, { type, error, id, connectionId, payload: {} });
}

export function handleWebSocketConnection(ws: WebSocket, _request: IncomingMessage) {
  console.log("[WS] Client connected");

  ws.on("message", (data) => {
    let message: WSMessage;
    try {
      message = JSON.parse(data.toString());
    } catch {
      sendError(ws, "error", "Invalid JSON message");
      return;
    }

    if (!message.type) {
      sendError(ws, "error", "Missing message type");
      return;
    }

    const [domain] = message.type.split(":");

    switch (domain) {
      case "terminal":
        handleTerminalMessage(ws, message);
        break;
      case "transfer":
        handleTransferMessage(ws, message);
        break;
      default:
        sendError(ws, "error", `Unknown message domain: ${domain}`);
    }
  });

  ws.on("close", () => {
    console.log("[WS] Client disconnected");
    handleTerminalMessage(ws, {
      type: "terminal:cleanup",
      connectionId: "__all__",
      payload: {},
    });
    cleanupStaleTransfers();
  });

  ws.on("error", (err) => {
    console.error("[WS] Error:", err.message);
  });
}
