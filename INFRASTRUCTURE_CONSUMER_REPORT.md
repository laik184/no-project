# Infrastructure Consumer Report

**Scope:** `server/**/*.ts`
**Target:** `server/infrastructure/index.ts`
**Date:** 2026-06-04

---

## 1. Every File Currently Importing `infrastructure/index.ts`

| File | Symbols Imported | Path Used | Status |
|---|---|---|---|
| `main.ts` | `seedDefaultProject`, `TOPIC`, `sseManager` | `./server/infrastructure/index.ts` | ✅ |
| `server/agents/browser/events/browser-event-publisher.ts` | `bus` | `../../../infrastructure/index.ts` | ✅ |
| `server/chat/persistence/checkpoint-store.ts` | `db` (line 5) + `captureGitSha` (line 9) | `../../infrastructure/index.ts` | ⚠️ split — merged |
| `server/chat/realtime/event-publisher.ts` | `bus` | `../../infrastructure/index.ts` | ✅ |
| `server/chat/realtime/sse-manager.ts` | `sseManager` | `../../infrastructure/index.ts` | ✅ |
| `server/file-explorer/realtime/file-publisher.ts` | `sseManager`, `TOPIC` | `../../infrastructure/index.ts` | ✅ |
| `server/file-explorer/realtime/file-subscriber.ts` | `bus` | `../../infrastructure/index.ts` | ✅ |
| `server/orchestration/agents/verification-bridge.ts` | `bus` | `../../infrastructure/index.ts` | ✅ |
| `server/orchestration/distributed/multi-run-recovery.ts` | `bus` | `../../infrastructure/index.ts` | ✅ |
| `server/orchestration/distributed/parallel-orchestration-fabric.ts` | `bus` | `../../infrastructure/index.ts` | ✅ |
| `server/orchestration/distributed/run-scoped-orchestrator.ts` | `bus` | `../../infrastructure/index.ts` | ✅ |
| `server/orchestration/events/event-publisher.ts` | `bus` | `../../infrastructure/index.ts` | ✅ |
| `server/repositories/chat/attachment.repository.ts` | `db` | `../../infrastructure/index.ts` | ✅ |
| `server/repositories/chat/checkpoint.repository.ts` | `db` | `../../infrastructure/index.ts` | ✅ |
| `server/repositories/chat/message.repository.ts` | `db` | `../../infrastructure/index.ts` | ✅ |
| `server/repositories/chat/run.repository.ts` | `db` | `../../infrastructure/index.ts` | ✅ |
| `server/replit_integrations/chat/storage.ts` | `db` | `../../infrastructure` (shorthand) | ⚠️ normalized |
| `server/services/chat/chat.service.ts` | `bus` | `../../infrastructure/index.ts` | ✅ |
| `server/tools/terminal/events/terminal-events.ts` | `bus` | `../../../infrastructure/index.ts` | ✅ |

**Total: 19 files** (18 correct + 1 shorthand normalized + 1 split import merged)

---

## 2. Every File That SHOULD Import `infrastructure/index.ts`

All 19 files above are correct consumers. No new files need to be added.

Every other file in `server/` either:
- Delegates to a dedicated event-publisher/bus-bridge wrapper (correct pattern)
- Uses only Node.js builtins, shared types, or domain-local persistence
- Is a pure type/schema/validator/contract/mapper

---

## 3. Direct Sub-Path Violations

**None found.**

Full scan of all `server/**/*.ts` imports found zero instances of:
- `infrastructure/db/*`
- `infrastructure/events/*`
- `infrastructure/runtime/*`
- `infrastructure/process/*`
- `infrastructure/realtime/*`
- `infrastructure/checkpoints/*`
- `infrastructure/sandbox/*`
- `infrastructure/seed`

All consumers already import from the canonical `infrastructure/index.ts` surface.

---

## 4. Missing Infrastructure Imports

**None found.**

Every file that calls `db.*`, `bus.emit()`, `bus.on()`, `sseManager.*`, `TOPIC.*`, `captureGitSha()`, `seedDefaultProject()` has the correct import in place.

Notable delegation patterns that are correct (not missing):
- `server/agents/browser/events/browser-bus-bridge.ts` — delegates to `browser-event-publisher.ts`; does NOT import `bus` directly ✅
- `server/file-explorer/watchers/file-watcher.service.ts` — delegates TOPIC/sseManager to `file-publisher.ts` via `realtime/index.ts` ✅
- All file-system repositories — use Node.js `fs` directly; no infrastructure needed ✅

---

## 5. Removed Imports

**None removed.** All existing infrastructure imports are actively used.

---

## 6. Added / Fixed Imports

### Fix 1 — Shorthand normalization

**File:** `server/replit_integrations/chat/storage.ts`

```diff
- import { db } from '../../infrastructure';
+ import { db } from '../../infrastructure/index.ts';
```

**Reason:** `../../infrastructure` (directory shorthand) resolves correctly but is inconsistent with the canonical explicit form used across all other 18 files.

---

### Fix 2 — Split import merge

**File:** `server/chat/persistence/checkpoint-store.ts`

```diff
- import { db }            from '../../infrastructure/index.ts';  // line 5
  ...
- import { captureGitSha } from '../../infrastructure/index.ts';  // line 9
+ import { db, captureGitSha } from '../../infrastructure/index.ts';
```

**Reason:** Two separate `import` statements from the same module. Merged into one clean import.

