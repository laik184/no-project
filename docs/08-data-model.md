# Data Model

## Database technology

**FACT**: The application uses Drizzle ORM with PostgreSQL tables defined in `shared/schema.ts`.

**FACT**: Drizzle Kit is configured with schema path `./shared/schema.ts`, output `./drizzle`, and `DATABASE_URL` credentials.

## Entities

### `projects`

**FACT fields**:

- `id` serial primary key.
- `name` varchar(255), required.
- `description` text.
- `framework` varchar(64).
- `sandboxPath` text.
- `status` varchar(32), default `idle`.
- `createdAt`, `updatedAt` timestamps.

**Relationships**: Referenced by runs, messages, uploads, artifacts, diff queue, tool executions, console logs, deployments, deployment settings/secrets/domains/auth config, checkpoints, and rollback history.

### `agent_runs`

**FACT fields**: `id`, `projectId`, `goal`, `status`, `startedAt`, `endedAt`, `result`.

**Purpose**: Persist high-level agent run lifecycle.

### `chat_messages`

**FACT fields**: `id`, `projectId`, `runId`, `role`, `content`, `feedback`, `tokensUsed`, `toolCalls`, `createdAt`.

**Purpose**: Store user/agent/tool message history.

### `chat_uploads`

**FACT fields**: `id`, `projectId`, `runId`, `filename`, `mimeType`, `storedPath`, `sizeBytes`, `createdAt`.

**Purpose**: Track uploaded files attached to chats/runs.

### `agent_events`

**FACT fields**: `id`, `runId`, `phase`, `agentName`, `eventType`, `payload`, `ts`.

**Purpose**: Store flat agent event logs.

### `artifacts`

**FACT fields**: `id`, `projectId`, `kind`, `path`, `meta`, `createdAt`.

**Purpose**: Track generated artifacts.

**Current API note**: `GET /api/artifacts` currently returns an empty in-memory list and does not query this table.

### `diff_queue`

**FACT fields**: `id`, `projectId`, `filePath`, `oldContent`, `newContent`, `status`, `createdAt`.

**Purpose**: Represent pending/proposed file diffs.

### `tool_executions`

**FACT fields**: `executionId`, `runId`, `projectId`, `stepIndex`, `toolName`, `toolCategory`, `status`, `argsJson`, `resultJson`, `errorText`, `durationMs`, `retryCount`, `replaySafe`, timestamps.

**Indexes**: run id, project id, tool name, started at.

**Purpose**: Structured persistent tool invocation history.

### `console_logs`

**FACT fields**: `id`, `projectId`, `stream`, `line`, `ts`.

**Purpose**: Store runtime/terminal console lines.

### Deployment tables

**FACT tables**:

- `deployments`: status, URL, region, environment, steps, errors, lifecycle timestamps.
- `deployment_domains`: domain names and status.
- `deployment_secrets`: key and encrypted value.
- `deployment_settings`: app name, environment, region, public flag, database URL.
- `deployment_auth_config`: providers, email verification, session expiry.

**INFERRED**: These model a planned publishing/deployment subsystem, but mounted routes were not found.

### `checkpoints`

**FACT fields**: checkpoint id, project id, run id, trigger, status, git commit SHA, file count, label/description, created/modified/deleted file lists, file snapshots, created at.

**Indexes**: project id, run id, created at.

**Purpose**: Capture file state around runs and manual checkpoints.

### `rollback_history`

**FACT fields** include checkpoint id, project id, run id, status-like and file restoration metadata fields in the remainder of `shared/schema.ts`.

**Purpose**: Track rollback attempts/results.

## In-memory state models

**FACT**: The following important state is process-local:

- Folder array in `main.ts`.
- Chat conversation/session/turn manager state.
- Active orchestration state/metrics/monitor snapshots.
- Runtime manager entries for spawned processes.
- Terminal session manager state.
- Preview lifecycle/session/cache stores where in-memory repositories are used.
- File watcher subscriptions.

**Risk**: Horizontal scaling and crash recovery require externalizing or reconstructing this state.

## Filesystem state

**FACT**: Projects have `sandboxPath`; runtime routes use it as app root.

**FACT**: File explorer and filesystem tools operate within sandbox-oriented path validation layers.

**INFERRED**: The filesystem sandbox is the primary source of generated application code, while PostgreSQL stores metadata and history.

## Memory state

**FACT**: Memory entries are stored through a memory repository and retrieved through vector/retrieval abstractions.

**FACT**: Memory graph APIs are compatibility stubs and return no graph data.

## Data retention and cascade behavior

**FACT**: Many tables reference `projects.id` with `onDelete: cascade`; `runId` references often use cascade or set-null.

**INFERRED**: Deleting a project should remove dependent runs/messages/uploads/events/artifacts/tool logs/checkpoints/deployment rows at the DB level if project delete is implemented.

## Missing data model pieces

- **FACT**: No persisted folder table exists despite `/api/folders` UI usage.
- **FACT**: No import job table was found in `shared/schema.ts` despite import UI status polling.
- **INFERRED**: Deployment tables exist, but API/job orchestration is incomplete or not mounted.
- **INFERRED**: Event replay/backfill retention should be explicitly modeled for reliable run reattachment.
