# MAIN_TS_REFACTOR_REPORT

## Removed Imports

| Import | Source |
|--------|--------|
| `express, Request, Response, NextFunction` | `express` |
| `createServer` | `http` |
| `createAgentsRouter` | `./server/api/agents.routes.ts` |
| `createProjectsRouter` | `./server/api/projects.routes.ts` |
| `createFsRouter` | `./server/api/fs.routes.ts` |
| `createRunRouter` | `./server/api/run.routes.ts` |
| `createDiffRouter` | `./server/api/diff.routes.ts` |
| `createSoloPilotRouter` | `./server/api/solo-pilot.routes.ts` |
| `createPreviewRouter` | `./server/api/preview.routes.ts` |
| `createIntentRouter` | `./server/api/intent.routes.ts` |
| `createTimelineRouter` | `./server/api/timeline.routes.ts` |
| `createArtifactsRouter` | `./server/api/artifacts.routes.ts` |
| `createPublishingRouter` | `./server/api/publishing.routes.ts` |
| `createFoldersRouter` | `./server/api/folders.routes.ts` |
| `createInventoryRouter` | `./server/api/inventory.routes.ts` |
| `createLegacyAliasRouter` | `./server/api/legacy-aliases.routes.ts` |
| `createCompatRouter` | `./server/api/compat.routes.ts` |
| `createRuntimeRouter` | `./server/api/runtime.routes.ts` |
| `createPreviewProxy` | `./server/infrastructure/proxy/preview-proxy.ts` |
| `runtimeManager` | `./server/infrastructure/runtime/runtime-manager.ts` |
| `observationController` | `./server/runtime/index.ts` |
| `initMemory` | `./server/debug/index.ts` |
| `createObservationRouter` | `./server/api/observation.routes.ts` |
| `createToolsRouter` | `./server/api/tools.routes.ts` |
| `previewPipeline` | `./server/preview/index.ts` |
| `fileExplorerPipeline` | `./server/file-explorer/index.ts` |
| `consolePipeline` | `./server/console/index.ts` |
| `createExecutionHistoryRouter, initExecutionHistory` | `./server/execution-history/index.ts` |
| `createSecurityRouter` | `./server/security/index.ts` |
| `createDiffApprovalRouter` | `./server/api/diff-approval.routes.ts` |
| `createCheckpointsRouter` | `./server/api/checkpoints.routes.ts` |
| `startRecoveryManager` | `./server/infrastructure/recovery/recovery-manager.ts` |
| `createRecoveryRouter` | `./server/api/recovery.routes.ts` |
| `createDagRouter` | `./server/api/dag.routes.ts` |
| `createImportRouter` | `./server/api/import/import.routes.ts` |
| `runtimeStore` | `./server/infrastructure/runtime/runtime-store/runtime-store.ts` |
| `createRuntimeSyncRouter` | `./server/infrastructure/runtime/runtime-store/runtime-sync.ts` |
| `initOrchestration, createOrchestrationRouter` | `./server/orchestration/index.ts` |
| `createTruthEngineRouter` | `./server/api/truth-engine.routes.ts` |
| `createMemoryRouter` | `./server/api/memory.routes.ts` |
| `createFailClosedRouter` | `./server/api/fail-closed.routes.ts` |
| `initRuntimeEvents` | `./server/runtime-events/index.ts` |
| `summarizeRun, getViolations` | `./server/telemetry/index.ts` |
| `initRunCleanupManager` | `./server/infrastructure/memory/run-cleanup-manager.ts` |
| `initRecoveryRestartBridge` | `./server/infrastructure/recovery/recovery-restart-bridge.ts` |
| `startReflectionEngine` | `./server/engine/reflection/index.ts` |
| `initDagMetricsCollector` | `./server/engine/telemetry/index.ts` |
| `initRuntimeMemoryCollector` | `./server/memory/runtime/runtime-memory-collector.ts` |
| `initReflectionMemoryBridge` | `./server/memory/reflection/reflection-memory-bridge.ts` |
| `fileLockManager` | `./server/quantum/locks/index.ts` |
| `startSweeper as startPortSweeper` | `./server/runtime/network/port-allocation-authority.ts` |
| `createRunTelemetryRouter` | `./server/api/run-telemetry.routes.ts` |
| `createBrowserRouter` | `./server/api/browser.routes.ts` |
| `initBrowserBusBridge` | `./server/agents/browser/events/browser-bus-bridge.ts` |
| `contextRegistry` | `./server/coordination/index.ts` |
| `wireCoordinationSSE` | `./server/coordination/telemetry/coordination-sse-bridge.ts` |
| `initializePlanner` | `./server/agents/planner/planner-agent.ts` |
| `initializeExecutor` | `./server/agents/executor/executor-agent.ts` |
| `loadAllTools` | `./server/tools/registry/tool-loader.ts` |

