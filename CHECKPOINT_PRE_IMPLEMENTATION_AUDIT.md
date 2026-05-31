# CHECKPOINT PRE-IMPLEMENTATION AUDIT

Generated: 2026-05-31

---

## 1. Files Scanned

| File | Status |
|------|--------|
| `shared/schema.ts` | ✅ Scanned |
| `server/chat/orchestration/chat-orchestrator.ts` | ✅ Scanned |
| `server/chat/persistence/checkpoint-store.ts` | ✅ Scanned |
| `server/chat/persistence/` (all files) | ✅ Scanned |
| `server/chat/api/checkpoint.routes.ts` | ✅ Scanned |
| `server/chat/controllers/checkpoint-controller.ts` | ✅ Scanned |
| `server/chat/events/checkpoint.events.ts` | ✅ Scanned |
| `server/chat/types/checkpoint.types.ts` | ✅ Scanned |
| `server/chat/index.ts` | ✅ Scanned |
| `client/src/components/chat/useAgentRunner.ts` | ✅ Scanned |
| `client/src/components/panels/CheckpointCard.tsx` | ✅ Scanned |
| `client/src/components/panels/checkpoint-types.ts` | ✅ Scanned |
| `client/src/components/chat/ChatMessages.tsx` | ✅ Scanned |
| `client/src/components/chat/agent-event-handler.ts` | ✅ Scanned |
| `client/src/components/chat/types.ts` | ✅ Scanned |
| `client/src/hooks/use-checkpoints.ts` | ✅ Scanned |
| `client/src/components/panels/CheckpointPanel.tsx` | ✅ Scanned |
| `client/src/components/chat/checkpoints/CheckpointTimelineItem.tsx` | ✅ Scanned |
| `client/src/components/chat/checkpoints/CheckpointRollbackDialog.tsx` | ✅ Scanned |
| `client/src/components/chat/checkpoints/CheckpointChangesPanel.tsx` | ✅ Scanned |
| `client/src/components/chat/checkpoints/CheckpointDetailsPanel.tsx` | ✅ Scanned |
| `server/infrastructure/events/sse/sse-manager.ts` | ✅ Scanned |
| `server/infrastructure/realtime/stream-topics.ts` | ✅ Scanned |

---

## 2. Current Checkpoint Flow (Actual State)

```
User sends message
  → POST /api/run
  → chatOrchestrator.startRun()
  → orchestrate() [async fire-and-forget]
     → on success → chatOrchestrator.completeRun()
        → chatCheckpointStore.createForRun()   ← queries diffQueue + toolExecutions for real files
           → INSERT INTO checkpoints (real DB write)
           → returns ChatCheckpoint
        → makeCheckpointCreatedPayload(cp)
        → bus.emit('checkpoint', payload)       ← SSE broadcast as named event
        → bus.emit('run.lifecycle', { status:'completed' })
  → frontend subscribe("checkpoint", handler)   ← receives real event
     → buildCheckpointMessage()                 ← builds CheckpointData from SSE payload
     → setMessages() with checkpoint role msg
  → ChatMessages.tsx renders CheckpointCard
     → CheckpointCard → CheckpointTimelineItem
        → CheckpointDetailsPanel (description, timestamp, files)
        → CheckpointRollbackDialog (real POST /api/checkpoints/:pid/:id/rollback)
        → CheckpointChangesPanel (created/modified/deleted file lists)
```

---

## 3. Existing SSE Flow

```
bus.emit('checkpoint', payload)
  → sse-manager bus.on('checkpoint', ...) listener
  → broadcastToTopic('checkpoint', payload, projectId, undefined)
  → writes: "event: checkpoint\ndata: <json>\n\n"
  → EventSource at /api/realtime receives named event
  → RealtimeProvider dispatches to subscribe("checkpoint", ...) listeners
  → useAgentRunner offCheckpoint handler fires
```

---

## 4. Existing DB Flow

```
checkpoints table (PostgreSQL):
  id              SERIAL PK
  checkpointId    VARCHAR(64) UNIQUE  ← UUID
  projectId       INTEGER FK → projects
  runId           VARCHAR(64) FK → agentRuns (SET NULL on delete)
  trigger         VARCHAR(32)         ← 'run_complete' | 'manual' | etc.
  status          VARCHAR(32)         ← 'stable' | 'rolled_back'
  gitCommitSha    VARCHAR(64)
  fileCount       INTEGER
  label           TEXT
  description     TEXT
  createdFiles    JSONB
  modifiedFiles   JSONB
  deletedFiles    JSONB
  fileSnapshots   JSONB               ← {filePath: oldContent|null} for rollback
  createdAt       TIMESTAMP

rollbackHistory table also exists.
```

---

## 5. Existing Rollback Flow

```
POST /api/checkpoints/:projectId/:checkpointId/rollback
  → checkpointController.rollback()
  → chatCheckpointStore.rollback(checkpointId)
     → SELECT checkpoint row
     → iterate fileSnapshots:
        oldContent===null → safeDeleteFile(abs)  ← delete created files
        else             → safeWriteFile(abs, oldContent)  ← restore
     → UPDATE checkpoints SET status='rolled_back'
     → returns { ok, checkpointId, filesRestored }
  → res.json({ ok: true, ...result })
```

