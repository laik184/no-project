# Feature Specification

## Status labels

- **Implemented**: Mounted route/component/service exists.
- **Partial**: Some pieces exist but end-to-end behavior is incomplete or fragile.
- **Dead/Unwired**: UI or data model exists but no mounted backend contract was found.
- **Risk**: Implemented behavior has correctness, security, or production-readiness concern.

## 1. Project management — Partial

**Purpose**: Store and select workspaces/sandboxes.

**FACT behavior**:

- `GET /api/projects` lists up to 50 projects ordered by `updatedAt` descending.
- `POST /api/projects` creates a row with name, optional description/framework, generated sandbox path, and status `idle`.
- `GET /api/projects/:id` fetches one project.
- `PATCH /api/projects/:id` updates selected fields.

**Inputs**: JSON body for create/update; numeric id path parameter.

**Outputs**: `{ ok: true, data }` envelopes for project CRUD.

**Dependencies**: Drizzle `db`, `projects` schema, `DATABASE_URL` at actual DB-use time.

**Failure states**: missing name, missing id row, database errors.

**Missing pieces**:

- Project deletion is not mounted.
- Sandbox directory creation is not guaranteed by `POST /api/projects`.
- Project selection is partly local-storage based.

## 2. Folder organization — Partial/Risk

**Purpose**: Organize projects in the apps page.

**FACT behavior**: `/api/folders` uses an in-memory array inside `registerRoutes()`.

**Failure states and risks**:

- Folder state is lost on process restart.
- Folder membership is not persisted.
- Folder membership fields are accepted by parts of the UI but not represented by the in-memory backend model.

## 3. Chat and agent runs — Implemented/Partial

**Purpose**: Convert user goals into chat responses or orchestrated code-building runs.

**FACT behavior**:

- `POST /api/run` starts a run and returns a run id in a wrapped envelope.
- `POST /api/run/start` is a legacy alias.
- `GET /api/run/active` returns the latest active persisted run for a project.
- `POST /api/run/:runId/cancel` cancels a run.
- `GET /api/runs` and `GET /api/runs/:runId` expose run history/status.
- User messages can be stored through `/api/chat/messages`.
- Feedback can be set through `/api/chat/messages/:id/feedback`.

**Dependencies**: chat orchestrator, chat services, run writer, event publisher, memory, orchestration layer, LLM client, checkpoint service.

**Failure states**:

- Invalid payload returns 400.
- Missing LLM key causes intentional run failure unless the prompt is a simple file-write request.
- Orchestration failure marks run failed.
- Checkpoint creation failure is logged but does not fail the completed run.

**Missing pieces**:

- Durable recovery for in-memory conversation/session/turn state.
- Strong typed contract documentation in code for all event payloads.

## 4. Realtime event streaming — Implemented/Partial

**Purpose**: Push lifecycle, agent, tool, checkpoint, preview, and related events to the UI.

**FACT behavior**:

- Shared SSE route is `GET /api/realtime`.
- It registers all values in `TOPIC` and supports optional `projectId`, `runId`, and `lastEventId`.
- Chat bootstrap initializes a WebSocket manager and heartbeat manager.

**Dependencies**: infrastructure SSE manager, event bus adapter, chat websocket manager, frontend realtime provider.

**Failure states**:

- SSE disconnects rely on request `close` cleanup.
- Backfill/replay depends on SSE manager internals and retained event history.

## 5. Orchestration engine — Implemented/Partial

**Purpose**: Validate a request, build orchestration context, run workflow phases, coordinate agents/tools, and report diagnostics.

**FACT behavior**:

- `POST /api/orchestration/run` accepts `runId`, `projectId`, `sandboxRoot`, `goal`, optional context/options.
- Diagnostics endpoints expose active, stuck, metrics, per-run diagnostics, and cleanup.
- `orchestrate()` validates request/context, initializes state/session, recalls memory context, runs orchestration loop, stores outcome memory, and cleans up state.

**Dependencies**: validation, context/session/state, orchestration loop, memory, metrics, monitor, escalation manager.

**Missing pieces / risks**:

- Large agent trees exist, but not every intended agent path is proven reachable from the current orchestrator without deeper runtime validation.
- The architecture relies heavily on in-memory state during active runs.

## 6. Tool registry and dispatch — Implemented

**Purpose**: Provide a sealed registry of executable tools for agents.

**FACT behavior**:

