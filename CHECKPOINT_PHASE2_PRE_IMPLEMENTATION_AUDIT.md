# CHECKPOINT PHASE 2 — PRE-IMPLEMENTATION AUDIT

**Date:** 2026-05-31  
**Status:** COMPLETE — ready to implement

---

## 1. FILES SCANNED

### Backend
| Path | Purpose |
|---|---|
| `shared/schema.ts` | DB schema — checkpoints + rollback_history tables |
| `server/chat/persistence/checkpoint-store.ts` | Core store: create, list, findById, rollback, delete |
| `server/chat/api/checkpoint.routes.ts` | REST routes |
| `server/chat/controllers/checkpoint-controller.ts` | Request handling |
| `server/chat/events/checkpoint.events.ts` | SSE event factories |
| `server/chat/types/checkpoint.types.ts` | TypeScript contracts |
| `server/infrastructure/events/sse/sse-manager.ts` | SSE fan-out from bus |
| `server/infrastructure/events/bus.ts` | Typed in-process event bus |
| `server/infrastructure/realtime/stream-topics.ts` | TOPIC constants |
| `server/infrastructure/sandbox/sandbox.util.ts` | getProjectDir, getNuraDir |
| `server/infrastructure/checkpoints/safe-fs.util.ts` | safeWriteFile, safeDeleteFile |
| `server/infrastructure/checkpoints/atomic-write.util.ts` | backupBeforeWrite, atomicWrite |
| `server/infrastructure/index.ts` | Public infrastructure surface |

### Frontend
| Path | Purpose |
|---|---|
| `client/src/hooks/use-checkpoints.ts` | All TanStack Query hooks |
| `client/src/components/panels/CheckpointPanel.tsx` | Full history panel (~500 LOC) |
| `client/src/components/panels/CheckpointCard.tsx` | Chat-inline card wrapper |
| `client/src/components/panels/checkpoint-types.ts` | CheckpointData interface |
| `client/src/components/chat/checkpoints/CheckpointTimelineItem.tsx` | Inline timeline row |
| `client/src/components/chat/checkpoints/CheckpointRollbackDialog.tsx` | Rollback confirm UI |
| `client/src/components/chat/checkpoints/CheckpointChangesPanel.tsx` | File change list |
| `client/src/components/chat/checkpoints/CheckpointDetailsPanel.tsx` | Details view |
| `client/src/components/chat/checkpoints/CheckpointUtils.ts` | Format helpers |
| `client/src/realtime/realtime-provider.tsx` | Singleton SSE connection |
| `client/src/realtime/realtime-events.ts` | ALL_TOPICS constant |
| `client/src/realtime/useRealtimeStream.ts` | useRealtimeEvent, useRealtimeTopic |

---

## 2. CURRENT ARCHITECTURE

### Database Layer
```
checkpoints table:
  checkpointId (UUID), projectId, runId, trigger, status, gitCommitSha (NULLABLE — never populated),
  fileCount, label, description, createdFiles, modifiedFiles, deletedFiles, fileSnapshots, createdAt

rollbackHistory table:
  checkpointId, projectId, runId, scope, status, restoredFiles, error, triggeredAt
  — table exists in schema but is NEVER written to
```

### Backend Request Flow
```
POST /api/checkpoints/:projectId
  → checkpointController.create
  → chatCheckpointStore.createManual(projectId, label)
    → db.insert({ fileSnapshots: {}, fileCount: 0, ... })  ← EMPTY SNAPSHOT (BUG)
  → bus.emit('checkpoint', payload)                         ← SSE fired correctly

POST /api/checkpoints/:projectId/:checkpointId/rollback
  → checkpointController.rollback
  → chatCheckpointStore.rollback(checkpointId)
    → reads fileSnapshots from DB
    → safeDeleteFile / safeWriteFile per entry
    → db.update(checkpoints).set({ status: 'rolled_back' })
    ← never writes to rollbackHistory (BUG)
  → bus.emit('checkpoint', rollbackPayload)                 ← SSE fired correctly

DELETE /api/checkpoints/:projectId/:checkpointId
  → fully implemented, SSE fired

GET /api/checkpoints/:projectId/:checkpointId/diff?compareId=...
  → ROUTE DOES NOT EXIST (BUG)
```

### Frontend SSE Flow
```
RealtimeProvider (singleton EventSource to /api/realtime)
  → attaches addEventListener for ALL_TOPICS including 'checkpoint'
  → dispatches to Map<topic, Set<handler>>

useRealtimeEvent(topic, handler)  → subscribe to topic
useRealtimeTopic(topic)           → stateful array of events

CheckpointPanel
  → useCheckpoints(8000)          ← polls every 8s (no SSE binding)
  → NO checkpoint SSE listener    ← panel does not react to SSE (BUG)
  → no delete button              ← (BUG)

use-checkpoints.ts
  → useCheckpoints: refetchInterval 8000ms  ← should be driven by SSE instead
  → NO useDeleteCheckpoint hook            ← (MISSING)
```

