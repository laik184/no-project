# Deep Scan Report — `server/infrastructure/index.ts`
**Generated:** 2026-06-03  
**Scanner:** Backend Intelligence Scan  
**Target:** `server/infrastructure/index.ts`

---

## What Does `infrastructure/index.ts` Export?

```
db                  — Database client (Drizzle ORM)
bus                 — Internal Event Bus
BusEventMap         — Type: event map for bus
emitFileChange      — File change event emitter
FileChangeEvent     — Type: file change event shape
sseManager          — SSE connection pool manager
processRegistry     — Process observability facade (read-only)
TOPIC               — Stream topic constants
Topic               — Type: topic enum
runtimeManager      — Runtime process manager
getProjectDir       — Sandbox path utility
getNuraDir          — Sandbox path utility
safeWriteFile       — Safe filesystem write
safeDeleteFile      — Safe filesystem delete
safeBackup          — Safe filesystem backup
captureGitSha       — Git SHA capture
seedDefaultProject  — DB seed utility
```

---

## GROUP 1 — Root Entry Point (1 file)

| File Path | Imports Used |
|-----------|-------------|
| `main.ts` | `seedDefaultProject`, `TOPIC`, `sseManager` |

---

## GROUP 2 — `server/chat/` (10 files) ✅ All via index.ts

| File Path | Import Style | Imports Used |
|-----------|-------------|--------------|
| `server/chat/index.ts` | `'../infrastructure'` | `TOPIC`, `sseManager` |
| `server/chat/orchestration/chat-orchestrator.ts` | `'../../infrastructure/index.ts'` | `bus` |
| `server/chat/realtime/sse-manager.ts` | `'../../infrastructure'` | `sseManager` |
| `server/chat/realtime/event-publisher.ts` | `'../../infrastructure'` | `bus` |
| `server/chat/persistence/run-writer.ts` | `'../../infrastructure'` | `db` |
| `server/chat/persistence/run-store.ts` | `'../../infrastructure'` | `db` |
| `server/chat/persistence/message-store.ts` | `'../../infrastructure'` | `db` |
| `server/chat/persistence/attachment-store.ts` | `'../../infrastructure'` | `db` |
| `server/chat/persistence/checkpoint-store.ts` | `'../../infrastructure/index.ts'` | `db`, `safeWriteFile`, `safeDeleteFile`, `getProjectDir`, `captureGitSha` |
| `server/chat/controllers/checkpoint-controller.ts` | `'../../infrastructure/index.ts'` | `bus` |

---

## GROUP 3 — `server/orchestration/` (5 files) ⚠️ DIRECT SUB-PATH BYPASS

> These files import directly from `infrastructure/events/bus.ts` instead of
> going through `index.ts`. This violates the architecture contract stated in
> `index.ts`: *"All consumers should import from this file — not from internal sub-paths."*

| File Path | Actual Import Path Used | Imports Used |
|-----------|------------------------|--------------|
| `server/orchestration/events/event-publisher.ts` | `'../../infrastructure/events/bus.ts'` | `bus` |
| `server/orchestration/distributed/run-scoped-orchestrator.ts` | `'../../infrastructure/events/bus.ts'` | `bus` |
| `server/orchestration/distributed/parallel-orchestration-fabric.ts` | `'../../infrastructure/events/bus.ts'` | `bus` |
| `server/orchestration/distributed/multi-run-recovery.ts` | `'../../infrastructure/events/bus.ts'` | `bus` |
| `server/orchestration/agents/verification-bridge.ts` | `'../../infrastructure/events/bus.ts'` | `bus` |

**Fix Required:** Change all 5 imports to `'../../infrastructure/index.ts'`

---

## GROUP 4 — `server/file-explorer/` (2 files) ✅ Via index.ts

| File Path | Import Style | Imports Used |
|-----------|-------------|--------------|
| `server/file-explorer/realtime/file-subscriber.ts` | `'../../infrastructure/index.ts'` | `bus` |
| `server/file-explorer/realtime/file-publisher.ts` | `'../../infrastructure/index.ts'` | `sseManager`, `TOPIC` |

---

## GROUP 5 — `server/tools/` (2 files) ⚠️ DIRECT SUB-PATH BYPASS

| File Path | Actual Import Path Used | Imports Used |
|-----------|------------------------|--------------|
| `server/tools/terminal/process/process-started.ts` | `'../../../infrastructure/events/bus.ts'` | `bus` |
| `server/tools/terminal/process/process-exited.ts` | `'../../../infrastructure/events/bus.ts'` | `bus` |

**Fix Required:** Change both imports to `'../../../infrastructure/index.ts'`

---

## GROUP 6 — `server/agents/` (1 file) ⚠️ DIRECT SUB-PATH BYPASS

| File Path | Actual Import Path Used | Imports Used |
|-----------|------------------------|--------------|
| `server/agents/browser/events/browser-bus-bridge.ts` | `'../../../infrastructure/events/bus.ts'` | `bus` |

**Fix Required:** Change import to `'../../../infrastructure/index.ts'`

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total files importing infrastructure | **20 files** |
| Via `index.ts` (correct / compliant) | **12 files** |
| Via direct sub-path (bypass / violation) | **8 files** |
| Unique exports consumed across all files | **9 exports** |

### Exports Usage Frequency

| Export | Used By (count) |
|--------|----------------|
| `bus` | 12 files |
| `db` | 6 files |
| `sseManager` | 3 files |
| `TOPIC` | 3 files |
| `safeWriteFile` | 1 file |
| `safeDeleteFile` | 1 file |
| `getProjectDir` | 1 file |
| `captureGitSha` | 1 file |
| `seedDefaultProject` | 1 file |

---

## Architecture Violations — 8 Files to Fix

All 8 violations are for the same export (`bus`) imported via direct sub-path:

```
VIOLATION LIST:
──────────────────────────────────────────────────────────────────
1. server/orchestration/events/event-publisher.ts
2. server/orchestration/distributed/run-scoped-orchestrator.ts
3. server/orchestration/distributed/parallel-orchestration-fabric.ts
4. server/orchestration/distributed/multi-run-recovery.ts
5. server/orchestration/agents/verification-bridge.ts
6. server/tools/terminal/process/process-started.ts
7. server/tools/terminal/process/process-exited.ts
8. server/agents/browser/events/browser-bus-bridge.ts

CURRENT (wrong):
  import { bus } from '../../infrastructure/events/bus.ts';
  import { bus } from '../../../infrastructure/events/bus.ts';

CORRECT (fix to):
  import { bus } from '../../infrastructure/index.ts';
  import { bus } from '../../../infrastructure/index.ts';
──────────────────────────────────────────────────────────────────
```

---

## Exports NOT Yet Consumed

These are exported from `index.ts` but **no file currently imports them**:

| Unused Export | Source File |
|---------------|-------------|
| `BusEventMap` (type) | `infrastructure/events/bus.ts` |
| `emitFileChange` | `infrastructure/events/file-change-emitter.ts` |
| `FileChangeEvent` (type) | `infrastructure/events/file-change-emitter.ts` |
| `processRegistry` | `infrastructure/process/process-registry.ts` |
| `runtimeManager` | `infrastructure/runtime/runtime-manager.ts` |
| `getNuraDir` | `infrastructure/sandbox/sandbox.util.ts` |
| `safeBackup` | `infrastructure/checkpoints/safe-fs.util.ts` |

> These may be reserved for future agent/tool modules or are consumed
> indirectly via runtime (not static import).