- Boot calls `loadAllTools()` once.
- Tool categories registered: filesystem, coding, terminal, verifier, git, browser.
- Registry is sealed after registration.
- Dispatcher resolves tools, validates permissions, retries per policy, applies timeouts, records metrics/audit, emits tool lifecycle events, publishes terminal output/file writes, and performs reality checks for terminal exit codes and filesystem writes/deletes.

**Dependencies**: registry, tool security, metrics, bus, filesystem reality checks, terminal output model.

**Failure states**:

- Tool not found, permission denied, timeout, execution error, failed terminal exit, reported-success reality mismatch.

## 7. Filesystem/file explorer — Implemented

**Purpose**: UI and agent access to sandbox files.

**FACT behavior**:

- Tree, read, write, create, rename, delete, duplicate, upload, download, search, metadata, history, git status, insights, health, undo, conflict-check endpoints exist.
- Upload uses multer memory storage for up to 50 files.
- Write supports conflict status and returns HTTP 409 on conflict.

**Dependencies**: file explorer orchestrator, validators, guards, mappers, watchers, shared filesystem core.

**Failure states**: validation errors, sandbox/path errors, missing files, conflicts.

## 8. Terminal and command execution — Implemented/Partial

**Purpose**: Run shell commands and manage per-project terminal sessions.

**FACT behavior**:

- Session CRUD, command run, runtime start/stop/restart, logs/history, and session SSE stream endpoints are mounted.
- Controller delegates to terminal session manager, terminal lifecycle, stream broker, command service, terminal repositories, and parsers.

**Failure states**: missing session, missing command, command execution errors, sandbox validation errors.

**Risk**: Production security depends on strict command and cwd validation; this must be validated independently before exposing to untrusted users.

## 9. Preview/runtime lifecycle — Implemented/Partial

**Purpose**: Start the generated app and show it in an iframe/proxy.

**FACT behavior**:

- `/api/runtime/:projectId/start|restart|stop` controls runtime by auto-detecting package manager scripts or Node entrypoints.
- `/preview/frame` proxies to a running runtime port or returns idle HTML.
- `/api/preview/*` exposes state, health, metrics, session, reload/start/stop/lifecycle/debug/devtools, and stream endpoints.
- Lifecycle state shortcuts are mounted at `/api/lifecycle-state` and `/api/lifecycle-state/:projectId`.

**Failure states**: invalid project id, missing project, missing sandbox, missing runnable command, port detection failure, process crash.

## 10. Checkpoints and rollback — Partial

**Purpose**: Capture file state after runs and allow rollback.

**FACT behavior**:

- Schema contains `checkpoints` and `rollback_history`.
- Chat completion attempts to create a checkpoint and emits a checkpoint event.
- Checkpoint routes support list, create, get, delete, rollback, diff.

**Missing pieces / risks**:

- Checkpoint reliability is non-blocking for run completion.
- Rollback safety depends on safe filesystem utilities and snapshot completeness.

## 11. Memory platform — Implemented/Partial

**Purpose**: Persist and retrieve long-term context for orchestration, chat, verifier, and learning.

**FACT behavior**:

- Memory boot hydrates repository asynchronously.
- Store flow is documented as content → chunker → embedding → repository → persistence → vector store.
- Search builds memory context injection strings.
- Knowledge graph APIs are compatibility stubs returning empty lists.

**Failure states**:

- Hydration failure is logged but non-fatal.
- Graph data is currently not implemented despite public stubs.

## 12. Import flows — Dead/Unwired

**Purpose**: Import apps/designs from Git, Figma, Lovable, Bolt, Vercel, Base44, and ZIP.

**FACT behavior**:

- Frontend pages and modal call import endpoints.
- No import router is mounted in `main.ts`.

**Expected failure**: 404 from the current API server.

## 13. Publishing/deployment — Partial/Planned

**Purpose**: Publish apps and manage deployment settings/secrets/domains.

**FACT behavior**:

- Deployment tables exist in schema.
- Publishing pages exist in frontend routes.

**Missing pieces**:

- Mounted deployment/publishing API was not found in `main.ts`.
- Actual deployment worker behavior is not proven from mounted routes.

## 14. Usage/metrics dashboard — Dead/Unwired

**FACT behavior**: Usage/dashboard UI queries `/api/agents/metrics`.

**FACT**: No matching mounted route was found.

**Expected failure**: 404 from the current API server.