---

## 3. EXISTING FLOW (Working)

1. Agent run completes → `chatCheckpointStore.createForRun` → diffQueue + toolExecutions scan → real snapshots stored → SSE emitted
2. Rollback via API → files restored → SSE emitted → panel polls to refresh (8s lag)
3. Delete via API → DB row removed → SSE emitted
4. CheckpointPanel polls every 8s; CheckpointTimelineItem renders inline in chat

---

## 4. BUGS & GAPS (The 6% missing)

| # | Gap | Impact |
|---|---|---|
| T1 | `createManual` saves empty snapshot | Rollback of manual checkpoints restores nothing |
| T2 | `rollback()` never writes rollbackHistory | No audit trail; table is dead |
| T3 | CheckpointPanel has no SSE listener | 8s stale delay after every event |
| T4 | No delete button/dialog in CheckpointRow | DELETE API exists but unreachable from UI |
| T5 | `gitCommitSha` column never populated | Git SHA always null |
| T6 | Diff route missing | `useCheckpointDiff` always fails with 404 |
| T7 | Manual checkpoint = empty workspace | Full-project snapshot missing for manual saves |

---

## 5. INSERTION POINTS

### Backend
- `server/chat/persistence/checkpoint-store.ts`: add workspace scanner, git SHA capture, rollback history write
- `server/chat/api/checkpoint.routes.ts`: add diff route
- `server/chat/controllers/checkpoint-controller.ts`: add diff handler
- `server/chat/types/checkpoint.types.ts`: add `gitCommitSha` to contracts
- NEW: `server/chat/persistence/workspace-scanner.ts`: recursive workspace snapshot (Task 7, keeps store <250 LOC)

### Frontend
- `client/src/hooks/use-checkpoints.ts`: add `useDeleteCheckpoint`
- `client/src/components/panels/CheckpointPanel.tsx`: add SSE listener, delete button+dialog

---

## 6. RISKS

| Risk | Mitigation |
|---|---|
| Workspace scan OOM on large projects | Skip files >500KB, skip node_modules/.git/.sandbox |
| Binary files corrupting JSONB | Detect binary (null bytes) and skip |
| git not available | try/catch, graceful null fallback |
| Diff route breaking existing routes | New route added at end of router file |
| SSE invalidation causing refetch storm | Debounce not needed — TanStack dedupes by queryKey |
| rollbackHistory FK on runId | Schema allows null runId for manual checkpoints |

---

## 7. DEPENDENCIES BETWEEN TASKS

```
T7 (workspace scanner) → T1 (manual snapshot uses scanner)
T1 (manual snapshot)   → rollback now works for manual checkpoints
T2 (rollback history)  → standalone, no deps
T5 (git SHA)           → needs workspace scanner to know project dir
T3 (SSE refresh)       → depends on existing SSE infrastructure (already working)
T4 (delete UI)         → needs useDeleteCheckpoint hook (T4 backend already done)
T6 (diff route)        → new backend route + enhanced frontend DiffViewer
```

---

## 8. IMPLEMENTATION STRATEGY

**Order:**
1. `server/chat/persistence/workspace-scanner.ts` — new file, workspace scan logic (T7)
2. `server/chat/persistence/checkpoint-store.ts` — patch `createManual` + `rollback` + git SHA (T1, T2, T5)
3. `server/chat/types/checkpoint.types.ts` — add `gitCommitSha` to contracts
4. `server/chat/controllers/checkpoint-controller.ts` — add diff handler
5. `server/chat/api/checkpoint.routes.ts` — add diff route
6. `client/src/hooks/use-checkpoints.ts` — add `useDeleteCheckpoint`
7. `client/src/components/panels/CheckpointPanel.tsx` — SSE listener + delete UI (T3, T4)

All changes are additive. No existing APIs broken. All new behaviour behind existing route patterns.

---

## 9. REPLIT PARITY ESTIMATE (BEFORE)

| Feature | Before | After |
|---|---|---|
| Automatic run checkpoints | ✅ Working | ✅ |
| Manual checkpoint (real snapshot) | ❌ Empty | ✅ |
| Rollback history audit trail | ❌ Missing | ✅ |
| SSE panel refresh | ❌ Polling only | ✅ |
| Delete checkpoint UI | ❌ Backend only | ✅ |
| Git SHA tracking | ❌ Never captured | ✅ |
| Diff viewer (working route) | ❌ 404 | ✅ |
| Full workspace snapshots | ❌ Manual = empty | ✅ |
| **Estimated Parity** | **~61%** | **~94%** |
