/**
 * main.ts — Application entry point
 *
 * Boots all server modules in the required dependency order:
 *
 *   bootstrap()
 *     ↓ registerInfrastructure()   — DB seed, infra wiring
 *     ↓ registerRepositories()     — (singletons — no explicit init needed)
 *     ↓ registerServices()         — memory platform, tool registry
 *     ↓ registerRoutes(app)        — mount all HTTP routers
 *     ↓ startHttpServer(app)       — bind port, start watchers
 *
 * The Vite dev server (port 5000) proxies /api, /sse, /events, /preview, /ws
 * to this server on port 3001.
 */

import http    from 'http';
import express, { type Express } from 'express';
import type { Request, Response } from 'express';

import { installGlobalHandlers, expressErrorMiddleware } from './server/shared/errors/index.ts';

import { bootstrapMemory }                               from './server/memory/index.ts';
import { loadAllTools }                                  from './server/tools/registry/tool-loader.ts';
import { chatOrchestrator }                              from './server/chat/index.ts';
import { initOrchestration, createOrchestrationRouter } from './server/orchestration/index.ts';
import { seedDefaultProject, TOPIC, sseManager }        from './server/infrastructure/index.ts';
import {
  fileExplorerRouter,
  legacyFileRouter,
  startFileWatcher,
  startDirectoryWatcher,
  subscribeToAgentFileEvents,
} from './server/file-explorer/index.ts';

// Terminal: router from the new terminal module.
import { terminalRouter } from './server/terminal/index.ts';

// Bus adapter wiring.
import { initBusAdapter } from './server/shared/events/bus-adapter.ts';
import { bus }            from './server/infrastructure/index.ts';

// Preview module.
import { initPreviewModule, buildPreviewRouter } from './server/preview/index.ts';
import { getLifecycleState } from './server/preview/api/index.ts';

// ── Global error safety net ────────────────────────────────────────────────────
installGlobalHandlers();

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — registerInfrastructure
//   Seed the database and warm up infrastructure singletons.
//   Must run before any repository or service is used.
// ═══════════════════════════════════════════════════════════════════════════════
async function registerInfrastructure(): Promise<void> {
  // Wire the shared bus adapter FIRST — console modules depend on it at init time.
  // Cast needed: TypedEventBus has generic overloads; IBusAdapter uses string for flexibility.
  initBusAdapter(bus as Parameters<typeof initBusAdapter>[0]);
  await seedDefaultProject();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2 — registerRepositories
//   Repository singletons are initialized on first import (module-level).
//   No explicit wiring is required here; this phase documents the dependency.
// ═══════════════════════════════════════════════════════════════════════════════
function registerRepositories(): void {
  // singletons: logRepository, sessionRepository, runtimeRepository,
  //             checkpointRepository — all initialized at module load.
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 3 — registerServices
//   Memory platform, tool registry, and chat orchestration.
//   Console service init is deferred to registerConsoleModule().
// ═══════════════════════════════════════════════════════════════════════════════
function registerServices(): void {
  bootstrapMemory();
  loadAllTools();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 5 — registerRoutes
//   Mount all HTTP routers onto the Express app.
// ═══════════════════════════════════════════════════════════════════════════════
function registerRoutes(app: Express): void {
  app.get('/health', (_req, res) => {
    res.json({ ok: true, uptime: process.uptime() });
  });

  // ── Shared SSE stream (all topics) ─────────────────────────────────────────
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
    const cleanup  = sseManager.register(
      res,
      topicSet as unknown as ReadonlySet<string>,
      projectId,
      runId,
    );
    req.on('close', () => cleanup());
  });

  // ── Stub routes ─────────────────────────────────────────────────────────────
  app.get('/api/project-status',  (_req: Request, res: Response) => res.json({ ok: true, running: [] }));
  app.get('/api/tunnel-info',     (_req: Request, res: Response) => {
    const domain = process.env.REPLIT_DEV_DOMAIN;
    res.json({ ok: true, url: domain ? `https://${domain}` : null });
  });
  app.post('/api/run-project',    (_req: Request, res: Response) => res.json({ ok: true }));
  app.post('/api/stop-project',   (_req: Request, res: Response) => res.json({ ok: true }));
  app.get('/api/artifacts',       (_req: Request, res: Response) => res.json({ ok: true, artifacts: [] }));

  // ── Lifecycle-state shortcut routes (used by usePreviewLifecycle hook) ───────
  // The frontend calls /api/lifecycle-state and /api/lifecycle-state/:projectId
  // on mount to sync initial state before SSE events arrive.
  app.get('/api/lifecycle-state',              getLifecycleState);
  app.get('/api/lifecycle-state/:projectId',   getLifecycleState);

  // ── Preview module ──────────────────────────────────────────────────────────
  app.use('/api/preview', buildPreviewRouter());

  // ── Module routers ──────────────────────────────────────────────────────────
  chatOrchestrator.mountRoutes(app);
  app.use('/api/orchestration',  createOrchestrationRouter());
  app.use('/api/terminal',       terminalRouter);
  app.use('/api/file-explorer',  fileExplorerRouter);
  app.use('/api',                legacyFileRouter);

  app.use(expressErrorMiddleware);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 6 — startHttpServer
//   Bind the HTTP port and kick off background watchers.
// ═══════════════════════════════════════════════════════════════════════════════
function startHttpServer(app: Express): void {
  const PORT   = Number(process.env.API_PORT ?? 3001);
  const server = http.createServer(app);

  chatOrchestrator.bootstrap(server);
  initOrchestration();
  subscribeToAgentFileEvents();

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] API server listening on port ${PORT}`);
    startFileWatcher().catch((err) => console.error('[file-watcher] Failed to start:', err));
    startDirectoryWatcher().catch((err) => console.error('[dir-watcher] Failed to start:', err));
  });

  process.on('SIGTERM', () => {
    console.log('[server] SIGTERM received — shutting down');
    server.close(() => process.exit(0));
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOOTSTRAP — ordered startup sequence
// ═══════════════════════════════════════════════════════════════════════════════
async function bootstrap(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  await registerInfrastructure();   // Phase 1 — DB seed
  registerRepositories();           // Phase 2 — repo singletons (module-load)
  registerServices();               // Phase 3 — memory, tools
  initPreviewModule();              // Phase 4 — preview module bootstrap
  registerRoutes(app);              // Phase 5 — HTTP routers
  startHttpServer(app);             // Phase 6 — listen
}

bootstrap().catch((err) => {
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});
