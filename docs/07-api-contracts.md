# API Contracts

## Contract notation

- **FACT**: Route is mounted in `main.ts` or a mounted router.
- **Dead/Unwired**: Frontend calls it but no mounted route was found.
- Response examples describe actual shapes observed in handlers where available.

## Health

### `GET /health` — FACT

Response:

```json
{ "ok": true, "uptime": 123.45 }
```

## Realtime

### `GET /api/realtime?projectId=&runId=&lastEventId=` — FACT

Server-Sent Events stream.

Query:

- `projectId` optional number.
- `runId` optional string.
- `lastEventId` optional string; header `Last-Event-ID` is also accepted.

Behavior: subscribes response to all `TOPIC` values and cleans up on request close.

## Projects

### `GET /api/projects` — FACT

Response:

```json
{ "ok": true, "data": [{ "id": 1, "name": "...", "status": "idle" }] }
```

### `POST /api/projects` — FACT

Request:

```json
{ "name": "My App", "description": "optional", "framework": "optional" }
```

Validation:

- `name` is required and must be non-empty after trim.

Response:

```json
{ "ok": true, "data": { "id": 1, "name": "My App", "sandboxPath": "/tmp/nurax-sandbox/my-app-..." } }
```

Errors:

- 400 `{ "ok": false, "error": "name is required" }`
- 500 `{ "ok": false, "error": "..." }`

### `GET /api/projects/:id` — FACT

Errors:

- 404 `{ "ok": false, "error": "Not found" }`

### `PATCH /api/projects/:id` — FACT

Request fields: `name`, `description`, `framework`, `status`.

Response: `{ "ok": true, "data": project }`.

## Folders

### `GET /api/folders` — FACT

Returns an in-memory array, not an `{ ok }` envelope.

### `POST /api/folders` — FACT

Request: `{ "name": "Folder" }`.

Response: folder object.

### `PATCH /api/folders/:id` — FACT

Request: `{ "name": "New Name" }`.

### `DELETE /api/folders/:id` — FACT

Intended response: `{ "ok": true }`.

## Runtime compatibility/status

### `GET /api/project-status` — FACT

Response includes `running` process entries and all runtime `entries` with `projectId`, `pid`, `port`, `status`, `command`, `startedAt`, `restartCount`, and `processAlive`.

### `GET /api/tunnel-info` — FACT

Response: `{ "ok": true, "url": "https://<REPLIT_DEV_DOMAIN>" | null }`.

### `POST /api/run-project` and `POST /api/stop-project` — FACT

Return HTTP 410. Use `/api/runtime/:projectId/start|stop` instead.

### `GET /api/artifacts` — FACT

Currently returns `{ "ok": true, "artifacts": [] }`.

## Chat and runs

### `POST /api/run` — FACT

Request:

```json
{ "projectId": 1, "goal": "Build a todo app", "mode": "auto" }
```

Response:

```json
{ "ok": true, "data": { "runId": "uuid", "projectId": 1, "goal": "...", "status": "running" } }
```

Errors:

- 400 `{ "ok": false, "error": { "message": "Invalid request", "details": {} } }`
- 500 `{ "ok": false, "error": { "message": "..." } }`

### `POST /api/run/start` — FACT

Legacy alias returning unwrapped run object with HTTP 202.

### `GET /api/run/active?projectId=N` — FACT

Response: `{ "ok": true, "run": run | null }`.

### `POST /api/run/:runId/cancel` — FACT

Response: `{ "runId": "...", "cancelled": true }` or `{ "cancelled": false, "reason": "Run is not active" }`.

### `GET /api/runs?projectId=N` — FACT

Returns recent runs for a project.

### `GET /api/runs/:runId` — FACT

Returns run or 404.

### `GET /api/chat/conversations?projectId=N` — FACT

Returns in-memory conversations for a project.

### `POST /api/chat/messages` — FACT

Stores a user message after schema validation.

### `PATCH /api/chat/messages/:id/feedback` — FACT

Sets message feedback.

### `GET /api/chat/messages?projectId=N` and `GET /api/chat/runs/:runId/messages` — FACT

History endpoints.

## Questions

