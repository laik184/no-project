# INFRASTRUCTURE_DISCIPLINE_FIX_REPORT.md

**Date:** 2026-05-30  
**Scope:** Infrastructure hardening — authorized fixes only  
**Source:** INFRASTRUCTURE_ARCHITECTURE_REPORT.md violations  
**Method:** Minimal targeted changes. No business logic modified. No architectural expansion.

---

## 1. Files Created

| File | Purpose |
|---|---|
| `server/infrastructure/index.ts` | Public infrastructure API barrel — single canonical import point |

---

## 2. Files Modified

| File | Change | Phase |
|---|---|---|
| `server/infrastructure/checkpoints/safe-fs.util.ts` | Added `safeBackup()` export — public wrapper over `backupBeforeWrite` | Phase 4 prerequisite |
| `server/infrastructure/events/sse/sse-manager.ts` | Replaced raw SSE topic strings with `TOPIC` constants | Phase 2 |
| `server/preview/runtime/runtime.service.ts` | Read-only ops migrated to `processRegistry`; write ops remain on `runtimeManager` | Phase 3 |
| `server/file-explorer/crud/crud.service.ts` | Removed `atomic-write.util.ts` import; uses `safeBackup` from `safe-fs.util.ts` | Phase 4 |

---

## 3. Public API Surface (`server/infrastructure/index.ts`)

```typescript
// Database
export { db } from './db/index.ts';

// Event Bus
export { bus, BusEventMap } from './events/bus.ts';

// File Change Events
export { emitFileChange, FileChangeEvent } from './events/file-change-emitter.ts';

// SSE Connection Pool
export { sseManager } from './events/sse/sse-manager.ts';

// Process Observability (read-only facade)
export { processRegistry } from './process/process-registry.ts';

// Stream Topic Constants
export { TOPIC, Topic } from './realtime/stream-topics.ts';

// Runtime Process Management
export { runtimeManager } from './runtime/runtime-manager.ts';

// Sandbox Path Utilities
export { getProjectDir, getNuraDir } from './sandbox/sandbox.util.ts';

// Safe Filesystem Operations
export { safeWriteFile, safeDeleteFile, safeBackup } from './checkpoints/safe-fs.util.ts';
```

**Intentionally excluded (remain internal):**

| File | Reason |
|---|---|
| `runtime/runtime-types.ts` | Implementation-detail types; consumers access data via `processRegistry` |
| `checkpoints/atomic-write.util.ts` | Wrapped by `safe-fs.util.ts`; no external access permitted |

---

## 4. Stream Topic Replacements (`sse-manager.ts`)

**File:** `server/infrastructure/events/sse/sse-manager.ts`

| Location | Before | After |
|---|---|---|
| Line 15 (new import) | *(absent)* | `import { TOPIC } from '../../realtime/stream-topics.ts'` |
| `bus.on` + `broadcastToTopic` — agent fan-out | `broadcastToTopic('agent', ...)` | `broadcastToTopic(TOPIC.AGENT, ...)` |
| `bus.on` + `broadcastToTopic` — lifecycle fan-out | `broadcastToTopic('lifecycle', ...)` | `broadcastToTopic(TOPIC.LIFECYCLE, ...)` |
| `bus.on` + `broadcastToTopic` — checkpoint fan-out | `bus.on('checkpoint', ...)` / `broadcastToTopic('checkpoint', ...)` | `bus.on(TOPIC.CHECKPOINT, ...)` / `broadcastToTopic(TOPIC.CHECKPOINT, ...)` |

**Not replaced (by design):**

| Raw string | Reason not replaced |
|---|---|
| `'agent.event'` in `bus.on` | Bus event channel key from `BusEventMap`; `TOPIC.AGENT = 'agent'` ≠ `'agent.event'` — different namespaces |
| `'run.lifecycle'` in `bus.on` | Same: `TOPIC.LIFECYCLE = 'lifecycle'` ≠ `'run.lifecycle'` |

The bus event channel keys (`agent.event`, `run.lifecycle`) are separate from SSE topic names (`agent`, `lifecycle`, `checkpoint`). Only the SSE topic strings match the `TOPIC` constants. This is a design inconsistency in the original architecture — not introduced or worsened by this change.

---

## 5. Process Registry Fixes (`runtime.service.ts`)

**File:** `server/preview/runtime/runtime.service.ts`

### Imports changed

| Before | After |
|---|---|
| `import { runtimeManager }` only | `import { runtimeManager }` (kept for writes) |
| `import type { RuntimeEntry }` (internal type) | Removed — type inferred via `processRegistry.get()` return type |
| *(absent)* | `import { processRegistry }` added |

### Methods migrated to `processRegistry`

| Method | Operation | Before | After |
|---|---|---|---|
| `run()` — post-start read | Read | `runtimeManager.get(projectId)` | `processRegistry.get(projectId)` |
| `stop()` — running check | Read | `runtimeManager.isRunning(projectId)` | `processRegistry.get(projectId)?.status` check |
| `getStatus()` — list all | Read | `runtimeManager.all()` | `processRegistry.all()` |
| `getProcess()` — single lookup | Read | `runtimeManager.get(projectId)` | `processRegistry.get(projectId)` |
| `isRunning()` — status check | Read | `runtimeManager.isRunning(projectId)` | `processRegistry.get()` + status check |

### Methods kept on `runtimeManager` (write ops)

