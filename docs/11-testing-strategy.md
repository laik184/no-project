# Testing Strategy

## Current test inventory

**FACT**: `package.json` defines:

```bash
npm test
```

as:

```bash
node --import tsx/esm --test server/agents/dependencies/tests/*.test.ts server/memory/tests/*.test.ts
```

**FACT**: `server/memory/tests/memory-pipeline.test.ts` exists.

**FACT**: File explorer test files exist under `server/file-explorer/tests/`, but they are not included in the package `test` script.

**FACT**: `server/agents/dependencies/tests/*.test.ts` was not found in the repository scan, but the current Node test invocation still completed successfully in validation and ran the memory pipeline test.

## Required baseline checks

### TypeScript compile check

Run:

```bash
npx tsc --noEmit
```

Purpose:

- Catch syntax errors, missing aliases, type-only import issues, route defects, and module resolution failures.

### Vite build

Run:

```bash
npm run build
```

Purpose:

- Validate frontend bundling, Vite alias resolution, JSX, CSS imports, and production asset build.

### Node tests

Run:

```bash
npm test
```

Purpose:

- Validate configured memory/dependency tests.

Required improvement:

- Update the test script to include existing file explorer tests and remove stale/missing globs for clarity.

### Tool audit

Run:

```bash
npm run tool:audit
```

Purpose:

- Validate tool registration/dispatch pipeline if the script is current.

## Unit testing plan

### Controllers/routes

Test:

- Validation errors for missing project name, run payload, terminal session args, file path, content.
- Success envelopes and HTTP status codes.
- Legacy route compatibility.
- Route ordering, especially attachments `/run/:runId` before `/:id`.

### Services

Test:

- Chat run start paths: conversation/explain vs orchestration vs missing key.
- Run cancellation state transitions.
- Runtime command detection from package scripts and Node entrypoints.
- File explorer conflict detection.
- Terminal cwd sandbox validation.

### Repositories

Test:

- CRUD operations for projects, runs, messages, checkpoints, tool executions.
- Cascade expectations with integration DB.
- Timestamp/status updates.

### Tool dispatcher

Test:

- Tool not found.
- Permission denied.
- Retry attempts.
- Timeout.
- Terminal non-zero exit becomes failure.
- Filesystem reported-success reality mismatch becomes failure.

### Memory

Test:

- Chunking for text/code/markdown/json.
- Store and search by category.
- Memory injection formatting.
- Hydration failure is non-fatal.

## Integration testing plan

### API integration

Use Supertest or equivalent against Express app factory. Required refactor: expose app creation without binding HTTP server.

Scenarios:

1. Create project → fetch project → update project.
2. Start run with missing key → receive failed lifecycle/message behavior.
3. File explorer create/write/read/history/undo.
4. Terminal session create/run/stream/logs/destroy.
5. Runtime start with empty sandbox returns `empty`.
6. Runtime start with test app proxies `/preview/frame`.
7. Checkpoint create/diff/rollback.

### Database integration

Use test PostgreSQL or isolated schema.

Scenarios:

- Migrations/schema push succeeds.
- Project cascade delete removes dependent rows.
- Tool execution indexes support common queries.

### Realtime integration

Scenarios:

- `/api/realtime` emits events for run start/completion/tool calls.
- Reconnect with `Last-Event-ID` replays retained events if supported.
- SSE cleanup fires on client disconnect.

## End-to-end testing plan

Use Playwright.

Critical E2E flows:

1. Home loads projects.
2. Create project and open workspace.
3. Submit chat goal; see run id, lifecycle updates, and completion/failure state.
4. Create/edit/read a file through UI.
5. Start preview with sample app; iframe shows sample app.
6. Stop/restart runtime.
7. Cancel active run.
8. Trigger conflict and resolve/observe conflict UI.

## Production validation gates

A release should require:

- TypeScript compile passes.
- Frontend build passes.
- Unit/integration/E2E tests pass.
- Tool registry audit passes.
- Route contract test confirms every frontend `/api/*` call has a mounted route or explicit feature flag.
- Smoke test starts API server with test DB and hits `/health`, `/api/projects`, `/api/realtime`, and `/preview/frame`.
- Security tests verify sandbox path escape prevention and command restrictions.

## Current test gaps

- **FACT**: Configured `npm test` references a missing path but still completed successfully during validation.
- **FACT**: Existing file explorer tests are not wired into package script.
- **FACT**: No visible E2E test suite was found.
- **FACT**: No architecture/import graph test was found.
- **INFERRED**: Runtime, preview, terminal, and orchestration flows need more integration coverage before production use.
