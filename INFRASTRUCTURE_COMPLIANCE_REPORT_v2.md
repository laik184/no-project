# Infrastructure Compliance Report v2
**Generated:** 2026-06-03  
**Scan Target:** `server/infrastructure/index.ts`  
**Scope:** Poora server/ directory — sabhi .ts files  
**Status:** Post-fix scan (8 violations fix ho chuke hain pichle session mein)

---

## server/infrastructure/index.ts — Public Exports (Reference)

```
db                  ← server/infrastructure/db/index.ts
bus                 ← server/infrastructure/events/bus.ts
BusEventMap         ← (type) server/infrastructure/events/bus.ts
emitFileChange      ← server/infrastructure/events/file-change-emitter.ts
FileChangeEvent     ← (type) server/infrastructure/events/file-change-emitter.ts
sseManager          ← server/infrastructure/events/sse/sse-manager.ts
processRegistry     ← server/infrastructure/process/process-registry.ts
TOPIC               ← server/infrastructure/realtime/stream-topics.ts
Topic               ← (type) server/infrastructure/realtime/stream-topics.ts
runtimeManager      ← server/infrastructure/runtime/runtime-manager.ts
getProjectDir       ← server/infrastructure/sandbox/sandbox.util.ts
getNuraDir          ← server/infrastructure/sandbox/sandbox.util.ts
safeWriteFile       ← server/infrastructure/checkpoints/safe-fs.util.ts
safeDeleteFile      ← server/infrastructure/checkpoints/safe-fs.util.ts
safeBackup          ← server/infrastructure/checkpoints/safe-fs.util.ts
captureGitSha       ← server/infrastructure/checkpoints/git-runner.ts
seedDefaultProject  ← server/infrastructure/seed.ts
```

---

## BHAG 1 — Sahi Tarike Se Import Kar Rahi Hain ✅
**( via `server/infrastructure/index.ts` )**
**Total: 21 files**

| # | File Path | Import Style | Imported Exports |
|---|-----------|--------------|-----------------|
| 1 | `main.ts` | `'./server/infrastructure/index.ts'` | `seedDefaultProject`, `TOPIC`, `sseManager` |
| 2 | `server/chat/index.ts` | `'../infrastructure'` | `TOPIC`, `sseManager` |
| 3 | `server/chat/orchestration/chat-orchestrator.ts` | `'../../infrastructure/index.ts'` | `bus` |
| 4 | `server/chat/realtime/sse-manager.ts` | `'../../infrastructure'` | `sseManager` |
| 5 | `server/chat/realtime/event-publisher.ts` | `'../../infrastructure'` | `bus` |
| 6 | `server/chat/persistence/run-writer.ts` | `'../../infrastructure'` | `db` |
| 7 | `server/chat/persistence/run-store.ts` | `'../../infrastructure'` | `db` |
| 8 | `server/chat/persistence/message-store.ts` | `'../../infrastructure'` | `db` |
| 9 | `server/chat/persistence/attachment-store.ts` | `'../../infrastructure'` | `db` |
| 10 | `server/chat/persistence/checkpoint-store.ts` | `'../../infrastructure/index.ts'` | `db`, `safeWriteFile`, `safeDeleteFile`, `getProjectDir`, `captureGitSha` |
| 11 | `server/chat/controllers/checkpoint-controller.ts` | `'../../infrastructure/index.ts'` | `bus` |
| 12 | `server/orchestration/events/event-publisher.ts` | `'../../infrastructure/index.ts'` | `bus` |
| 13 | `server/orchestration/distributed/run-scoped-orchestrator.ts` | `'../../infrastructure/index.ts'` | `bus` |
| 14 | `server/orchestration/distributed/parallel-orchestration-fabric.ts` | `'../../infrastructure/index.ts'` | `bus` |
| 15 | `server/orchestration/distributed/multi-run-recovery.ts` | `'../../infrastructure/index.ts'` | `bus` |
| 16 | `server/orchestration/agents/verification-bridge.ts` | `'../../infrastructure/index.ts'` | `bus` |
| 17 | `server/file-explorer/realtime/file-subscriber.ts` | `'../../infrastructure/index.ts'` | `bus` |
| 18 | `server/file-explorer/realtime/file-publisher.ts` | `'../../infrastructure/index.ts'` | `sseManager`, `TOPIC` |
| 19 | `server/agents/browser/events/browser-bus-bridge.ts` | `'../../../infrastructure/index.ts'` | `bus` |
| 20 | `server/tools/terminal/process/process-started.ts` | `'../../../infrastructure/index.ts'` | `bus` |
| 21 | `server/tools/terminal/process/process-exited.ts` | `'../../../infrastructure/index.ts'` | `bus` |