### `GET /api/questions/runs/:runId/questions` — FACT

Lists pending questions for a run.

### `POST /api/questions/:questionId/answer` — FACT

Request: `{ "answer": "..." }`.

### `DELETE /api/questions/:questionId` — FACT

Cancels a question.

Legacy aliases also exist with `/questions/:questionId/...` under the questions router.

## Attachments

### `GET /api/attachments?projectId=N` — FACT

Lists attachments by project.

### `GET /api/attachments/:id` — FACT

Fetches one attachment.

### `GET /api/attachments/run/:runId` — FACT, route-order risk

**Risk**: In the router, `/:id` is declared before `/run/:runId`; Express may match `/run/:runId` as `id = "run"` depending route order. Move `/run/:runId` before `/:id`.

### `POST /api/attachments/upload` — FACT

Upload controller exists.

## Checkpoints

Mounted under `/api/checkpoints`.

- `GET /` list.
- `POST /` create.
- `GET /:checkpointId` get.
- `DELETE /:checkpointId` delete.
- `POST /:checkpointId/rollback` rollback.
- `GET /:checkpointId/diff` diff.

## Orchestration

Mounted under `/api/orchestration`.

### `POST /api/orchestration/run` — FACT

Required request fields: `runId`, `projectId`, `sandboxRoot`, `goal`.

Errors:

- 400 missing required fields.
- 500 when orchestration result `ok` is false.

### Diagnostics — FACT

- `GET /api/orchestration/active`
- `GET /api/orchestration/stuck`
- `GET /api/orchestration/metrics`
- `GET /api/orchestration/diagnostics/:runId`
- `DELETE /api/orchestration/cleanup/:runId`

## Terminal

Mounted under `/api/terminal`.

- `POST /sessions` with `projectId`, `cwd`, optional `env`.
- `GET /sessions?projectId=N`.
- `GET /sessions/:sessionId`.
- `DELETE /sessions/:sessionId`.
- `POST /sessions/:sessionId/run` with `command` and optional command input fields.
- `POST /sessions/:sessionId/runtime/start`.
- `POST /sessions/:sessionId/runtime/stop`.
- `POST /sessions/:sessionId/runtime/restart`.
- `GET /sessions/:sessionId/logs`.
- `GET /sessions/:sessionId/history`.
- `GET /sessions/:sessionId/stream` SSE.

## File explorer

Mounted under `/api/file-explorer`.

- `GET /tree`
- `GET /read?filePath=...`
- `POST /write` with `filePath`, `content`, optional `clientMtime`
- `POST /create`
- `POST /rename`
- `POST /delete`
- `POST /duplicate`
- `POST /upload` multipart files, up to 50
- `GET /download`
- `GET /search?q=...`
- `GET /metadata?filePath=...`
- `GET /history?filePath=...`
- `GET /git-status`
- `GET /insights`
- `GET /health`

Legacy aliases are mounted under `/api`, including list/read/save/rename/delete/duplicate/stat plus undo and conflict-check handlers from the legacy file router.

## Preview and runtime

### Preview API — FACT

Mounted under `/api/preview`:

- `GET /state`, `GET /state/:projectId`
- `GET /health`, `GET /health/:projectId`
- `GET /metrics`, `GET /metrics/:projectId`
- `GET /session/:id`
- `POST /reload`
- `POST /start`
- `POST /stop`
- `POST /lifecycle`
- `POST /debug`
- `GET /devtools`
- `POST /devtools/console`
- `POST /devtools/network`
- `GET /stream`

### Runtime API — FACT

Mounted under `/api/runtime`:

- `POST /:projectId/start`
- `POST /:projectId/restart`
- `POST /:projectId/stop`

### Preview frame — FACT

Mounted at `/preview/frame`. Proxies to a running sandbox app port or returns idle HTML.

### Lifecycle shortcut — FACT

- `GET /api/lifecycle-state`
- `GET /api/lifecycle-state/:projectId`

## Dead/unwired frontend API calls

**FACT**: No mounted server routes were found for:

- `/api/import/git`
- `/api/import/figma`
- `/api/import/base44`
- `/api/import/zip`
- `/api/import/status/:importId`
- `/api/agents/metrics`

