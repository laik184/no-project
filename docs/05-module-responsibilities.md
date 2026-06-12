# Module Responsibilities

## Frontend modules

### `client/src/App.tsx`

**FACT**: Owns global providers, application shell, and route table.

**Responsibilities**:

- Route users to home, apps, imports, create project, publishing, console, preview, workspace, and utility pages.
- Wrap the app with query, realtime, lifecycle, app state, import modal, sidebar drawer, tooltip, and toast providers.

### `client/src/pages/core/workspace.tsx`

**FACT**: Implements the main multi-panel workspace shell with chat, preview/editor surfaces, collaboration/invite UI, diff approval modal, and imported layout components.

**Responsibilities**:

- Coordinate workspace layout and panels.
- Host chat-driven agent interaction.
- Surface editor/preview/diff/collaboration UI.

### `client/src/components/chat/*`

**FACT**: Owns chat input/messages, run submission, realtime run subscriptions, question answering, stop/cancel behavior, token streaming, action cards, and lifecycle handling.

**Responsibilities**:

- Convert user messages into `/api/run` calls.
- Subscribe to agent/checkpoint/lifecycle topics.
- Render agent/tool/progress messages.
- Cancel active runs.

### `client/src/components/file-explorer/*`

**FACT**: Owns file tree panels, open editors, pinned/recent/history panels, context menus, git status, and agent file activity indicators.

**Responsibilities**:

- Display and mutate sandbox files through file-explorer APIs.
- Track open/pinned/recent files.
- Surface collaboration and file change indicators.

### `client/src/pages/preview/*`

**FACT**: Owns preview iframe/browser chrome, lifecycle overlays, runtime health widget, error panel, device frames, and devtools panel.

**Responsibilities**:

- Display `/preview/frame` output.
- Fetch lifecycle state.
- Show runtime/preview status and controls.

## Backend entrypoint and infrastructure

### `main.ts`

**FACT**: Owns process bootstrap and route mounting.

**Responsibilities**:

- Install error handlers.
- Run diagnostics.
- Initialize infrastructure, memory, tools, preview, chat, orchestration, watchers.
- Mount all HTTP/SSE/proxy routes.
- Start API server.

### `server/infrastructure/*`

**FACT**: Public infrastructure barrel exports DB, bus, SSE manager, runtime manager, sandbox helpers, checkpoint-safe filesystem helpers, git helpers, seed, Redis, and queue.

**Responsibilities**:

- Provide low-level shared runtime primitives.
- Isolate process, event, database, queue, Redis, and sandbox concerns.

### `shared/schema.ts`

**FACT**: Defines Drizzle PostgreSQL tables and inferred TypeScript types for projects, runs, messages, uploads, events, artifacts, diff queue, tool executions, console logs, deployments, domains, secrets, settings, auth config, checkpoints, and rollback history.

**Responsibilities**:

- Act as central relational data model.
- Provide DB table definitions and inferred row/insert types.

## Backend feature modules

### `server/chat/*`

**FACT**: Owns chat routes/controllers, run lifecycle, conversations, messages, questions, attachments, checkpoints, streams, event publishing, and LLM chat path.

**Responsibilities**:

- Convert HTTP run requests into orchestrated work.
- Persist chat/run/message state.
- Publish realtime run lifecycle.
- Manage clarification/questions.
- Create checkpoints after completed runs.

### `server/orchestration/*`

**FACT**: Owns orchestration API, request/context validation, sessions, state, orchestration loop, monitoring, metrics, stuck detection, escalation, cleanup, and result shaping.

**Responsibilities**:

- Coordinate multi-step agent workflows.
- Avoid direct tool/filesystem/shell execution in the top-level orchestrator.
- Expose diagnostics for active/stuck/metric state.

### `server/agents/*`

**FACT**: Contains role-specific agents: browser, chat, coderx, executor, filesystem, planner, supervisor, terminal, verifier.

**Responsibilities**:

- Encapsulate specialized planning, execution, verification, browser, filesystem, terminal, and supervisory behavior.
- Provide agent-specific validation, telemetry, memory, recovery, and execution loops.

### `server/tools/*`

**FACT**: Owns tool definition, registration, dispatch, metadata, metrics, security, and concrete tool implementations for browser, coding, filesystem, git, terminal, and verifier.

**Responsibilities**:

- Provide the only executable side-effect surface for agents.
- Validate permissions and input.
- Emit observability events.
- Perform reality checks after file and terminal operations.

### `server/file-explorer/*`

**FACT**: Owns file explorer routes/controllers/services/watchers/validators/orchestrator and legacy file API aliases.

**Responsibilities**:

- Provide interactive sandbox file CRUD/search/upload/download/history/conflict operations.
- Watch file changes and bridge agent file events to UI.

### `server/terminal/*`

**FACT**: Owns terminal API, sessions, command execution, runtime lifecycle, terminal SSE streams, parsers, persistence adapters, and contracts.

**Responsibilities**:

- Create/manage terminal sessions.
- Run commands inside validated cwd/sandbox constraints.
- Stream command output.
- Store logs/history.
- Start/stop/restart terminal-managed runtime processes.

### `server/preview/*`

**FACT**: Owns preview API, lifecycle state, runtime manager integration, frame proxy, devtools, recovery, streaming, and metrics.

**Responsibilities**:

- Start/restart/stop generated app runtimes.
- Proxy preview iframe requests to sandbox app port.
- Track preview lifecycle and health.
- Expose devtools/console/network events.

### `server/memory/*`

**FACT**: Owns memory repository, chunking, embedding, persistence, vector store, retrieval, and public memory context builders.

**Responsibilities**:

- Store/retrieve long-term agent context.
- Provide memory injection strings for chat/orchestration/verifier.
- Maintain compatibility stubs for graph APIs.

### `server/repositories/*` and `server/services/*`

**FACT**: Contain repository/service layers for chat, file-system, preview, terminal, filesystem, and related domains.

**Responsibilities**:

- Encapsulate data access and business logic where implemented.
- Keep controllers thin.

## Ownership gaps

**FACT**: Project CRUD and folder CRUD are implemented directly inside `main.ts`, not in a dedicated project/folder module.

**FACT**: Import and publishing pages exist, but mounted backend modules are missing or not discoverable through `main.ts`.

**INFERRED**: A production architecture should introduce explicit project, folder, import, deployment, and metrics modules to match the rest of the layered structure.