---

## BHAG 2 — Galat Sub-Path Se Import Kar Rahi Hain ⚠️
**( direct internal file imports — fix zaroori )**
**Total: 0 files — ZERO VIOLATIONS**

```
✅ Koi bhi file seedha infrastructure ke andar ki file
   (jaise events/bus.ts, runtime/runtime-manager.ts) ko
   import nahi kar rahi.

Pichle session mein 8 violations fix ho chuke hain:
  ✓ server/orchestration/events/event-publisher.ts
  ✓ server/orchestration/distributed/run-scoped-orchestrator.ts
  ✓ server/orchestration/distributed/parallel-orchestration-fabric.ts
  ✓ server/orchestration/distributed/multi-run-recovery.ts
  ✓ server/orchestration/agents/verification-bridge.ts
  ✓ server/tools/terminal/process/process-started.ts
  ✓ server/tools/terminal/process/process-exited.ts
  ✓ server/agents/browser/events/browser-bus-bridge.ts
```

---

## BHAG 3 — Import Karna Chahiye Lekin Nahi Kar Rahi 🔴
**( infrastructure features use kar rahi hain bina proper import ke )**

### 3.1 — CRITICAL BUG ❌

| File | Kya Kar Rahi Hai | Problem | Sahi Import |
|------|-----------------|---------|-------------|
| `server/replit_integrations/chat/storage.ts` | `import { db } from "../../db"` | `server/db` exist hi nahi karta — yeh path BROKEN hai | `import { db } from '../../infrastructure'` |

**Explanation:**  
- `server/replit_integrations/chat/storage.ts` ka path: `server/replit_integrations/chat/`  
- `../../db` resolve hota hai: `server/db` ← **YE DIRECTORY/FILE EXIST NAHI KARTI**  
- Actual `db` export hota hai: `server/infrastructure/db/index.ts`  
- Sahi relative path: `'../../infrastructure'` (kyunki `server/infrastructure/index.ts` `db` export karta hai)  
- **Risk:** Runtime mein module-not-found error aa sakta hai jab yeh storage file load ho.

---

### 3.2 — Indirect Use (Infrastructure Directly Nahi, Layer Ke Through) ℹ️

Ye files infrastructure exports USE zaroor karti hain, lekin seedhe nahi — ek intermediate layer ke zariye:

| File | Indirect Usage | Kaisi? | Action Needed? |
|------|---------------|--------|----------------|
| `server/file-explorer/watchers/file-watcher.service.ts` | `TOPIC`, `sseManager` | `publishCreated/Modified/Deleted` ke through (`../realtime/index.ts`) | ❌ Nahi — delegation sahi hai |

---

### 3.3 — Code Generation Tools (False Positives) ✅

| File | Kyun Grep Mein Aaya | Actual Status |
|------|---------------------|---------------|
| `server/tools/coding/database/generate-seed.ts` | Template string ke andar `db.insert(...)` text hai | Ye actual `db` import nahi karta — sirf code generate karta hai | ✅ Sahi hai |

---

## Summary Table

| Bhag | Count | Status |
|------|-------|--------|
| ✅ Sahi tarike se import kar rahi hain | **21 files** | Compliant |
| ⚠️ Direct sub-path violation | **0 files** | All Fixed |
| 🔴 Import karna chahiye lekin broken path | **1 file** | Fix Required |
| ℹ️ Indirect use (layer ke through) | **1 file** | No Action |
| 🟡 False positive (code generation) | **1 file** | No Action |

---

## Exports Jo Abhi Koi Bhi File Import Nahi Kar Rahi

Ye exports `index.ts` mein available hain lekin koi consumer nahi hai:

| Unused Export | Source | Sambhavit Use |
|---------------|--------|---------------|
| `BusEventMap` (type) | `events/bus.ts` | Type-safe bus event handling |
| `emitFileChange` | `events/file-change-emitter.ts` | File change fan-out |
| `FileChangeEvent` (type) | `events/file-change-emitter.ts` | File event typing |
| `processRegistry` | `process/process-registry.ts` | Process observability |
| `runtimeManager` | `runtime/runtime-manager.ts` | Runtime process control |
| `getNuraDir` | `sandbox/sandbox.util.ts` | Nura-specific sandbox path |
| `safeBackup` | `checkpoints/safe-fs.util.ts` | Safe file backup |

---

## Ek Line Action Plan

```
TURANT FIX KARO:
  server/replit_integrations/chat/storage.ts
    Line 1: import { db } from "../../db"
          ↓ change to ↓
    Line 1: import { db } from '../../infrastructure'

BAAKI SAHI HAIN — KOI AUR ACTION NAHI CHAHIYE.
```
