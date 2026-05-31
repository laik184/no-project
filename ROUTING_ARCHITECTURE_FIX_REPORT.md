# Routing Architecture Fix Report

---

## 1. Files Scanned

| File | Role |
|------|------|
| `main.ts` | Application entry point, route mounting |
| `server/chat/index.ts` | Chat module bootstrap and facade |
| `server/chat/api/chat.routes.ts` | Chat HTTP routes |
| `server/chat/api/run.routes.ts` | Run query routes under /api/chat/runs |
| `server/chat/api/run-start.router.ts` | Top-level /api/run routes (frontend-facing) |
| `server/chat/api/attachment.routes.ts` | Attachment upload/list routes |
| `server/chat/api/history.routes.ts` | History query routes |
| `server/chat/api/question.routes.ts` | Question/answer routes |
| `server/chat/controllers/chat-controller.ts` | Chat HTTP controller |
| `server/chat/controllers/run-controller.ts` | Run HTTP controller |
| `server/chat/orchestration/chat-orchestrator.ts` | Chat workflow orchestrator |
| `server/chat/realtime/websocket-manager.ts` | WebSocket client registry |
| `server/chat/realtime/sse-manager.ts` | SSE diagnostics facade |
| `server/chat/realtime/connection-registry.ts` | Connection tracking registry |
| `server/orchestration/index.ts` | Orchestration layer public API |
| `server/projects/projects.router.ts` | Projects CRUD router |

---

## 2. Files Modified

| File | Change Summary |
|------|----------------|
| `main.ts` | Removed global multer; removed root SSE mount (`app.use('/')`) |
| `server/chat/index.ts` | Removed module-level `heartbeatManager.start()`; removed `buildSseRouter()`; added SSE route directly to `chatRouter` at `/stream`; removed `buildSseRouter` from facade |
| `server/chat/api/chat.routes.ts` | Removed duplicate `POST /run`; added `POST /upload` alias (scoped multer) |
| `server/chat/api/run.routes.ts` | Removed duplicate `POST /:runId/cancel` |
| `server/chat/api/run-start.router.ts` | Added missing `GET /active` handler |
| `server/chat/api/attachment.routes.ts` | Added scoped multer instance; multer now applied only to `POST /upload` |
| `server/chat/controllers/chat-controller.ts` | Removed `startRun` method (no longer routed) |

---

## 3. Duplicate Endpoints Removed

| Removed Route | Was Duplicate Of | Reason Removed |
|---------------|------------------|----------------|
| `POST /api/chat/run` | `POST /api/run` | Frontend uses `/api/run`; same `chatOrchestrator.startRun()` call |
| `POST /api/chat/runs/:runId/cancel` | `POST /api/run/:runId/cancel` | Frontend uses `/api/run/:runId/cancel`; same `cancelRun()` call |

---

## 4. Duplicate SSE Routes Removed

| Removed | Replaced With |
|---------|---------------|
| `app.use('/', buildSseRouter())` — router with absolute path `/api/chat/stream` mounted at root | `chatRouter.get('/stream', ...)` — relative path, mounted under `/api/chat` |

---

## 5. Duplicate WebSocket Registrations Removed

None found. Single ownership confirmed:
- `chatOrchestrator.attachWebSocket(server)` in `main.ts`
- Handles only `/ws/chat/*` paths
- Delegates to `websocketManager.register()`
- No secondary WS server exists

---

## 6. Bootstrap Order — Before

```
1. bootstrapMemory()
2. [SIDE EFFECT] heartbeatManager.start()  ← module-level, fires on import of chat/index.ts
3. app.use('/api/chat',    chatRouter)
4. app.use('/',            buildSseRouter())  ← root mount, absolute path inside
5. app.use('/api',         consolePipeline)
6. app.use('/api',         previewPipeline)
7. app.use('/api/orchestration', orchestrationRouter)
8. app.use('/api',         projectsRouter)
9. app.use('/api/run',     runStartRouter)
10. chatOrchestrator.attachWebSocket(server)
11. initOrchestration()
12. chatOrchestrator.startPersistence()  ← heartbeatManager.start() again
13. server.listen()
```