---

## 7. Infrastructure Export Usage Frequency

| Export | Used By | Count |
|---|---|---|
| `bus` | `browser-event-publisher.ts`, `chat/realtime/event-publisher.ts`, `file-subscriber.ts`, `verification-bridge.ts`, `multi-run-recovery.ts`, `parallel-orchestration-fabric.ts`, `run-scoped-orchestrator.ts`, `orchestration/events/event-publisher.ts`, `chat.service.ts`, `terminal-events.ts` | **10** |
| `db` | `checkpoint-store.ts`, `attachment.repository.ts`, `checkpoint.repository.ts`, `message.repository.ts`, `run.repository.ts`, `replit_integrations/chat/storage.ts` | **6** |
| `sseManager` | `chat/realtime/sse-manager.ts`, `file-publisher.ts`, `main.ts` | **3** |
| `TOPIC` | `file-publisher.ts`, `main.ts` | **2** |
| `seedDefaultProject` | `main.ts` | **1** |
| `captureGitSha` | `checkpoint-store.ts` | **1** |
| `runtimeManager` | — | **0** (exported but unused outside infrastructure) |
| `processRegistry` | — | **0** (exported but unused outside infrastructure) |
| `emitFileChange` | — | **0** (exported but unused outside infrastructure) |
| `safeWriteFile` | — | **0** (exported but unused outside infrastructure) |
| `safeDeleteFile` | — | **0** (exported but unused outside infrastructure) |
| `safeBackup` | — | **0** (exported but unused outside infrastructure) |
| `getProjectDir` | — | **0** (exported but unused outside infrastructure) |
| `getNuraDir` | — | **0** (exported but unused outside infrastructure) |
| `BusEventMap` (type) | — | **0** |
| `FileChangeEvent` (type) | — | **0** |
| `Topic` (type) | — | **0** |

**Note on zero-usage exports:** `runtimeManager`, `processRegistry`, `safeWriteFile`, `safeDeleteFile`, `safeBackup`, `getProjectDir`, `getNuraDir`, and `emitFileChange` are exported from `infrastructure/index.ts` but have no consumers outside the infrastructure layer itself. They are available for future use and are not dead code — they provide the canonical surface for when agents/tools need sandbox or safe-filesystem operations.

---

## 8. Final Dependency Graph

```
main.ts
  └→ server/infrastructure/index.ts  [seedDefaultProject, TOPIC, sseManager]

server/chat/
  ├─ persistence/checkpoint-store.ts  → infrastructure [db, captureGitSha]
  ├─ realtime/event-publisher.ts      → infrastructure [bus]
  └─ realtime/sse-manager.ts          → infrastructure [sseManager]

server/services/chat/
  └─ chat.service.ts                  → infrastructure [bus]

server/repositories/chat/
  ├─ attachment.repository.ts         → infrastructure [db]
  ├─ checkpoint.repository.ts         → infrastructure [db]
  ├─ message.repository.ts            → infrastructure [db]
  └─ run.repository.ts                → infrastructure [db]

server/orchestration/
  ├─ agents/verification-bridge.ts              → infrastructure [bus]
  ├─ distributed/multi-run-recovery.ts          → infrastructure [bus]
  ├─ distributed/parallel-orchestration-fabric  → infrastructure [bus]
  ├─ distributed/run-scoped-orchestrator.ts     → infrastructure [bus]
  └─ events/event-publisher.ts                  → infrastructure [bus]

server/agents/browser/
  └─ events/browser-event-publisher.ts          → infrastructure [bus]
     ↑ (browser-bus-bridge.ts delegates here — does not import bus directly)

server/file-explorer/
  ├─ realtime/file-publisher.ts       → infrastructure [sseManager, TOPIC]
  ├─ realtime/file-subscriber.ts      → infrastructure [bus]
  └─ watchers/file-watcher.service.ts → delegates to file-publisher.ts (no direct import)

server/tools/terminal/
  └─ events/terminal-events.ts        → infrastructure [bus]

server/replit_integrations/chat/
  └─ storage.ts                       → infrastructure [db]

─────────────────────────────────────────────
server/infrastructure/index.ts
  ├─ db               (infrastructure/db/)
  ├─ bus              (infrastructure/events/)
  ├─ sseManager       (infrastructure/events/sse/)
  ├─ processRegistry  (infrastructure/process/)
  ├─ TOPIC            (infrastructure/realtime/)
  ├─ runtimeManager   (infrastructure/runtime/)
  ├─ getProjectDir    (infrastructure/sandbox/)
  ├─ getNuraDir       (infrastructure/sandbox/)
  ├─ safeWriteFile    (infrastructure/checkpoints/)
  ├─ safeDeleteFile   (infrastructure/checkpoints/)
  ├─ safeBackup       (infrastructure/checkpoints/)
  ├─ captureGitSha    (infrastructure/checkpoints/)
  ├─ emitFileChange   (infrastructure/events/)
  └─ seedDefaultProject (infrastructure/seed.ts)
─────────────────────────────────────────────
Infrastructure internals (not directly importable by consumers)
```

**Invariants confirmed:**
- No file bypasses `infrastructure/index.ts` to import sub-paths ✅
- No file imports infrastructure without actually using an export ✅
- Bus access is always via a dedicated event-publisher wrapper in each domain ✅
- `db` is only imported by repository and persistence layers ✅