| Method | Reason |
|---|---|
| `runtimeManager.start()` | Spawns child process — write operation, no facade equivalent |
| `runtimeManager.stop()` | Sends SIGTERM — write operation, no facade equivalent |
| `runtimeManager.restart()` | Stop + start sequence — write operation, no facade equivalent |

**Behavior preserved:** Identical results. `processRegistry` delegates directly to `runtimeManager` internally — same data, read-only access path.

---

## 6. Safe-FS Fixes (`crud.service.ts`)

**File:** `server/file-explorer/crud/crud.service.ts`

### Import change

| Before | After |
|---|---|
| `import { safeWriteFile, safeDeleteFile } from '../../infrastructure/checkpoints/safe-fs.util.ts'` | Same, plus `safeBackup` |
| `import { backupBeforeWrite } from '../../infrastructure/checkpoints/atomic-write.util.ts'` | **Removed** |

### Usage change

| Method | Before | After |
|---|---|---|
| `rename()` pre-rename backup | `await backupBeforeWrite(absOld)` | `await safeBackup(absOld)` |

**Backup behavior preserved:**  
`safeBackup()` is a direct wrapper over `backupBeforeWrite()`. Both create a `.bak` copy and swallow errors silently. Zero behavior difference.  
No double-backup risk: `safeWriteFile` calls `backupBeforeWrite` internally for writes; `safeBackup` is only called in `rename()` before `fs.renameSync` — a different code path with no overlap.

**`safe-fs.util.ts` change:**  
Added `safeBackup(filePath)` — wraps `backupBeforeWrite`, returns `{ ok, error? }` result (consistent with the file's error-result pattern). `atomic-write.util.ts` remains strictly internal.

---

## 7. Validation Results

| Check | Result | Evidence |
|---|---|---|
| TypeScript errors in changed files | ✅ PASS | Zero new errors in modified files |
| Pre-existing TS error (`crud.service.ts:149` — `safeDeleteFile(abs, force)`) | ⚠️ PRE-EXISTING | Was present in original code before this mission; not introduced here |
| Circular dependencies | ✅ PASS | `index.ts` re-exports only; no new import cycles created |
| Runtime boot | ✅ PASS | 11 stores, 170 tools, API :3001, Vite :5000 — clean startup |
| `atomic-write.util.ts` external imports | ✅ PASS | Zero files outside `safe-fs.util.ts` import it |
| `runtime-types.ts` external imports | ✅ PASS | Only `process-registry.ts` (internal) imports it now |
| `processRegistry` replaces reads | ✅ PASS | All 5 read operations migrated; 3 write operations kept on `runtimeManager` |
| Event behavior unchanged | ✅ PASS | `TOPIC.AGENT='agent'`, `TOPIC.LIFECYCLE='lifecycle'`, `TOPIC.CHECKPOINT='checkpoint'` — same string values at runtime |
| SSE fan-out unchanged | ✅ PASS | Same 3 bus subscriptions, same 3 broadcastToTopic calls, same filter logic |

---

## 8. Remaining Infrastructure Risks

| Risk | Severity | Notes |
|---|---|---|
| Bus channel keys (`agent.event`, `run.lifecycle`) have no constants | 🟡 Low | Would require a `BUS_EVENT` constants file separate from `TOPIC`; out of scope |
| 17+ files across orchestration/browser/preview still use raw bus key strings | 🟡 Low | Out of authorized scope; not modified per mission rules |
| `crud.service.ts:149` — `safeDeleteFile(abs, force)` extra arg | 🟡 Low | Pre-existing bug; `force` is silently ignored at runtime |
| No consumers have migrated to import from `infrastructure/index.ts` | 🟡 Low | Barrel exists; migration is additive and can happen gradually |
| `browser/runtime/browser-session-manager.ts` calls `runtimeManager.getProcesses()` | 🔴 Pre-existing | Method doesn't exist on `RuntimeManager`; was broken before this mission |

---

## 9. Infrastructure Score

| Dimension | Before | After | Change |
|---|---|---|---|
| Circular dependencies | ✅ 10/10 | ✅ 10/10 | — |
| Singleton discipline | ✅ 10/10 | ✅ 10/10 | — |
| Fail-closed bootstrap | ✅ 10/10 | ✅ 10/10 | — |
| Public API surface | ⚠️ 5/10 | ✅ 9/10 | +4 (`index.ts` created) |
| Constants enforcement | ⚠️ 4/10 | ⚠️ 6/10 | +2 (SSE topic strings replaced in `sse-manager.ts`) |
| Facade adherence | ⚠️ 7/10 | ✅ 9/10 | +2 (`runtime.service.ts` reads through facade) |
| Import discipline | ⚠️ 7/10 | ✅ 9/10 | +2 (`atomic-write` bypass removed) |
| **Overall** | **7.8/10** | **9.0/10** | **+1.2** |

---

## 10. Summary

Four violations from `INFRASTRUCTURE_ARCHITECTURE_REPORT.md` are now resolved:

1. ✅ **Public API created** — `server/infrastructure/index.ts` is the single canonical entry point  
2. ✅ **SSE topic constants enforced** — `sse-manager.ts` uses `TOPIC.AGENT/LIFECYCLE/CHECKPOINT`  
3. ✅ **ProcessRegistry facade enforced** — all read ops in `runtime.service.ts` go through `processRegistry`  
4. ✅ **Atomic-write bypass removed** — `crud.service.ts` imports only from `safe-fs.util.ts`

No runtime behavior was changed. No agents, memory, orchestration, or chat modules were modified. No new architecture was introduced.
