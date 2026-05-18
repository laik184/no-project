/**
 * ws-server.ts — WebSocket server for the NURA X API.
 *
 * ONLY ROUTE: /ws/terminal?projectId=N
 *
 * WebSocket is the correct transport here because the terminal requires
 * *bidirectional* communication (stdin writes from client, stdout/stderr
 * reads from server). All one-way event streams (agent events, file
 * changes, console logs) use the unified SSE endpoint /api/realtime instead.
 *
 * Previously dead routes that have been removed:
 *   /ws/agent/:runId   — duplicated SSE; zero frontend consumers
 *   /ws/execute/:id    — API endpoint never existed; ExecutionClient unused
 *   /ws/files/:id      — duplicated SSE file watcher; zero frontend consumers
 */

import type { Server as HttpServer, IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { ensureProjectDir, projectRoot } from "../../infrastructure/sandbox/sandbox.util.ts";

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeSend(ws: WebSocket, payload: unknown): void {
  if (ws.readyState !== ws.OPEN) return;
  try { ws.send(JSON.stringify(payload)); } catch { }
}

// ── Attachment ────────────────────────────────────────────────────────────────

export function attachWebSocketServer(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    const pathname = new URL(req.url || "/", "http://localhost").pathname;

    // Let Vite and Replit handle their own upgrade requests
    if (
      pathname.startsWith("/@vite/") ||
      pathname.startsWith("/__vite") ||
      pathname.startsWith("/__replco")
    ) {
      return;
    }

    if (pathname === "/ws/terminal") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const url       = new URL(req.url || "/", "http://localhost");
    const projectId = Number(url.searchParams.get("projectId"));
    handleTerminal(ws, Number.isFinite(projectId) && projectId > 0 ? projectId : null);
  });

  console.log("[nura-x] WebSocket server attached: /ws/terminal");
}

// ── Terminal handler ──────────────────────────────────────────────────────────

async function handleTerminal(ws: WebSocket, projectId: number | null): Promise<void> {
  if (!projectId) {
    safeSend(ws, {
      type: "error",
      data: "projectId query parameter is required. Terminal sessions are sandbox-scoped.",
    });
    ws.close(1008, "projectId required");
    return;
  }

  await ensureProjectDir(projectId);
  const cwd = projectRoot(projectId);

  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn("bash", ["-i"], {
      cwd,
      env: { ...process.env, TERM: "xterm-256color", PS1: "$ " },
    }) as ChildProcessWithoutNullStreams;
  } catch (e: any) {
    safeSend(ws, { type: "error", data: e.message });
    ws.close();
    return;
  }

  child.stdout.on("data", (chunk: Buffer) =>
    safeSend(ws, { type: "stdout", data: chunk.toString() }),
  );
  child.stderr.on("data", (chunk: Buffer) =>
    safeSend(ws, { type: "stdout", data: chunk.toString() }),
  );
  child.on("exit", (code) => {
    safeSend(ws, { type: "exit", data: code });
    ws.close();
  });

  ws.on("message", (msg) => {
    try {
      const parsed = JSON.parse(msg.toString()) as { type?: string; data?: string };
      if (parsed.type === "stdin" && typeof parsed.data === "string") {
        child.stdin.write(parsed.data);
      }
    } catch {
      child.stdin.write(msg.toString());
    }
  });

  ws.on("close", () => { try { child.kill(); } catch {} });

  safeSend(ws, { type: "ready", data: { cwd } });
}
