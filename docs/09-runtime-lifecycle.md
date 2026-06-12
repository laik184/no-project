# Runtime Lifecycle

## Server process lifecycle

### Startup

**FACT**: The API process starts through `tsx main.ts` in development and `tsx main.ts` in the `start` script.

**FACT**: Startup sequence:

1. Install global process error handlers.
2. Run diagnostics.
3. Create Express app with JSON and URL-encoded body parsing at 10 MB limits.
4. Initialize bus adapter and seed default project.
5. Document repository singleton phase.
6. Bootstrap memory and load/seal tools.
7. Initialize preview module.
8. Mount all routes and error middleware.
9. Create HTTP server.
10. Bootstrap chat websocket manager and heartbeat manager.
11. Initialize orchestration.
12. Subscribe file explorer to agent file events.
13. Listen on `API_PORT` or `3001`.
14. Start file and directory watchers after server listen.

### Shutdown

**FACT**: SIGTERM handler closes the HTTP server and exits the process.

**Missing**:

- No verified graceful shutdown for DB pool, Redis/queue, child runtimes, terminal sessions, file watchers, or WebSocket/SSE connections in the observed entrypoint.

## Development frontend lifecycle

**FACT**: `npm run dev` runs API and Vite concurrently.

**FACT**: `predev:api` kills port `3001`; `predev:web` kills port `5000`.

**FACT**: Vite serves frontend on `0.0.0.0:5000` and proxies API/preview/WS paths to `3001`.

## Agent run lifecycle

```text
requested → running → completed | failed | cancelled
```

**FACT**:

1. Frontend posts `/api/run`.
2. Chat orchestrator creates run identity and in-memory session/turn.
3. `runWriter.create()` attempts to persist `agent_runs`.
4. `runManager.register()` tracks the active run.
5. Clarification/memory/context are loaded.
6. Run-started event is published.
7. Direct chat runs call the chat LLM and stream tokens.
8. Build/modify runs call orchestration.
9. Completion updates turn, DB status, lifecycle event, checkpoint, and memory.
10. Failure updates turn, DB status, lifecycle event, and stream closure.
11. Cancellation sets run manager and DB status to cancelled and closes stream.

## Orchestration lifecycle

**FACT**:

1. Ensure orchestration id.
2. Validate request.
3. Build orchestration context.
4. Validate context.
5. Initialize state.
6. Create session.
7. Recall memory context.
8. Run orchestration loop.
9. Persist execution/bug memory asynchronously.
10. Return structured result.
11. Cleanup state/metrics on explicit cleanup endpoint or internal finally paths where implemented.

## Tool execution lifecycle

**FACT**:

1. Publish `agent.tool_call` running event.
2. Resolve tool definition.
3. Enforce permission policy.
4. Validate input.
5. Execute with timeout/retry policy.
6. Record metrics/audit.
7. Publish shell output/file write events as applicable.
8. Reality-check terminal exit code and filesystem side effects.
9. Return typed success/failure result; dispatcher never throws to caller by design.

## Preview runtime lifecycle

```text
idle/no app → starting → running → stopped | crashed
```

**FACT**:

1. Runtime start/restart route fetches project by id.
2. Sandbox path resolves from project or `AGENT_PROJECT_ROOT` or `.sandbox`.
3. Start command is detected from package scripts or common Node entrypoints.
4. No detected command returns `{ ok: false, empty: true }` and marks lifecycle crashed.
5. `previewRuntimeManager.start/restart()` starts process and updates runtime state.
6. `/preview/frame` proxies only if runtime entry is `running` or `starting` and a port is known.
7. Otherwise idle HTML is returned.
8. Stop route delegates to `previewRuntimeManager.stop()`.

## Terminal session lifecycle

**FACT**:

1. Client creates a terminal session with project id and cwd.
2. Session manager stores session metadata.
3. Commands execute through command service with session cwd constraints.
4. Output is published through terminal stream broker and persisted through terminal repositories.
5. Terminal runtime lifecycle can start/stop/restart a session runtime.
6. Destroy session stops lifecycle and closes session.

## File explorer watcher lifecycle

**FACT**:

1. File and directory watchers start after server listen.
2. File explorer subscribes to agent file events before listen callback.
3. Watcher startup failures are logged to console but do not crash the server.

## Recovery lifecycle

**Implemented**:

- Active run lookup through `/api/run/active`.
- SSE `lastEventId` parameter/header support.
- Runtime status endpoint and lifecycle state endpoints.
- Checkpoint creation and rollback routes.
- Verifier/recovery tools and agents exist.

**Missing or partial**:

- No complete process restart recovery for active in-memory sessions/runs/folders.
- No observed startup reconciliation of DB `running` runs to failed/recovering.
- No guaranteed child process cleanup on SIGTERM.
- No durable event store contract for realtime replay.
