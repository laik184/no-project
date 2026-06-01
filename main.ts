/**
 * main.ts — Application entry point
 *
 * Boots all server modules and starts the HTTP server on port 3001.
 * The Vite dev server (port 5000) proxies /api, /sse, /events, /preview, /ws to this server.
 */

import http from 'http';
import express from 'express';
import type { Request, Response } from 'express';

import { bootstrapMemory }                            from './server/memory/index.ts';
import { chatOrchestrator }                           from './server/chat/index.ts';
import consolePipeline                                from './server/console/index.ts';
import previewPipeline                                from './server/preview/index.ts';
import { initOrchestration, createOrchestrationRouter } from './server/orchestration/index.ts';
import projectsRouter                                 from './server/projects/projects.router.ts';
import { seedDefaultProject }                         from './server/infrastructure/seed.ts';
import { TOPIC, sseManager }                          from './server/infrastructure/index.ts';
import {
  fileExplorerRouter,
  startFileWatcher,
  startDirectoryWatcher,
  subscribeToAgentFileEvents,
} from './server/file-explorer/index.ts';

// ── App setup ─────────────────────────────────────────────────────────────────

const app  = express();
const PORT = Number(process.env.API_PORT ?? 3001);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Memory platform ───────────────────────────────────────────────────────────
// Must run before any module that stores to or reads from memoryEngine.

bootstrapMemory();

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

// ── Mount modules ─────────────────────────────────────────────────────────────

// Chat module: /api/chat/* (SSE at /api/chat/stream) + /api/run/*
chatOrchestrator.mountRoutes(app);

// Console pipeline: /api/console/*
app.use('/api', consolePipeline);

// Preview pipeline: /api/preview/*, /api/run-project, /api/files/*, etc.
app.use('/api', previewPipeline);

// Orchestration: /api/orchestration/*
app.use('/api/orchestration', createOrchestrationRouter());

// Projects: /api/projects/*
app.use('/api', projectsRouter);

// File Explorer: /api/file-explorer/*
// Also registers legacy aliases (/api/file-explorer/list-files, etc.)
app.use('/api/file-explorer', fileExplorerRouter);

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

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[server] SIGTERM received — shutting down');
  server.close(() => process.exit(0));
});
