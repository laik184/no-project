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
import { runStartupDiagnostics } from './server/startup/health-diagnostics.ts';

import { bootstrapMemory }                               from './server/memory/index.ts';
import { loadAllTools }                                  from './server/tools/registry/tool-loader.ts';
import { chatOrchestrator }                              from './server/chat/index.ts';
import { initOrchestration, createOrchestrationRouter } from './server/orchestration/index.ts';
import { seedDefaultProject, TOPIC, sseManager, db }    from './server/infrastructure/index.ts';
import { projects }                                       from './shared/schema.ts';
import { desc, eq }                                      from 'drizzle-orm';
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

// Runtime routes (/api/runtime/:projectId/start|restart|stop) + legacy /api/restart
import { buildRuntimeRouter, handleLegacyRestart, buildPreviewFrameHandler } from './server/preview/api/runtime-routes.ts';

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

  // ── Projects CRUD ───────────────────────────────────────────────────────────
  app.get('/api/projects', async (_req: Request, res: Response) => {
    try {
      const rows = await db.select().from(projects).orderBy(desc(projects.updatedAt)).limit(50);
      res.json({ ok: true, data: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  app.post('/api/projects', async (req: Request, res: Response) => {
    try {
      const { name, description, framework } = req.body as { name?: string; description?: string; framework?: string };
      if (!name?.trim()) { res.status(400).json({ ok: false, error: "name is required" }); return; }
      const sandboxRoot = process.env.AGENT_PROJECT_ROOT ?? '/tmp/nurax-sandbox';
      const slug        = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
      const sandboxPath = `${sandboxRoot}/${slug}-${Date.now()}`;
      const [row] = await db.insert(projects).values({
        name: name.trim(),
        description: description ?? null,
        framework:   framework ?? null,
        sandboxPath,
        status: 'idle',
      }).returning();
      res.json({ ok: true, data: row });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  app.get('/api/projects/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const [row] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
      if (!row) { res.status(404).json({ ok: false, error: "Not found" }); return; }
      res.json({ ok: true, data: row });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  app.patch('/api/projects/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const { name, description, framework, status } = req.body as Record<string, string>;
      const [row] = await db.update(projects)
        .set({ ...(name && { name }), ...(description !== undefined && { description }), ...(framework && { framework }), ...(status && { status }), updatedAt: new Date() })
        .where(eq(projects.id, id))
        .returning();
      res.json({ ok: true, data: row });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // ── Folders (in-memory, no DB table) ───────────────────────────────────────
  const _folders: Array<{ id: number; name: string; projectIds: number[]; createdAt: string }> = [];
  let _folderId = 1;

  app.get('/api/folders', (_req: Request, res: Response) => res.json(_folders));

  app.post('/api/folders', (req: Request, res: Response) => {
    const { name } = req.body as { name?: string };
    if (!name?.trim()) { res.status(400).json({ ok: false, error: "name is required" }); return; }
    const folder = { id: _folderId++, name: name.trim(), projectIds: [], createdAt: new Date().toISOString() };
    _folders.push(folder);
    res.json(folder);
  });

  app.patch('/api/folders/:id', (req: Request, res: Response) => {
    const id  = Number(req.params.id);
    const idx = _folders.findIndex(f => f.id === id);
    if (idx < 0) { res.status(404).json({ ok: false, error: "Not found" }); return; }
    const { name } = req.body as { name?: string };
    if (name?.trim()) _folders[idx].name = name.trim();
    res.json(_folders[idx]);
  });

  app.delete('/api/folders/:id', (req: Request, res: Response) => {
    const id  = Number(req.params.id);
    const idx = _folders.findIndex(f => f.id === id);
    if (idx < 0) { res.status(404).json({ ok: false, error: "Not found" }); return; }
    _folders.splice(idx, 1);
    res.json({ ok: true });
  });

  // ── Lifecycle-state shortcut routes (used by usePreviewLifecycle hook) ───────
  // The frontend calls /api/lifecycle-state and /api/lifecycle-state/:projectId
  // on mount to sync initial state before SSE events arrive.
  app.get('/api/lifecycle-state',              getLifecycleState);
  app.get('/api/lifecycle-state/:projectId',   getLifecycleState);

  // ── Preview module ──────────────────────────────────────────────────────────
  app.use('/api/preview', buildPreviewRouter());

  // ── Runtime routes (Run / Restart buttons) ──────────────────────────────────
  app.use('/api/runtime', buildRuntimeRouter());
  app.post('/api/restart', handleLegacyRestart);

  // ── Preview frame proxy — /preview/frame → sandbox project port ─────────────
  // Vite already proxies /preview/* → :3001, so this route is reachable.
  app.use('/preview/frame', buildPreviewFrameHandler());

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
  runStartupDiagnostics();

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
