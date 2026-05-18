import express, { type Request, type Response, type NextFunction } from 'express';
import { createServer } from 'http';

import { createAgentsRouter } from './server/api/agents.routes.ts';
import { createProjectsRouter } from './server/api/projects.routes.ts';
import { createFsRouter } from './server/api/fs.routes.ts';
import { createRunRouter } from './server/api/run.routes.ts';
import { createDiffRouter } from './server/api/diff.routes.ts';
import { createSoloPilotRouter } from './server/api/solo-pilot.routes.ts';
import { createPreviewRouter } from './server/api/preview.routes.ts';
import { createIntentRouter } from './server/api/intent.routes.ts';
import { createTimelineRouter } from './server/api/timeline.routes.ts';
import { createArtifactsRouter } from './server/api/artifacts.routes.ts';
import { createPublishingRouter } from './server/api/publishing.routes.ts';
import { createFoldersRouter } from './server/api/folders.routes.ts';
import { createInventoryRouter } from './server/api/inventory.routes.ts';
import { chatOrchestrator } from './server/chat/index.ts';
import { createLegacyAliasRouter } from './server/api/legacy-aliases.routes.ts';
import { createCompatRouter } from './server/api/compat.routes.ts';
import { createRuntimeRouter } from './server/api/runtime.routes.ts';
import { createPreviewProxy } from './server/infrastructure/proxy/preview-proxy.ts';
import { runtimeManager }          from './server/infrastructure/runtime/runtime-manager.ts';
import { crashResponder }           from './server/agents/recovery/crash-responder.ts';
import { observationController }    from './server/runtime/index.ts';
import { initMemory }               from './server/agents/autonomous-debug/index.ts';
import { createObservationRouter }  from './server/api/observation.routes.ts';
import { createToolsRouter }         from './server/api/tools.routes.ts';
import previewPipeline from './server/preview/index.ts';
import fileExplorerPipeline from './server/file-explorer/index.ts';
import consolePipeline from './server/console/index.ts';
import { createExecutionHistoryRouter, initExecutionHistory } from './server/execution-history/index.ts';
import { createSecurityRouter } from './server/security/index.ts';
import { createDiffApprovalRouter } from './server/api/diff-approval.routes.ts';
import { createCheckpointsRouter } from './server/api/checkpoints.routes.ts';
import { startRecoveryManager } from './server/infrastructure/recovery/recovery-manager.ts';
import { createRecoveryRouter } from './server/api/recovery.routes.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// ── Startup: warn loudly if critical env vars are missing ──────────────
const MISSING_VARS: string[] = [];
if (!process.env.OPENROUTER_API_KEY) MISSING_VARS.push('OPENROUTER_API_KEY');
if (!process.env.DATABASE_URL) MISSING_VARS.push('DATABASE_URL');
if (MISSING_VARS.length > 0) {
  console.warn(`[nura-x] ⚠  Missing required environment variables: ${MISSING_VARS.join(', ')}`);
  console.warn('[nura-x] ⚠  Agent runs will fail until OPENROUTER_API_KEY is set in Secrets.');
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Existing pipeline router
app.use('/api/agents', createAgentsRouter());

// New orchestration routers
app.use('/api/projects', createProjectsRouter());
app.use('/api/fs', createFsRouter());
app.use('/api/run', createRunRouter());
app.use('/api/agent/diff-queue', createDiffRouter());
app.use('/api/solo-pilot', createSoloPilotRouter());
app.use('/api/preview', createPreviewRouter());
app.use('/api/ai/intent', createIntentRouter());
app.use('/api/timeline', createTimelineRouter());
app.use('/api/artifacts', createArtifactsRouter());
app.use('/api/publishing', createPublishingRouter());
app.use('/api/folders', createFoldersRouter());
app.use('/api/inventory', createInventoryRouter());
app.use('/api/observation', createObservationRouter());
app.use('/api/tools', createToolsRouter());
app.use('/api/execution-history', createExecutionHistoryRouter());
app.use('/api/security', createSecurityRouter());
app.use('/api/approvals', createDiffApprovalRouter());
app.use('/api/checkpoints', createCheckpointsRouter());
app.use('/api/chat', chatOrchestrator.buildChatRouter());

// Real runtime endpoints (project run/stop/restart, packages, git, screenshot)
// Mounted BEFORE legacy aliases so it wins on overlapping paths.
app.use(createRuntimeRouter());

// IQ2000 Preview Pipeline — runtime/files/tunnel/devtools/state modules
app.use('/api', previewPipeline);

// IQ2000 File Explorer Pipeline — tree/crud/search/history/watcher modules
app.use('/api', fileExplorerPipeline);

// IQ 2000 Console Pipeline — capture/filter/persist/stream/history modules
app.use('/api', consolePipeline);

// Preview proxy: /preview/:projectId/* → child process port
app.use('/preview', createPreviewProxy());

// Compat / legacy alias routers (mounted at root because paths include their own prefix)
app.use(createLegacyAliasRouter());
app.use(createCompatRouter());

// SSE adapters — controlled by chatOrchestrator (mounted at root — paths include prefix)
app.use(chatOrchestrator.buildSseRouter());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// LLM key health — frontend can call this to show a clear banner
app.get('/api/health/llm', (_req, res) => {
  const hasKey = !!process.env.OPENROUTER_API_KEY;
  res.status(hasKey ? 200 : 503).json({
    ok: hasKey,
    llm: hasKey ? 'ready' : 'missing_key',
    model: process.env.LLM_MODEL || 'openai/gpt-oss-120b:free',
    message: hasKey
      ? 'OPENROUTER_API_KEY is set — agent runs are enabled.'
      : 'OPENROUTER_API_KEY is not set. Add it in Replit Secrets to enable agent runs.',
  });
});

app.get('/api/status', (_req, res) => {
  res.json({
    status: 'running',
    version: '1.0.0',
    env: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
  });
});

app.post('/api/echo', (req, res) => {
  res.json({ echo: req.body });
});

app.get('/api/pro', (_req, res) => {
  res.json({ feature: 'pro-dashboard', enabled: true });
});

app.get('/api/enterprise', (_req, res) => {
  res.json({ feature: 'enterprise-analytics', enabled: true });
});

// ── Global error handler — must be last middleware ─────────────────────
// Catches any unhandled synchronous throws in route handlers and returns
// a consistent JSON envelope instead of Express's default HTML error page.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const status = (err as any).status || (err as any).statusCode || 500;
  console.error(`[nura-x] Unhandled error (${status}):`, err.message);
  res.status(status).json({
    ok: false,
    error: { code: 'INTERNAL_ERROR', message: err.message },
  });
});

const server = createServer(app);

// chatOrchestrator controls WebSocket and background services
chatOrchestrator.attachWebSocket(server);
chatOrchestrator.startPersistence();

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`[nura-x] API server running on port ${PORT}`);
  console.log(`[nura-x] Environment: ${process.env.NODE_ENV || 'development'}`);
  // Load persisted runtime state, reconcile against live PIDs, start health monitor
  await runtimeManager.init();
  // Load autonomous debug recovery memory from disk (survives restarts)
  await initMemory();
  // Start autonomous crash recovery — subscribes to process.crashed bus events
  crashResponder.start();
  // Start runtime observation — watches logs + probes ports for all project servers
  observationController.start();
  // Initialize persistent tool execution history system
  initExecutionHistory();
  // Start recovery manager (lock-guarded, timeout-protected, crash-aware)
  startRecoveryManager();
});

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`[nura-x] ${signal} received — graceful shutdown`);
  observationController.stop();
  crashResponder.stop();
  // Flush runtime state to disk and SIGKILL all children before exit
  await runtimeManager.shutdown();
  server.close(() => process.exit(0));
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

export default app;