---

## 7. Bootstrap Order — After

```
1. bootstrapMemory()
2. app.use('/api/chat',    chatRouter)        ← includes /stream SSE
3. app.use('/api',         consolePipeline)
4. app.use('/api',         previewPipeline)
5. app.use('/api/orchestration', orchestrationRouter)
6. app.use('/api',         projectsRouter)
7. app.use('/api/run',     runStartRouter)
8. chatOrchestrator.attachWebSocket(server)
9. initOrchestration()
10. chatOrchestrator.startPersistence()       ← single heartbeat start
11. server.listen()
```

---

## 8. Public API Tree — Before

```
GET  /health
POST /api/chat/run                         ⚠️ DUPLICATE of POST /api/run
POST /api/chat/message
POST /api/chat/feedback
GET  /api/chat/conversations
POST /api/chat/attachments/upload          (global multer applied to ALL routes)
GET  /api/chat/attachments
GET  /api/chat/attachments/:id
GET  /api/chat/history
GET  /api/chat/history/messages
GET  /api/chat/history/run/:runId
GET  /api/chat/questions
GET  /api/chat/questions/:questionId
POST /api/chat/questions/:questionId/answer
DEL  /api/chat/questions/:questionId
GET  /api/chat/runs
GET  /api/chat/runs/active
GET  /api/chat/runs/:runId
POST /api/chat/runs/:runId/cancel          ⚠️ DUPLICATE of POST /api/run/:runId/cancel
GET  /api/chat/stream                      ⚠️ SSE via root-mounted router
POST /api/run                              (frontend primary)
POST /api/run/:runId/cancel                (frontend primary)
❌   GET /api/run/active                   MISSING — frontend calls this (404)
POST /api/orchestration/run
GET  /api/orchestration/active
GET  /api/orchestration/stuck
GET  /api/orchestration/metrics
GET  /api/orchestration/diagnostics/:runId
DEL  /api/orchestration/cleanup/:runId
GET  /api/projects
POST /api/projects
GET  /api/projects/:id
PATCH /api/projects/:id
DEL  /api/projects/:id
POST /api/project/save
POST /api/project/load
WS   /ws/chat
```

---

## 9. Public API Tree — After

```
GET  /health
POST /api/chat/message
POST /api/chat/feedback
GET  /api/chat/conversations
POST /api/chat/upload                      (scoped multer alias — frontend compat)
POST /api/chat/attachments/upload          (scoped multer — canonical)
GET  /api/chat/attachments
GET  /api/chat/attachments/:id
GET  /api/chat/history
GET  /api/chat/history/messages
GET  /api/chat/history/run/:runId
GET  /api/chat/questions
GET  /api/chat/questions/:questionId
POST /api/chat/questions/:questionId/answer
DEL  /api/chat/questions/:questionId
GET  /api/chat/runs
GET  /api/chat/runs/active
GET  /api/chat/runs/:runId
GET  /api/chat/stream                      ✓ SSE — relative path on chatRouter
POST /api/run                              ✓ Single source of truth (frontend)
POST /api/run/:runId/cancel                ✓ Single source of truth (frontend)
GET  /api/run/active                       ✓ Fixed — was 404
POST /api/orchestration/run
GET  /api/orchestration/active
GET  /api/orchestration/stuck
GET  /api/orchestration/metrics
GET  /api/orchestration/diagnostics/:runId
DEL  /api/orchestration/cleanup/:runId
GET  /api/projects
POST /api/projects
GET  /api/projects/:id
PATCH /api/projects/:id
DEL  /api/projects/:id
POST /api/project/save
POST /api/project/load
WS   /ws/chat
```

---

## 10. Route Collision Risk — Before

