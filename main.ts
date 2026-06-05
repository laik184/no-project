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

import { consoleRouter, consoleService } from './server/console/index.ts';

// ── Global error safety net ───────────────────────────────────────────────────
// Must run before any async code so uncaught exceptions are captured.

installGlobalHandlers();

// ── App setup ─────────────────────────────────────────────────────────────────

const app  = express();
const PORT = Number(process.env.API_PORT ?? 3001);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Console module ────────────────────────────────────────────────────────────
// Init SSE broker and subsystems before any route mounts.

consoleService.init();

// ── Memory platform ───────────────────────────────────────────────────────────
// Must run before any module that stores to or reads from memoryEngine.

bootstrapMemory();

// ── Tool registry ─────────────────────────────────────────────────────────────
// Must run after bootstrapMemory() and before any agent dispatch.
// Registers all 177 tools across 6 categories and seals the registry.

loadAllTools();

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// ── /api/realtime — shared SSE stream for all topics ─────────────────────────
//
// The frontend RealtimeProvider connects here once and subscribes to all topics.
// Events are sent as NAMED SSE events ("event: <topic>\ndata: ...\n\n") so that
// the browser's addEventListener(topic, cb) fires correctly.
// Query params: projectId (optional) — scopes broadcast to a single project.

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

  // Subscribe to ALL known topics so the client receives everything.
  const topicSet = new Set<string>(Object.values(TOPIC));

  const cleanup = sseManager.register(
    res,
    topicSet as unknown as ReadonlySet<string>,
    projectId,
    runId,
  );

  req.on('close', () => cleanup());
});

// ── Stub routes for frontend-expected endpoints ───────────────────────────────

// Project execution status — used by useNavigationLogic & preview-runtime.service
app.get('/api/project-status', (_req: Request, res: Response) => {
  res.json({ ok: true, running: [] });
});

// Tunnel / public URL info — used by useNavigationLogic
app.get('/api/tunnel-info', (_req: Request, res: Response) => {
  const domain = process.env.REPLIT_DEV_DOMAIN;
  res.json({ ok: true, url: domain ? `https://${domain}` : null });
});

// Runtime start/stop — used by preview panel (fire-and-forget stubs)
app.post('/api/run-project',  (_req: Request, res: Response) => res.json({ ok: true }));
app.post('/api/stop-project', (_req: Request, res: Response) => res.json({ ok: true }));
app.post('/api/preview-state', (_req: Request, res: Response) => res.json({ ok: true }));

// Artifacts list stub
app.get('/api/artifacts', (_req: Request, res: Response) => res.json({ ok: true, artifacts: [] }));

// ── Mount modules ─────────────────────────────────────────────────────────────

// Chat module: /api/chat/* (SSE at /api/chat/stream) + /api/run/*
chatOrchestrator.mountRoutes(app);

// Orchestration: /api/orchestration/*
app.use('/api/orchestration', createOrchestrationRouter());

// Console module: /api/console/* (SSE stream + state + logs)
app.use('/api/console', consoleRouter);

// File Explorer: /api/file-explorer/* (canonical REST routes)
app.use('/api/file-explorer', fileExplorerRouter);

// File Explorer legacy aliases — serve the exact URLs the frontend calls:
//   GET  /api/list-files, /api/read-file, /api/files/stat, /api/file/history
//   POST /api/save-file, /api/rename-file, /api/delete-file,
//        /api/duplicate-file, /api/file/undo, /api/file/conflict-check
// Must be mounted AFTER /api/file-explorer so the canonical routes take priority.
app.use('/api', legacyFileRouter);

// ── HTTP server ───────────────────────────────────────────────────────────────

const server = http.createServer(app);

// Chat WebSocket + heartbeat (must run after server creation)
chatOrchestrator.bootstrap(server);

// ── Start ─────────────────────────────────────────────────────────────────────

initOrchestration();

// Bridge agent file-change events → TOPIC.FILE SSE fan-out
subscribeToAgentFileEvents();

// Seed DB then start listening
seedDefaultProject()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[server] API server listening on port ${PORT}`);
      // Start sandbox filesystem watchers (fire-and-forget)
      startFileWatcher().catch((err) => console.error('[file-watcher] Failed to start:', err));
      startDirectoryWatcher().catch((err) => console.error('[dir-watcher] Failed to start:', err));
    });
  })
  .catch((err) => {
    console.error('[server] Startup seed failed:', err);
    process.exit(1);
  });

// ── Express error middleware ──────────────────────────────────────────────────
// Must be last — catches any unhandled error thrown inside route handlers.

app.use(expressErrorMiddleware);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[server] SIGTERM received — shutting down');
  server.close(() => process.exit(0));
});