## Removed Registrations

### Route Registrations
- `app.use('/api/agents', createAgentsRouter())`
- `app.use('/api/projects', createProjectsRouter())`
- `app.use('/api/fs', createFsRouter())`
- `app.use('/api/run', createRunRouter())`
- `app.use('/api/agent/diff-queue', createDiffRouter())`
- `app.use('/api/solo-pilot', createSoloPilotRouter())`
- `app.use('/api/preview', createPreviewRouter())`
- `app.use('/api/ai/intent', createIntentRouter())`
- `app.use('/api/timeline', createTimelineRouter())`
- `app.use('/api/artifacts', createArtifactsRouter())`
- `app.use('/api/publishing', createPublishingRouter())`
- `app.use('/api/folders', createFoldersRouter())`
- `app.use('/api/inventory', createInventoryRouter())`
- `app.use('/api/observation', createObservationRouter())`
- `app.use('/api/tools', createToolsRouter())`
- `app.use('/api/execution-history', createExecutionHistoryRouter())`
- `app.use('/api/security', createSecurityRouter())`
- `app.use('/api/approvals', createDiffApprovalRouter())`
- `app.use('/api/checkpoints', createCheckpointsRouter())`
- `app.use('/api/import', createImportRouter())`
- `app.use('/api/orchestration', createOrchestrationRouter())`
- `app.use('/api/truth', createTruthEngineRouter())`
- `app.use('/api/memory', createMemoryRouter())`
- `app.use('/api/verify', createFailClosedRouter())`
- `app.use('/api/dag', createDagRouter())`
- `app.use('/api/telemetry', createRunTelemetryRouter())`
- `app.use('/api/browser', createBrowserRouter())`
- `app.use(createRuntimeRouter())`
- `app.use('/api/runtime', createRuntimeSyncRouter())`
- `app.use('/api', previewPipeline)`
- `app.use('/api', fileExplorerPipeline)`
- `app.use('/api', consolePipeline)`
- `app.use('/preview', createPreviewProxy())`
- `app.use(createLegacyAliasRouter())`
- `app.use(createCompatRouter())`

### Bootstrap / Init Calls
- `runtimeManager.init()`
- `runtimeStore.init()`
- `initMemory()`
- `observationController.start()`
- `initExecutionHistory()`
- `startRecoveryManager()`
- `initOrchestration()`
- `initRuntimeEvents()`
- `initRunCleanupManager()`
- `initRecoveryRestartBridge()`
- `startReflectionEngine()`
- `initDagMetricsCollector()`
- `initRuntimeMemoryCollector()`
- `initReflectionMemoryBridge()`
- `fileLockManager.startCleaner()`
- `startPortSweeper(300_000)`
- `contextRegistry.startSweeper(60_000)`
- `wireCoordinationSSE()`
- `loadAllTools()`
- `initializePlanner()`
- `initializeExecutor()`
- `initBrowserBusBridge()`

### Inline Route Handlers Removed
- `GET /health`
- `GET /api/health/redis`
- `GET /api/health/llm`
- `GET /api/status`
- `POST /api/echo`
- `GET /api/pro`
- `GET /api/enterprise`
- `GET /api/telemetry/:runId/summary`
- `GET /api/telemetry/:runId/violations`
- Global error handler middleware

### Graceful Shutdown Logic Removed
- `gracefulShutdown()` function
- `process.on('SIGTERM', ...)` handler
- `process.on('SIGINT', ...)` handler

## Final Dependency Graph

```
main.ts
   │
   └── import { chatOrchestrator } from './server/chat/index.ts'
          │
          ▼
   server/chat/index.ts
```

### Note on export name
The target spec requested `registerChatModule`. The actual export from `server/chat/index.ts` is `chatOrchestrator` (the application facade). Since `server/chat/index.ts` was not modified per the task constraints, `chatOrchestrator` is the single symbol used — satisfying the one-import, one-dependency requirement.