| Risk | Severity | Description |
|------|----------|-------------|
| `POST /api/chat/run` vs `POST /api/run` | HIGH | Same logic, two paths; callers could split |
| `POST /api/chat/runs/:runId/cancel` vs `POST /api/run/:runId/cancel` | HIGH | Same logic, two paths |
| SSE at `app.use('/')` | MEDIUM | Every request traverses root SSE router; absolute path is non-standard |
| Global multer | MEDIUM | Parses multipart bodies on all requests including GET /health |
| `GET /api/run/active` — 404 | HIGH | Frontend silently fails on run recovery |
| Double `heartbeatManager.start()` | LOW | Idempotent but signals uncontrolled startup |

---

## 11. Route Collision Risk — After

| Risk | Severity | Status |
|------|----------|--------|
| Duplicate run start | ✅ RESOLVED | Removed `POST /api/chat/run` |
| Duplicate run cancel | ✅ RESOLVED | Removed `POST /api/chat/runs/:runId/cancel` |
| SSE at root | ✅ RESOLVED | Moved to `chatRouter` at relative `/stream` |
| Global multer | ✅ RESOLVED | Scoped to upload routes only |
| Missing `GET /api/run/active` | ✅ RESOLVED | Added to `run-start.router.ts` |
| Double heartbeat start | ✅ RESOLVED | Single call via `startPersistence()` |

---

## 12. Remaining Risks

| Item | Severity | Notes |
|------|----------|-------|
| `chatOrchestrator.attachWebSocket()` creates a new `WebSocketServer({ noServer: true })` per upgrade event | LOW | Functionally correct but allocates a new WSS per connection. Refactoring to a shared WSS instance would be more efficient but is a business logic concern outside this task scope. |
| `POST /api/chat/upload` alias duplicates `POST /api/chat/attachments/upload` | INFO | Intentional frontend-compatibility alias. Document and eventually migrate the frontend to `/api/chat/attachments/upload`. |
| `POST /api/project/save` and `POST /api/project/load` use singular `/project/` while all other project routes use plural `/projects/` | LOW | Inconsistent naming; no fix applied as it is a business logic contract. |

---

## 13. Recommended Architecture

```
main.ts
├── bootstrapMemory()
├── GET  /health
├── app.use('/api/chat',         chatRouter)   ← owns all chat + SSE
├── app.use('/api/run',          runStartRouter) ← frontend-facing run lifecycle
├── app.use('/api',              consolePipeline)
├── app.use('/api',              previewPipeline)
├── app.use('/api/orchestration', orchestrationRouter)
├── app.use('/api',              projectsRouter)
├── chatOrchestrator.attachWebSocket(server)   ← single WS owner
├── initOrchestration()
└── chatOrchestrator.startPersistence()        ← single heartbeat owner

chatRouter (/api/chat/*)
├── POST   /message
├── POST   /feedback
├── GET    /conversations
├── POST   /upload          ← multer scoped
├── GET    /stream          ← SSE, relative path
├── /attachments/*          ← multer scoped
├── /runs/*                 ← read-only queries
├── /history/*
└── /questions/*

runStartRouter (/api/run/*)   ← single source of truth for run actions
├── GET    /active
├── POST   /
└── POST   /:runId/cancel
```

---

## 14. Final Health Score

| Category | Before | After |
|----------|--------|-------|
| Duplicate endpoints | 2 duplicates | 0 duplicates |
| Missing endpoints (404 gaps) | 1 (GET /api/run/active) | 0 |
| SSE routing correctness | Root-mounted, absolute path | Correctly mounted under /api/chat |
| Middleware scope | Global multer on all requests | Scoped to upload routes only |
| Bootstrap side effects | Heartbeat started twice | Heartbeat started once |
| WebSocket ownership | Single (no change needed) | Single ✓ |
| **Overall** | **⚠️ 6 issues** | **✅ Clean** |
