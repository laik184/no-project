# User Flows

## Evidence policy

- **FACT**: Verified from routes, components, or services.
- **INFERRED**: End-to-end flow reconstructed from connected implementation points.
- **ASSUMPTION**: Intended behavior visible in UI or naming but not fully wired.

## Flow 1 — Create and open a project

### Steps

1. **FACT**: User visits `/` or `/apps`; project data is loaded from `GET /api/projects`.
2. **FACT**: User can create a project through `POST /api/projects` with `name`, optional `description`, and optional `framework`.
3. **FACT**: The backend creates a sandbox path from `AGENT_PROJECT_ROOT` or `/tmp/nurax-sandbox`, a slugified name, and a timestamp.
4. **FACT**: The workspace route supports `/workspace` and `/workspace/:id`.
5. **INFERRED**: The active project is commonly resolved from local storage key `nura.projectId`, defaulting to project `1` in chat runner code.

### Expected outcome

**FACT**: The database receives a `projects` row with status `idle`; the UI can navigate to a workspace and subsequent agent/runtime calls use that project id.

### Failure states

- **FACT**: `POST /api/projects` returns HTTP 400 when `name` is missing.
- **FACT**: `GET /api/projects/:id` returns HTTP 404 when not found.
- **INFERRED**: Project deletion is not implemented in mounted routes despite schema cascade relationships.

## Flow 2 — Chat-driven agent run

### Steps

1. **FACT**: In the workspace chat, `submitRun()` posts `{ projectId, goal, mode }` to `POST /api/run`.
2. **FACT**: Backend validates the run request with `startRunSchema` and returns `{ ok: true, data: { runId, ... } }` on accepted start.
3. **FACT**: `chatOrchestrator.startRun()` creates a run id, conversation/session/turn records in memory, persists an `agent_runs` row best-effort, registers the run, attempts clarification, loads chat and memory context, and publishes a run-started event.
4. **FACT**: Conversation/explain intents bypass orchestration and call `runChatLLM()` with token streaming.
5. **FACT**: Non-chat intents require an LLM key unless the goal matches a simple file creation/write pattern.
6. **FACT**: For code-building intents, chat calls `orchestrate()` with run id, project id, sandbox root, goal, and context.
7. **FACT**: The frontend subscribes to `agent`, `checkpoint`, and `lifecycle` realtime topics and updates messages/tool cards.
8. **FACT**: On completion, the backend marks the run completed, emits lifecycle completion, tries to create a checkpoint, and stores a memory entry.

### Expected outcome

**INFERRED**: The user sees an agent response stream, grouped tool actions, lifecycle completion, and a checkpoint card if checkpoint creation succeeds.

### Failure states

- **FACT**: Missing/invalid payload returns HTTP 400.
- **FACT**: If no OpenRouter key is configured and the request is not a simple file-write goal, the run is failed with a friendly streamed error.
- **FACT**: `cancelRun()` only cancels records that the orchestration `runManager` still reports as active.
- **INFERRED**: If the process crashes after returning the run id, only persisted run state can be recovered; in-memory conversation/session/turn state is not durable.

## Flow 3 — Reattach to active run

### Steps

1. **FACT**: Frontend uses `/api/run/active?projectId=N` to find a running run.
2. **FACT**: `runController.getActive()` scans the latest five runs by project and returns the first with status `running`.
3. **FACT**: Frontend reattaches to realtime subscriptions for that run.

### Failure states

- **FACT**: If no project id is supplied, the endpoint returns `{ ok: true, run: null }`.
- **INFERRED**: Reattach cannot replay all missed events unless the shared SSE manager's last-event-id path has retained them.

## Flow 4 — File explorer read/edit lifecycle

### Steps

1. **FACT**: `GET /api/file-explorer/tree` returns a sandbox tree.
2. **FACT**: `GET /api/file-explorer/read?filePath=...` reads a file.
3. **FACT**: `POST /api/file-explorer/write` writes file content, optionally using `clientMtime` for conflict detection.
4. **FACT**: Create, rename, delete, duplicate, upload, download, search, metadata, history, git-status, insights, health, undo, and conflict-check handlers exist.
5. **FACT**: Legacy aliases are mounted under `/api` for older clients.

### Expected outcome

**INFERRED**: Users or agents can inspect and modify project files while receiving conflict warnings and history snapshots.

### Failure states

- **FACT**: Missing `filePath`, content type mismatch, upload validation failure, and validation errors return 400-class responses.
- **FACT**: Write returns HTTP 409 when a conflict is detected.

## Flow 5 — Terminal session and command execution

### Steps

1. **FACT**: User/client creates a terminal session with `POST /api/terminal/sessions` using `projectId` and `cwd`.
2. **FACT**: Client runs commands through `POST /api/terminal/sessions/:sessionId/run`.
3. **FACT**: Client can stream terminal output through `GET /api/terminal/sessions/:sessionId/stream`.
4. **FACT**: Runtime start/stop/restart controls are exposed under session runtime endpoints.
5. **FACT**: Logs and history endpoints exist per session.

### Failure states

- **FACT**: Missing `projectId` or `cwd` returns 400.
- **FACT**: Unknown session id returns 404.
- **INFERRED**: Command execution safety depends on terminal service sandbox path validation.

## Flow 6 — Preview runtime

### Steps

1. **FACT**: Frontend can call `POST /api/runtime/:projectId/start` or restart/stop variants.
2. **FACT**: Runtime route fetches the project, derives sandbox path, auto-detects a command from package scripts or common Node entrypoints, and delegates to `previewRuntimeManager`.
3. **FACT**: Preview frame requests to `/preview/frame` proxy to the selected running runtime port.
4. **FACT**: If no runtime is proxyable, `/preview/frame` returns an idle HTML page.
5. **FACT**: Lifecycle state is available at `/api/lifecycle-state` and `/api/lifecycle-state/:projectId`.

### Failure states

- **FACT**: Invalid project id returns 400.
- **FACT**: Missing project returns 404.
- **FACT**: Missing runnable content returns `{ ok: false, empty: true }` and marks lifecycle crashed.
- **INFERRED**: Port detection can fail for apps that log non-standard startup text or do not expose a discoverable port.

## Flow 7 — Import project

### Current behavior

**FACT**: The UI contains import screens for GitHub, Figma, Lovable, Bolt, Vercel, Base44, and ZIP upload.

**FACT**: The frontend calls `/api/import/git`, `/api/import/figma`, `/api/import/base44`, `/api/import/zip`, and `/api/import/status/:importId`.

**FACT**: No corresponding mounted import router was found in `main.ts`.

### Expected outcome

**ASSUMPTION**: These routes are planned to import external applications or design artifacts into a NURAX project sandbox.

### Failure states

**FACT**: In the current server wiring, these calls should return 404 unless another external server/proxy handles them.
