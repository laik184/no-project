/**
 * main.ts — Application entry point
 *
 * Boots all server modules and starts the HTTP server on port 3001.
 * The Vite dev server (port 5000) proxies /api, /sse, /events, /preview, /ws to this server.
 */

import http from 'http';
import express from 'express';
import type { Request, Response } from 'express';

import { installGlobalHandlers, expressErrorMiddleware } from './server/shared/errors/index.ts';

import { bootstrapMemory }                            from './server/memory/index.ts';
import { loadAllTools }                              from './server/tools/registry/tool-loader.ts';
import { chatOrchestrator }                           from './server/chat/index.ts';
import { initOrchestration, createOrchestrationRouter } from './server/orchestration/index.ts';
import { seedDefaultProject, TOPIC, sseManager }      from './server/infrastructure/index.ts';
import {
  fileExplorerRouter,
  legacyFileRouter,
  startFileWatcher,
  startDirectoryWatcher,
  subscribeToAgentFileEvents,
} from './server/file-explorer/index.ts';

// Console: router from module, service from service layer directly (avoids circular dep)
import { consoleRouter }  from './server/console/index.ts';
import { consoleService } from './server/services/console/index.ts';

// ── Global error safety net ───────────────────────────────────────────────────
installGlobalHandlers();

// ── App setup ─────────────────────────────────────────────────────────────────

const app  = express();
const PORT = Number(process.env.API_PORT ?? 3001);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Console module ────────────────────────────────────────────────────────────
consoleService.init();

// ── Memory platform ───────────────────────────────────────────────────────────
bootstrapMemory();

// ── Tool registry ─────────────────────────────────────────────────────────────
loadAllTools();

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// ── /api/realtime — shared SSE stream for all topics ─────────────────────────

app.get('/api/realtime', (req: Request, res: Response) => {
  const projectId = req.query.projectId ? Number(req.query.projectId) : null;
  const runId     = req.query.runId as string | undefined;

  res.writeHead(200, {
    'Content-Type':      'text/event-stream',
    'Cache-Control':     'no-cache, no-transform',
    'Connection':        'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  (res as any).flushHeaders?.();

  const topicSet = new Set<string>(Object.values(TOPIC));

  const cleanup = sseManager.register(
    res,
    topicSet as unknown as ReadonlySet<string>,
    projectId,
    runId,
  );

  req.on('close', () => cleanup());
});

// ── Stub routes ───────────────────────────────────────────────────────────────

app.get('/api/project-status', (_req: Request, res: Response) => {
  res.json({ ok: true, running: [] });
});

app.get('/api/tunnel-info', (_req: Request, res: Response) => {
  const domain = process.env.REPLIT_DEV_DOMAIN;
  res.json({ ok: true, url: domain ? `https://${domain}` : null });
});

app.post('/api/run-project',  (_req: Request, res: Response) => res.json({ ok: true }));
app.post('/api/stop-project', (_req: Request, res: Response) => res.json({ ok: true }));
app.post('/api/preview-state', (_req: Request, res: Response) => res.json({ ok: true }));
app.get('/api/artifacts', (_req: Request, res: Response) => res.json({ ok: true, artifacts: [] }));

// ── Mount modules ─────────────────────────────────────────────────────────────

chatOrchestrator.mountRoutes(app);
app.use('/api/orchestration', createOrchestrationRouter());
app.use('/api/console', consoleRouter);
app.use('/api/file-explorer', fileExplorerRouter);
app.use('/api', legacyFileRouter);

// ── HTTP server ───────────────────────────────────────────────────────────────

const server = http.createServer(app);
chatOrchestrator.bootstrap(server);

// ── Start ─────────────────────────────────────────────────────────────────────

initOrchestration();
subscribeToAgentFileEvents();

seedDefaultProject()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[server] API server listening on port ${PORT}`);
      startFileWatcher().catch((err) => console.error('[file-watcher] Failed to start:', err));
      startDirectoryWatcher().catch((err) => console.error('[dir-watcher] Failed to start:', err));
    });
  })
  .catch((err) => {
    console.error('[server] Startup seed failed:', err);
    process.exit(1);
  });

// ── Express error middleware ──────────────────────────────────────────────────
app.use(expressErrorMiddleware);

process.on('SIGTERM', () => {
  console.log('[server] SIGTERM received — shutting down');
  server.close(() => process.exit(0));
});