**GAP: No SSE event emitted after rollback.** The controller does not call `bus.emit`.

---

## 6. Existing UI Flow

```
CheckpointCard (thin wrapper)
  └── CheckpointTimelineItem
       ├── Collapsed: "Checkpoint made N min ago" + "latest" badge + chevron
       ├── Details panel (click to expand):
       │    ├── CheckpointDetailsPanel: description, timestamp, file count + lists
       │    ├── [Rollback here] → CheckpointRollbackDialog
       │    │    ├── Warning message
       │    │    ├── Cancel button
       │    │    └── Confirm → POST /api/checkpoints/:pid/:id/rollback (REAL API)
       │    └── [Changes] → CheckpointChangesPanel
       │         ├── Created files list
       │         ├── Modified files list
       │         └── Deleted files list
       └── On rollback success: setReverted(true), grays out card

CheckpointPanel (side panel):
  └── useCheckpoints() → GET /api/checkpoints/:pid (real API, polling 8s)
  └── useRollbackCheckpoint() → POST /api/checkpoints/:pid/:id/rollback (real API)
  └── useCreateCheckpoint() → POST /api/checkpoints/:pid  ← MISSING BACKEND ROUTE
```

---

## 7. Risks

| Risk | Severity | Details |
|------|----------|---------|
| `useCreateCheckpoint` calls 404 | HIGH | `POST /api/checkpoints/:projectId` not implemented |
| No SSE after rollback | MEDIUM | Frontend CheckpointPanel doesn't know rollback happened in real-time |
| No delete endpoint | LOW | `DELETE /api/checkpoints/:projectId/:checkpointId` missing |
| `rollbackHistory` table unused | LOW | Records rollbacks but nothing writes to it |

---

## 8. What Already Exists (DO NOT REWRITE)

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 (DB) | ✅ DONE | `checkpoints` table is identical to `agent_checkpoints` spec |
| Phase 2 (Types) | ✅ DONE | All types in `checkpoint.types.ts`; missing `CheckpointDeleteEvent` |
| Phase 3 (Events) | ✅ DONE | Missing only `makeCheckpointDeletedEvent()` |
| Phase 4 (Persistence) | ✅ DONE | Missing `createManual()` and `deleteCheckpoint()` |
| Phase 5 (Auto Creation) | ✅ DONE | `completeRun` creates + emits checkpoint |
| Phase 6 (SSE) | ⚠️ PARTIAL | Created ✅, Rollback ❌ (no emit), Delete ❌ |
| Phase 7 (API Routes) | ⚠️ PARTIAL | List/Get/Rollback ✅, Create manual ❌, Delete ❌ |
| Phase 8 (Frontend Types) | ✅ DONE | `CheckpointData` has all fields |
| Phase 9 (Frontend SSE) | ✅ DONE | Real SSE handler in `useAgentRunner.ts` |
| Phase 10 (Real Rollback) | ✅ DONE | `CheckpointRollbackDialog` uses real API |
| Phase 11 (Replit Parity UI) | ✅ DONE | Full timeline item with all panels |
| Phase 12 (Validation) | ⚠️ PENDING | Run after gaps filled |

---

## 9. Exact Insertion Points for Missing Pieces

### A. `server/chat/types/checkpoint.types.ts`
Add at bottom: `CheckpointDeleteEvent` type (reuses `CheckpointSSEPayload` shape).

### B. `server/chat/events/checkpoint.events.ts`
Add: `makeCheckpointDeletedEvent(checkpointId, projectId)` factory.

### C. `server/chat/persistence/checkpoint-store.ts`
Add two functions:
- `createManual(projectId, label)` — INSERT a manual checkpoint (no run scoping)
- `deleteCheckpoint(checkpointId)` — DELETE row by checkpointId

### D. `server/chat/controllers/checkpoint-controller.ts`
Add two handlers:
- `create(req, res)` — calls `createManual()`, emits SSE
- `delete(req, res)` — calls `deleteCheckpoint()`, emits SSE
Modify `rollback()` — emit `bus.emit('checkpoint', rollbackPayload)` after success.

### E. `server/chat/api/checkpoint.routes.ts`
Add:
- `router.post('/:projectId', ...)` — manual create
- `router.delete('/:projectId/:checkpointId', ...)` — delete

---

## 10. Implementation Plan

Implement in order to avoid dependency issues:

1. Types → `checkpoint.types.ts` (add `CheckpointDeleteEvent`)
2. Events → `checkpoint.events.ts` (add `makeCheckpointDeletedEvent`)
3. Store → `checkpoint-store.ts` (add `createManual`, `deleteCheckpoint`)
4. Controller → `checkpoint-controller.ts` (add `create`, `delete`; fix `rollback` SSE)
5. Routes → `checkpoint.routes.ts` (add POST /:projectId, DELETE /:projectId/:checkpointId)

No DB migration needed — table already exists with all columns.
No frontend changes needed — all frontend already works correctly.
