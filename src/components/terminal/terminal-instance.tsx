"use client";

import { useEffect, useRef } from "react";
import { wsClient } from "@/lib/ws-client";

export function TerminalInstance({
  connectionId,
  sessionId,
}: {
  connectionId: string;
  sessionId: string;
}) {
  const termRef = useRef<HTMLDivElement>(null);
  const termInstanceRef = useRef<import("@xterm/xterm").Terminal | null>(null);
  const fitAddonRef = useRef<import("@xterm/addon-fit").FitAddon | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!termRef.current) return;

    let disposed = false;

    async function init() {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      const { WebLinksAddon } = await import("@xterm/addon-web-links");
      // @ts-expect-error CSS import
      await import("@xterm/xterm/css/xterm.css");

      if (disposed || !termRef.current) return;

      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: "var(--font-geist-mono), monospace",
        theme: {
          background: "#0a0a0a",
          foreground: "#e5e5e5",
          cursor: "#e5e5e5",
          selectionBackground: "#3b82f680",
        },
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);
      terminal.open(termRef.current);

      // Small delay for DOM to settle
      setTimeout(() => {
        if (!disposed) fitAddon.fit();
      }, 100);

      termInstanceRef.current = terminal;
      fitAddonRef.current = fitAddon;

      // Wait for WebSocket connection (with timeout)
      if (!wsClient.isConnected) {
        terminal.write("\x1b[33mConnecting to WebSocket...\x1b[0m\r\n");

        const connected = await new Promise<boolean>((resolve) => {
          const timeout = setTimeout(() => {
            unsub();
            resolve(false);
          }, 10_000);
          const unsub = wsClient.on("ws:connected", () => {
            clearTimeout(timeout);
            unsub();
            resolve(true);
          });
        });

        if (disposed) return;

        if (!connected) {
          terminal.write(
            "\x1b[31mFailed to connect to WebSocket. " +
            "Make sure you are running the app with 'npm run dev' (not 'next dev').\x1b[0m\r\n"
          );
          return;
        }
      }

      // Listen for errors from server
      const unsubError = wsClient.on("terminal:error", (msg) => {
        if (msg.connectionId === connectionId) {
          terminal.write(`\r\n\x1b[31m[Error: ${msg.error || "Unknown error"}]\x1b[0m\r\n`);
        }
      });

      // Open terminal on server
      wsClient.send({
        type: "terminal:open",
        connectionId,
        payload: { sessionId, cols: terminal.cols, rows: terminal.rows },
      });

      // Handle terminal output from server
      const unsubOutput = wsClient.on("terminal:output", (msg) => {
        if (msg.connectionId === connectionId && msg.payload.sessionId === sessionId) {
          const data = msg.payload.data as string;
          terminal.write(Uint8Array.from(atob(data), (c) => c.charCodeAt(0)));
        }
      });

      // Handle terminal closed by server
      const unsubClosed = wsClient.on("terminal:closed", (msg) => {
        if (msg.connectionId === connectionId && msg.payload.sessionId === sessionId) {
          terminal.write("\r\n\x1b[33m[Session ended]\x1b[0m\r\n");
        }
      });

      // Handle WebSocket disconnection during session
      const unsubDisconnect = wsClient.on("ws:disconnected", () => {
        terminal.write("\r\n\x1b[31m[WebSocket disconnected]\x1b[0m\r\n");
      });

      // Send input to server
      terminal.onData((data) => {
        wsClient.send({
          type: "terminal:input",
          connectionId,
          payload: { sessionId, data: btoa(data) },
        });
      });

      // Handle resize (debounced to avoid flooding WS messages)
      let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
      const resizeObserver = new ResizeObserver(() => {
        if (disposed) return;
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          if (disposed) return;
          fitAddon.fit();
          wsClient.send({
            type: "terminal:resize",
            connectionId,
            payload: { sessionId, cols: terminal.cols, rows: terminal.rows },
          });
        }, 100);
      });
      resizeObserver.observe(termRef.current);

      cleanupRef.current = () => {
        unsubOutput();
        unsubClosed();
        unsubError();
        unsubDisconnect();
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeObserver.disconnect();
        terminal.dispose();
        wsClient.send({
          type: "terminal:close",
          connectionId,
          payload: { sessionId },
        });
      };
    }

    init();

    return () => {
      disposed = true;
      cleanupRef.current?.();
    };
  }, [connectionId, sessionId]);

  return <div ref={termRef} className="h-full w-full" />;
}
