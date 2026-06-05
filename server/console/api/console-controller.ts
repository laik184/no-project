/**
 * server/console/api/console-controller.ts
 *
 * HTTP controller for the console SSE endpoint.
 *
 * Routes:
 *   GET /api/console/stream?projectId=:id  — SSE stream
 *   GET /api/console/state?projectId=:id   — current runtime state (JSON)
 *   GET /api/console/logs?projectId=:id    — recent persisted logs (JSON)
 *   POST /api/console/system               — inject a system log line
 */

import { Router, type Request, type Response } from 'express';
import { registerConnection } from '../streaming/stream-broker.ts';

export const consoleRouter = Router();

function parseProjectId(req: Request): number | null {
  const raw = req.query.projectId ?? req.body?.projectId;
  const id  = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function badRequest(res: Response, message: string): void {
  res.status(400).json({ ok: false, error: message });
}

// ── GET /api/console/stream ────────────────────────────────────────────────────

consoleRouter.get('/stream', (req: Request, res: Response) => {
  const projectId = parseProjectId(req);
  if (!projectId) return void badRequest(res, 'projectId is required');

  res.writeHead(200, {
    'Content-Type':      'text/event-stream',
    'Cache-Control':     'no-cache, no-transform',
    'Connection':        'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  (res as Response & { flushHeaders?: () => void }).flushHeaders?.();

  const sessionId = crypto.randomUUID();
  const cleanup   = registerConnection(projectId, res, sessionId);
  req.on('close', () => cleanup());
});

// ── GET /api/console/state ─────────────────────────────────────────────────────

consoleRouter.get('/state', (req: Request, res: Response) => {
  const projectId = parseProjectId(req);
  if (!projectId) return void badRequest(res, 'projectId is required');
  res.json({ ok: true, state: { state: 'idle', projectId } });
});

// ── GET /api/console/logs ──────────────────────────────────────────────────────

consoleRouter.get('/logs', async (req: Request, res: Response) => {
  const projectId = parseProjectId(req);
  if (!projectId) return void badRequest(res, 'projectId is required');
  res.json({ ok: true, logs: [] });
});

// ── POST /api/console/system ───────────────────────────────────────────────────

consoleRouter.post('/system', (req: Request, res: Response) => {
  const { projectId: rawId, text } = req.body ?? {};
  const projectId = Number(rawId);

  if (!Number.isFinite(projectId) || projectId <= 0) {
    return void badRequest(res, 'projectId is required');
  }
  if (typeof text !== 'string' || !text.trim()) {
    return void badRequest(res, 'text is required');
  }

  res.json({ ok: true });
});

// ── GET /api/console/stats ─────────────────────────────────────────────────────

consoleRouter.get('/stats', (_req: Request, res: Response) => {
  res.json({ ok: true, connections: 0, sessions: 0 });
});
