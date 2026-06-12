# Error Recovery

## Failure detection mechanisms

### Global process errors

**FACT**: `main.ts` installs global error handlers from `server/shared/errors` before bootstrapping.

### Startup diagnostics

**FACT**: Startup diagnostics run at server bootstrap and orchestrator initialization.

### Controller validation

**FACT**: Many controllers validate request parameters/bodies and return 400 for missing or invalid inputs.

Examples:

- Project name required.
- Run payload schema validation.
- Terminal session requires `projectId` and `cwd`.
- Terminal command requires `command`.
- File explorer write requires `filePath` and string `content`.

### Tool reality checks

**FACT**: Tool dispatcher treats non-zero terminal exit codes as failures and verifies file/folder existence or deletion after successful filesystem tool responses.

### Runtime detection

**FACT**: Preview runtime detects missing sandbox/runnable command and returns `empty` errors rather than attempting to start nothing.

### Verifier agent/tools

**FACT**: Verifier tools exist for typecheck, build, lint, tests, runtime validation, dependency validation, root-cause detection, runtime crash detection, log parsing, and failure recovery.

## Retry behavior

**FACT**: Tool dispatcher supports retry policy with delay before retrying failed attempts.

**FACT**: Agent directories include retry managers for planner, executor, filesystem, browser, terminal, verifier, and coderx-style flows.

**INFERRED**: Retry behavior is intended to be localized in execution loops and tool dispatch rather than HTTP controllers.

## Crash recovery

### Implemented

- **FACT**: `/api/run/active` allows frontend run reattach to persisted running runs.
- **FACT**: `/api/realtime` accepts `lastEventId` for SSE reconnection.
- **FACT**: Runtime status and lifecycle state endpoints allow UI resynchronization.
- **FACT**: Checkpoint routes can restore file snapshots.

### Missing

- **FACT**: In-memory folder state is not recoverable.
- **FACT**: Conversation/session/turn managers are in-memory.
- **INFERRED**: Active orchestration state is not fully reconstructable after process crash.
- **INFERRED**: Running DB rows may remain `running` after API process death unless startup diagnostics or external cleanup updates them; no explicit reconciliation was verified in `main.ts`.
- **INFERRED**: Child sandbox processes may outlive server shutdown unless runtime manager handles process groups elsewhere; `main.ts` only closes HTTP server on SIGTERM.

## Fallback behavior

### Missing LLM key

**FACT**: Chat orchestrator streams a friendly error and fails the run when no OpenRouter key exists and the prompt cannot run through a no-LLM simple file path.

### No runnable preview app

**FACT**: Runtime start/restart returns `{ ok: false, empty: true }` and lifecycle is marked crashed if no command can be detected.

### No proxyable runtime

**FACT**: `/preview/frame` returns idle HTML.

### Watcher startup failure

**FACT**: File watcher startup errors are logged without crashing the server.

## Known defects impacting recovery

1. **FACT**: Frontend import/metrics endpoints are not mounted; UI error recovery for these flows depends on page-level catch blocks rather than real backend support.
2. **FACT**: Attachment router declares `/:id` before `/run/:runId`, creating a route-order bug risk.
3. **FACT**: Package test script omits existing file-explorer tests, so recovery-sensitive file operations are not covered by the default test command.

## Production recovery recommendations

1. Add startup reconciliation:
   - Mark stale `running` runs as `failed` or `interrupted`.
   - Rehydrate or clear runtime/session state.
   - Validate sandbox path existence for active projects.
2. Persist folders, conversations, sessions, and import jobs.
3. Add durable event replay table or bounded Redis stream keyed by project/run/topic.
4. Gracefully stop child processes, terminal sessions, watchers, DB pool, Redis/queue, SSE, and WebSocket connections on SIGTERM/SIGINT.
5. Make checkpoint creation transactional or clearly mark run completion as `completed_without_checkpoint` when checkpoint fails.
6. Convert unimplemented UI flows to disabled/coming-soon states or mount real routes.
