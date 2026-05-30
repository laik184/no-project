# INFRASTRUCTURE_ARCHITECTURE_REPORT.md

**Audit Date:** 2026-05-30  
**Scope:** `server/infrastructure/` — full recursive scan  
**Method:** Read-only. Every claim backed by file content evidence.

---

## 1. Folder Tree

```
server/infrastructure/
├── checkpoints/
│   ├── atomic-write.util.ts      [Utility]
│   └── safe-fs.util.ts           [Utility]
├── db/
│   └── index.ts                  [Entry Point — DB singleton]
├── events/
│   ├── bus.ts                    [Entry Point — typed EventEmitter]
│   ├── file-change-emitter.ts    [Public API — file change events]
│   └── sse/
│       └── sse-manager.ts        [Entry Point — SSE connection pool]
├── process/
│   └── process-registry.ts       [Public API — read-only process facade]
├── realtime/
│   └── stream-topics.ts          [Public API — SSE topic constants]
├── runtime/
│   ├── runtime-manager.ts        [Entry Point — process lifecycle]
│   └── runtime-types.ts          [Internal Module — type contracts]
└── sandbox/
    └── sandbox.util.ts           [Public API — path resolution]
```

**Total:** 9 folders (including root), 11 files  
**Root `index.ts`:** ❌ ABSENT — consumers import directly from internal paths

---

## 2. File Inventory

### `checkpoints/atomic-write.util.ts`

| Field | Value |
|---|---|
| **Type** | Utility |
| **Purpose** | Atomic file writes with `.bak` backup + `.tmp`→rename POSIX atomicity |
| **Imports** | `fs/promises`, `path` (Node stdlib only) |
| **Exports** | `backupBeforeWrite(filePath)`, `atomicWrite(filePath, content)` |
| **Consumers** | `checkpoints/safe-fs.util.ts` (internal), `file-explorer/crud/crud.service.ts` (direct) |
| **Layer** | Infrastructure-internal + file persistence layer |

---

### `checkpoints/safe-fs.util.ts`

| Field | Value |
|---|---|
| **Type** | Utility |
| **Purpose** | Safe file read/write/delete with error swallowing and backup |
| **Imports** | `fs/promises`, `path`, `./atomic-write.util.ts` |
| **Exports** | `safeWriteFile(filePath, content)`, `safeDeleteFile(filePath)` |
| **Consumers** | `file-explorer/crud/crud.service.ts` |
| **Layer** | Wraps `atomic-write.util.ts` — one level above it |

---

### `db/index.ts`

| Field | Value |
|---|---|
| **Type** | Entry Point / Singleton |
| **Purpose** | Single Drizzle ORM `db` instance for all server-side DB access |
| **Imports** | `drizzle-orm/node-postgres`, `pg`, `shared/schema.ts` |
| **Exports** | `db` (singleton `PostgresJsDatabase`) |
| **Bootstrap** | Fails hard at module load if `DATABASE_URL` is unset — intentional fail-closed |
| **Consumers** | `chat/persistence/attachment-store.ts`, `chat/persistence/message-store.ts`, `chat/persistence/run-store.ts`, `console/history/history.service.ts`, `console/persist/persist.service.ts`, `publishing/services/app-settings/settings-store.ts`, `publishing/services/auth/auth-config-store.ts`, `publishing/services/domains/domain-manager.ts` |
| **Consumer Count** | 8 files |

---

### `events/bus.ts`

| Field | Value |
|---|---|
| **Type** | Entry Point / Singleton |
| **Purpose** | Central typed in-process event bus; backbone of inter-module communication |
| **Imports** | `events` (Node stdlib only) |
| **Exports** | `bus` (singleton `TypedEventBus`), `BusEventMap` interface |
| **Event Channels** | `agent.event`, `run.lifecycle`, `checkpoint`, `process.crashed` + open `[key: string]` |
| **Max Listeners** | 100 (explicitly set) |
| **Consumers** | 18 files — see Import Graph section |

---

### `events/file-change-emitter.ts`

| Field | Value |
|---|---|
| **Type** | Public API / Adapter |
| **Purpose** | Translates filesystem change events into `bus.emit('agent.event', ...)` calls |
| **Imports** | `./bus.ts` |
| **Exports** | `emitFileChange(event)`, `FileChangeEvent` interface |
| **Consumers** | `file-explorer/crud/crud.controller.ts` |
| **Consumer Count** | 1 file |

---

### `events/sse/sse-manager.ts`

| Field | Value |
|---|---|
| **Type** | Entry Point / Singleton |
| **Purpose** | SSE connection pool — manages all active browser SSE streams; fans out bus events to matching connections |
| **Imports** | `express.Response` (type), `../bus.ts` |
| **Exports** | `sseManager` singleton with: `register()`, `publish()`, `connectionCount`, `stats()` |
| **Internal Bus Subscriptions** | Subscribes to `agent.event`, `run.lifecycle`, `checkpoint` on `bus` at module load time |
| **Consumers** | `chat/index.ts`, `chat/realtime/sse-manager.ts` |
| **Consumer Count** | 2 files |
| **Note** | The chat module wraps this with a domain-specific `sse-manager.ts` — consumers should go through chat's wrapper, not this directly |

---

### `process/process-registry.ts`

| Field | Value |
|---|---|
| **Type** | Public API / Facade |
| **Purpose** | Read-only view of running project processes — for metrics and observability only |
| **Imports** | `../runtime/runtime-manager.ts`, `../runtime/runtime-types.ts` |
| **Exports** | `processRegistry` singleton with: `get(projectId)`, `getLogs(projectId, count)`, `all()` |
| **Pattern** | Thin delegation facade over `runtimeManager` — restricts access to read-only methods |
| **Consumers** | `preview/metrics/metrics.service.ts` |
| **Consumer Count** | 1 file |

---

### `realtime/stream-topics.ts`

| Field | Value |
|---|---|
| **Type** | Public API / Constants |
| **Purpose** | Canonical SSE topic name strings; all publishers and subscribers must use these |
| **Imports** | None |
| **Exports** | `TOPIC` (`{ AGENT, LIFECYCLE, CHECKPOINT }`), `Topic` type |
| **Consumers** | `chat/index.ts` |
| **Consumer Count** | 1 file |
| **Note** | Severely under-used — only 1 importer, but the comment says "ALL modules MUST use these constants". Many bus/SSE users use raw strings instead. |

---

### `runtime/runtime-manager.ts`

| Field | Value |
|---|---|
| **Type** | Entry Point / Singleton |
| **Purpose** | Spawns, stops, restarts, and tracks project processes; single source of truth for all running processes |
| **Imports** | `child_process` (Node stdlib), `../events/bus.ts`, `./runtime-types.ts` |
| **Exports** | `runtimeManager` singleton with: `start()`, `stop()`, `restart()`, `get()`, `all()`, `isRunning()`, `init()` |
| **Bus Usage** | Emits `process.crashed` event on child process exit |
| **Consumers** | `process/process-registry.ts` (internal facade), `browser/runtime/browser-session-manager.ts`, `preview/runtime/runtime.controller.ts`, `preview/runtime/runtime.service.ts`, `publishing/services/deployment/promoter.ts` |
| **Consumer Count** | 5 files |

---

### `runtime/runtime-types.ts`

| Field | Value |
|---|---|
| **Type** | Internal Module / Type Contracts |
| **Purpose** | Shared TypeScript types for the runtime subsystem |
| **Imports** | None (pure type definitions) |
| **Exports** | `RuntimeStatus`, `RuntimeEntry`, `RuntimeStartOptions`, `RuntimeStartResult`, `RuntimeStopResult` |
| **Consumers** | `process/process-registry.ts` (internal), `preview/runtime/runtime.service.ts` (direct) |
| **Note** | `preview/runtime/runtime.service.ts` imports `RuntimeEntry` directly instead of going through `processRegistry` — see Anti-Patterns |

---

### `sandbox/sandbox.util.ts`

| Field | Value |
|---|---|
| **Type** | Public API / Utility |
| **Purpose** | Resolves canonical filesystem paths for project sandboxes; reads `AGENT_PROJECT_ROOT` env var |
| **Imports** | `path` (Node stdlib only) |
| **Exports** | `getProjectDir(projectId)`, `getNuraDir(projectId)` |
| **Consumers** | `browser/checks/console-error-collector.ts`, `publishing/services/deployment/builder.ts`, `publishing/services/deployment/bundler.ts`, `publishing/services/deployment/provisioner.ts` |
| **Consumer Count** | 4 files |

---

## 3. Import Graph

### `bus.ts` — 18 direct importers

```
server/infrastructure/events/bus.ts
├── server/agents/browser/events/browser-bus-bridge.ts        [agent layer]
├── server/browser/browser-validator.ts                        [browser service]
├── server/browser/runtime/browser-session-manager.ts          [browser service]
├── server/chat/realtime/event-publisher.ts                    [chat layer]
├── server/console/runtime/runtime-states.ts                   [console service]
├── server/infrastructure/runtime/runtime-manager.ts           [infra-internal]
├── server/infrastructure/events/sse/sse-manager.ts            [infra-internal]
├── server/infrastructure/events/file-change-emitter.ts        [infra-internal]
├── server/orchestration/agents/verification-bridge.ts         [orchestration]
├── server/orchestration/distributed/multi-run-recovery.ts     [orchestration]
├── server/orchestration/distributed/parallel-orchestration-fabric.ts [orchestration]
├── server/orchestration/distributed/run-scoped-orchestrator.ts [orchestration]
├── server/orchestration/events/event-publisher.ts             [orchestration]
├── server/preview/lifecycle/preview-lifecycle-bridge.ts       [preview]
├── server/preview/lifecycle/preview-lifecycle.manager.ts      [preview]
├── server/preview/run-scoped-preview-fabric.ts                [preview]
├── server/publishing/events/deploy-events.ts                  [publishing]
├── server/tools/terminal/process/process-exited.ts            [tools]
└── server/tools/terminal/process/process-started.ts           [tools]
```

### `db/index.ts` — 8 direct importers

```
server/infrastructure/db/index.ts
├── server/chat/persistence/attachment-store.ts                [chat]
├── server/chat/persistence/message-store.ts                   [chat]
├── server/chat/persistence/run-store.ts                       [chat]
├── server/console/history/history.service.ts                  [console]
├── server/console/persist/persist.service.ts                  [console]
├── server/publishing/services/app-settings/settings-store.ts  [publishing]
├── server/publishing/services/auth/auth-config-store.ts       [publishing]
└── server/publishing/services/domains/domain-manager.ts       [publishing]
```

### `runtime/runtime-manager.ts` — 5 direct importers

```
server/infrastructure/runtime/runtime-manager.ts
├── server/infrastructure/process/process-registry.ts          [infra-internal]
├── server/browser/runtime/browser-session-manager.ts          [browser service]
├── server/preview/runtime/runtime.controller.ts               [preview]
├── server/preview/runtime/runtime.service.ts                  [preview]
└── server/publishing/services/deployment/promoter.ts          [publishing]
```

### `events/sse/sse-manager.ts` — 2 direct importers

```
server/infrastructure/events/sse/sse-manager.ts
├── server/chat/index.ts                                        [chat root]
└── server/chat/realtime/sse-manager.ts                        [chat wrapper]
```

### `sandbox/sandbox.util.ts` — 4 direct importers

```
server/infrastructure/sandbox/sandbox.util.ts
├── server/browser/checks/console-error-collector.ts           [browser service]
├── server/publishing/services/deployment/builder.ts           [publishing]
├── server/publishing/services/deployment/bundler.ts           [publishing]
└── server/publishing/services/deployment/provisioner.ts       [publishing]
```

### `checkpoints/atomic-write.util.ts` — 2 importers

```
server/infrastructure/checkpoints/atomic-write.util.ts
├── server/infrastructure/checkpoints/safe-fs.util.ts          [infra-internal]
└── server/file-explorer/crud/crud.service.ts                  [file-explorer]
```

### `checkpoints/safe-fs.util.ts` — 1 importer

```
server/infrastructure/checkpoints/safe-fs.util.ts
└── server/file-explorer/crud/crud.service.ts                  [file-explorer]
```

### `events/file-change-emitter.ts` — 1 importer

```
server/infrastructure/events/file-change-emitter.ts
└── server/file-explorer/crud/crud.controller.ts               [file-explorer]
```

### `process/process-registry.ts` — 1 importer

```
server/infrastructure/process/process-registry.ts
└── server/preview/metrics/metrics.service.ts                  [preview]
```

### `realtime/stream-topics.ts` — 1 importer

```
server/infrastructure/realtime/stream-topics.ts
└── server/chat/index.ts                                        [chat root]
```

### `runtime/runtime-types.ts` — 2 importers

```
server/infrastructure/runtime/runtime-types.ts
├── server/infrastructure/process/process-registry.ts          [infra-internal]
└── server/preview/runtime/runtime.service.ts                  [direct — see Anti-Patterns]
```

---

## 4. Entry Point Discovery

### Official Infrastructure Entry Points

| File | Why It Is an Entry Point | Should Be Imported By | Currently Imported By |
|---|---|---|---|
| `db/index.ts` | Single DB connection; doc says "All server-side modules import `{ db }` from this file" | Services, persistence layers | Chat, Console, Publishing (8 files) ✅ |
| `events/bus.ts` | Central event backbone; the only sanctioned inter-module pub/sub channel | Any module needing cross-module events | Agents, Orchestration, Chat, Preview, Publishing, Tools, Console (18 files) ✅ |
| `events/sse/sse-manager.ts` | Sole owner of all active SSE connections; only correct source for SSE fanout | Chat layer only (others go via bus) | Chat (2 files) ✅ |
| `runtime/runtime-manager.ts` | Single source of truth for running project processes | Preview, Browser runtime, Publishing | Preview, Browser, Publishing (5 files) ✅ |
| `sandbox/sandbox.util.ts` | Canonical path resolver for sandboxes; reads env var | Any module needing project paths | Browser, Publishing (4 files) ✅ |
| `events/file-change-emitter.ts` | Single adapter for emitting file change events onto the bus | File-explorer CRUD layer | File-explorer (1 file) ✅ |
| `realtime/stream-topics.ts` | Canonical SSE topic constants | All SSE publishers and subscribers | Only Chat (1 file) ⚠️ under-used |

---

## 5. Safe Import Matrix

| Infrastructure File | Agent | Service | Orchestrator | Tool | Memory | Notes |
|---|---|---|---|---|---|---|
| `db/index.ts` | ❌ NO | ✅ YES | ❌ NO | ❌ NO | ❌ NO | DB access only for persistence services; agents must never query DB directly |
| `events/bus.ts` | ✅ YES | ✅ YES | ✅ YES | ✅ YES | ⚠️ AVOID | Bus is broadly permitted; memory platform should prefer its own internal events |
| `events/file-change-emitter.ts` | ❌ NO | ✅ YES (file services) | ❌ NO | ❌ NO | ❌ NO | Only the file-explorer CRUD layer should emit file changes |
| `events/sse/sse-manager.ts` | ❌ NO | ❌ NO (use bus) | ❌ NO | ❌ NO | ❌ NO | Only the chat layer should touch this directly; all others go via `bus` |
| `process/process-registry.ts` | ❌ NO | ✅ YES (metrics only) | ❌ NO | ❌ NO | ❌ NO | Read-only observability — only metrics/monitoring services |
| `realtime/stream-topics.ts` | ✅ YES | ✅ YES | ✅ YES | ✅ YES | ✅ YES | Constants only, zero runtime side-effects — safe everywhere |
| `runtime/runtime-manager.ts` | ❌ NO | ✅ YES (runtime services) | ❌ NO | ❌ NO | ❌ NO | Direct process management — only preview runtime, browser runtime, publishing |
| `runtime/runtime-types.ts` | ❌ NO | ✅ YES (if needed) | ❌ NO | ❌ NO | ❌ NO | Types-only, but prefer going through `process-registry` to get the data |
| `sandbox/sandbox.util.ts` | ✅ YES | ✅ YES | ✅ YES | ✅ YES | ❌ NO | Path resolution is universally safe; memory platform doesn't need sandbox paths |
| `checkpoints/atomic-write.util.ts` | ❌ NO | ✅ YES (file services) | ❌ NO | ❌ NO | ❌ NO | Low-level file I/O — only persistence/checkpoint consumers |
| `checkpoints/safe-fs.util.ts` | ❌ NO | ✅ YES (file services) | ❌ NO | ❌ NO | ❌ NO | Same as above; prefer this over `atomic-write.util.ts` directly |

---

## 6. Anti-Pattern Detection

### ✅ CLEAN: No Circular Dependencies
Evidence: `grep -rn "from.*agents/|from.*orchestration/|from.*tools/|from.*chat/" server/infrastructure/` returned **zero results**.  
Infrastructure never imports agents, orchestrators, tools, or chat. The dependency arrow is strictly one-directional.

```
consumers → infrastructure → Node.js built-ins
```

### ⚠️ VIOLATION 1: `preview/runtime/runtime.service.ts` bypasses `process-registry`
```
server/preview/runtime/runtime.service.ts
  imports: runtimeManager   (direct write access — should use processRegistry for reads)
  imports: RuntimeEntry      (type — acceptable, but signals tight coupling)
```
`processRegistry` exists specifically to expose a read-only view of `runtimeManager`. `runtime.service.ts` bypasses the facade and imports `runtimeManager` directly, gaining write access it likely doesn't need.

### ⚠️ VIOLATION 2: `realtime/stream-topics.ts` severely under-used
The file states: *"All modules that publish or subscribe to SSE streams MUST use these constants."*  
Evidence: Only **1 importer** (`chat/index.ts`). The remaining 17 importers of `bus.ts` and all orchestration event publishers use raw string literals for topics instead.

### ⚠️ VIOLATION 3: `file-explorer/crud/crud.service.ts` imports `atomic-write.util.ts` directly
```
server/file-explorer/crud/crud.service.ts
  imports: safeWriteFile, safeDeleteFile   ← from safe-fs.util.ts  ✅
  imports: backupBeforeWrite               ← from atomic-write.util.ts  ⚠️
```
`safe-fs.util.ts` wraps `atomic-write.util.ts`. The `crud.service.ts` should only need `safe-fs.util.ts`; importing the lower-level `atomic-write.util.ts` directly suggests `backupBeforeWrite` is being called manually before another write, which is a duplicated-backup risk.

### ⚠️ OBSERVATION: No root `server/infrastructure/index.ts`
There is no barrel/index file at the infrastructure root. Every consumer imports from a specific internal path like `../../infrastructure/events/bus.ts`. This means:
- No enforced public API surface
- Consumers can (and do) reach into internal sub-modules
- Refactoring any internal path breaks all consumers

### ✅ CLEAN: No duplicate registries
There is one `runtimeManager`, one `processRegistry` (a facade), one `bus`, one `db`, one `sseManager`. No duplication found.

### ✅ CLEAN: No duplicate bootstrap logic
`db/index.ts` bootstraps once at import time (fails hard on missing `DATABASE_URL`). No competing bootstrap patterns.

---

## 7. Public API Analysis

### Recommended Official Infrastructure APIs

| Recommended Import Path | What It Exposes | Stability |
|---|---|---|
| `server/infrastructure/db/index.ts` | `db` — Drizzle ORM singleton | Stable ✅ |
| `server/infrastructure/events/bus.ts` | `bus`, `BusEventMap` | Stable ✅ |
| `server/infrastructure/events/file-change-emitter.ts` | `emitFileChange`, `FileChangeEvent` | Stable ✅ |
| `server/infrastructure/events/sse/sse-manager.ts` | `sseManager` | Chat-layer only ✅ |
| `server/infrastructure/process/process-registry.ts` | `processRegistry` (read-only) | Stable ✅ |
| `server/infrastructure/realtime/stream-topics.ts` | `TOPIC`, `Topic` | Stable ✅ |
| `server/infrastructure/runtime/runtime-manager.ts` | `runtimeManager` | Runtime services only ✅ |
| `server/infrastructure/sandbox/sandbox.util.ts` | `getProjectDir`, `getNuraDir` | Stable ✅ |
| `server/infrastructure/checkpoints/safe-fs.util.ts` | `safeWriteFile`, `safeDeleteFile` | File services only ✅ |

### Internal — Should Not Be Imported Directly

| File | Reason |
|---|---|
| `runtime/runtime-types.ts` | Types only; prefer `process-registry.ts` as the access point |
| `checkpoints/atomic-write.util.ts` | Wrapped by `safe-fs.util.ts`; use that instead |

---

## 8. Root Entry Points (Definitive Answers)

### If an **Agent** needs infrastructure:
```
# For events/telemetry:
import { bus } from 'server/infrastructure/events/bus.ts';

# For sandbox path resolution:
import { getProjectDir } from 'server/infrastructure/sandbox/sandbox.util.ts';

# For SSE topic constants:
import { TOPIC } from 'server/infrastructure/realtime/stream-topics.ts';

# Agents must NOT import: db, sseManager, runtimeManager, processRegistry
```

### If an **Orchestrator** needs infrastructure:
```
# For events:
import { bus } from 'server/infrastructure/events/bus.ts';

# For SSE topic constants:
import { TOPIC } from 'server/infrastructure/realtime/stream-topics.ts';

# Orchestrators must NOT import: db, sseManager, runtimeManager, checkpoints
```

### If a **Service** needs infrastructure:
```
# For database access (persistence services only):
import { db } from 'server/infrastructure/db/index.ts';

# For events:
import { bus } from 'server/infrastructure/events/bus.ts';

# For process observability (metrics services only):
import { processRegistry } from 'server/infrastructure/process/process-registry.ts';

# For process management (runtime services only):
import { runtimeManager } from 'server/infrastructure/runtime/runtime-manager.ts';

# For safe file writes (file services only):
import { safeWriteFile, safeDeleteFile } from 'server/infrastructure/checkpoints/safe-fs.util.ts';

# For sandbox paths:
import { getProjectDir } from 'server/infrastructure/sandbox/sandbox.util.ts';

# For SSE (chat layer only):
import { sseManager } from 'server/infrastructure/events/sse/sse-manager.ts';
```

### If a **Tool** needs infrastructure:
```
# For events (process started/stopped):
import { bus } from 'server/infrastructure/events/bus.ts';

# For sandbox paths:
import { getProjectDir } from 'server/infrastructure/sandbox/sandbox.util.ts';

# Tools must NOT import: db, sseManager, runtimeManager, processRegistry, checkpoints
```

### If **Memory** needs infrastructure:
```
# Memory platform should be self-contained.
# Only acceptable import if needed:
import { TOPIC } from 'server/infrastructure/realtime/stream-topics.ts';

# Memory must NOT import: db (has own stores), bus (has own internal events),
#   runtimeManager, sseManager, checkpoints
```

---

## 9. Runtime Flow

```
main.ts
  │
  ├─► bootstrapMemory()       ← server/memory/bootstrap.ts (not infrastructure)
  │
  ├─► loadAllTools()          ← server/tools/registry/tool-loader.ts (not infrastructure)
  │
  ├─► initOrchestration()     ← server/orchestration/index.ts (not infrastructure)
  │
  └─► Express + HTTP server
        │
        ├─► db/index.ts        [bootstraps at first import — pg Pool created]
        │     └─► throws hard if DATABASE_URL missing
        │
        ├─► events/bus.ts      [bootstraps at first import — EventEmitter created]
        │     └─► max listeners = 100
        │
        ├─► events/sse/sse-manager.ts  [bootstraps at first import]
        │     └─► subscribes to bus: agent.event, run.lifecycle, checkpoint
        │
        ├─► runtime/runtime-manager.ts  [bootstraps at first import]
        │     └─► empty process Map, awaits start() calls
        │
        └─► sandbox/sandbox.util.ts    [bootstraps at first import]
              └─► reads AGENT_PROJECT_ROOT env var once

Infrastructure Bootstrap Order (via import chain):
  1. db/index.ts              (DB connection pool — fail-hard on missing URL)
  2. events/bus.ts            (EventEmitter — no side effects)
  3. runtime/runtime-types.ts (types — no side effects)
  4. runtime/runtime-manager.ts  (depends on bus)
  5. events/file-change-emitter.ts  (depends on bus)
  6. events/sse/sse-manager.ts  (depends on bus, subscribes immediately)
  7. process/process-registry.ts  (depends on runtime-manager + runtime-types)
  8. realtime/stream-topics.ts  (no deps — pure constants)
  9. sandbox/sandbox.util.ts  (reads env — no other deps)
 10. checkpoints/atomic-write.util.ts  (no deps)
 11. checkpoints/safe-fs.util.ts  (depends on atomic-write)
```

---

## 10. Architecture Score

| Dimension | Score | Evidence |
|---|---|---|
| Separation of concerns | ✅ 9/10 | Infrastructure never imports consumers; clean layer boundaries |
| Circular dependencies | ✅ 10/10 | Zero circular dependencies detected |
| Singleton discipline | ✅ 10/10 | One `db`, one `bus`, one `runtimeManager`, one `sseManager` |
| Fail-closed bootstrap | ✅ 10/10 | `db/index.ts` throws on missing `DATABASE_URL` — correct |
| Public API surface | ⚠️ 5/10 | No root `index.ts`; consumers import arbitrary internal paths |
| Constants enforcement | ⚠️ 4/10 | `stream-topics.ts` is defined as mandatory but only 1 of 18 bus users import it |
| Facade adherence | ⚠️ 7/10 | `processRegistry` exists as a facade over `runtimeManager` but is bypassed by `preview/runtime/runtime.service.ts` |
| Import discipline | ⚠️ 7/10 | `crud.service.ts` imports both `safe-fs.util.ts` and `atomic-write.util.ts` — redundant |
| **Overall** | **7.8/10** | Solid foundation with three minor discipline violations |

---

## 11. Recommended Import Strategy

### Rule 1 — Always import the highest-level file available
```
✅ safe-fs.util.ts        (not atomic-write.util.ts directly)
✅ processRegistry        (not runtimeManager for read-only use)
✅ bus                    (not sseManager for non-SSE event needs)
```

### Rule 2 — `bus.ts` is the universal event channel
All inter-module events should flow through `bus`. Use `sseManager.publish()` only from the chat layer. Everyone else emits on `bus` and lets `sseManager` fan out automatically.

### Rule 3 — `stream-topics.ts` must be used universally
Any string passed to `bus.emit()` or `sseManager.publish()` that represents a topic channel MUST use `TOPIC.AGENT`, `TOPIC.LIFECYCLE`, or `TOPIC.CHECKPOINT` — never raw strings.

### Rule 4 — A root `index.ts` barrel should be created
To prevent internal path leakage, a `server/infrastructure/index.ts` should re-export the public API surface. Consumers then import from `../../infrastructure` instead of `../../infrastructure/events/bus.ts`.

---

## 12. Infrastructure Ownership Model

| Subsystem | Owner File | Owned Singletons | Who May Write/Mutate |
|---|---|---|---|
| Database | `db/index.ts` | `db` pool | Persistence services only |
| Event Bus | `events/bus.ts` | `bus` | Any module (publish) |
| SSE Streams | `events/sse/sse-manager.ts` | `connections` Map | Chat layer only |
| File Events | `events/file-change-emitter.ts` | — | File-explorer CRUD only |
| Process Lifecycle | `runtime/runtime-manager.ts` | `processes` Map | Runtime services, Publishing |
| Process Observability | `process/process-registry.ts` | — (facade) | Read-only — any metrics service |
| Sandbox Paths | `sandbox/sandbox.util.ts` | — (pure functions) | Any module needing paths |
| Atomic Writes | `checkpoints/atomic-write.util.ts` | — (pure functions) | File persistence only |
| Safe FS | `checkpoints/safe-fs.util.ts` | — (pure functions) | File persistence only |
| Stream Constants | `realtime/stream-topics.ts` | — (constants) | Immutable — universal read |

---

## 13. Which Files Should Be Imported By Whom

### Agents
| File | Allowed | Justification |
|---|---|---|
| `events/bus.ts` | ✅ YES | Telemetry, lifecycle events (e.g. `browser-bus-bridge.ts`) |
| `sandbox/sandbox.util.ts` | ✅ YES | Path resolution for sandbox operations |
| `realtime/stream-topics.ts` | ✅ YES | Constants — no side effects |
| `db/index.ts` | ❌ NO | Agents never access DB directly |
| `events/sse/sse-manager.ts` | ❌ NO | Chat layer concern |
| `runtime/runtime-manager.ts` | ❌ NO | Runtime management is not agent responsibility |
| `process/process-registry.ts` | ❌ NO | Observability/metrics concern |
| `checkpoints/*` | ❌ NO | File persistence is a service concern |

### Services
| File | Allowed | Justification |
|---|---|---|
| `db/index.ts` | ✅ YES | Persistence services need DB access |
| `events/bus.ts` | ✅ YES | All services may publish/subscribe |
| `runtime/runtime-manager.ts` | ✅ YES (runtime services) | Only preview, browser, publishing need this |
| `process/process-registry.ts` | ✅ YES (metrics) | Metrics/observability services only |
| `sandbox/sandbox.util.ts` | ✅ YES | Deployment and build services need sandbox paths |
| `checkpoints/safe-fs.util.ts` | ✅ YES (file services) | Preferred over atomic-write directly |
| `events/sse/sse-manager.ts` | ✅ YES (chat only) | Only the chat SSE wrapper |
| `realtime/stream-topics.ts` | ✅ YES | Constants — safe for all |
| `events/file-change-emitter.ts` | ✅ YES (file-explorer) | Only CRUD services |
| `checkpoints/atomic-write.util.ts` | ⚠️ AVOID | Use `safe-fs.util.ts` instead |
| `runtime/runtime-types.ts` | ⚠️ AVOID | Use `process-registry.ts` as access point |

### Orchestrators
| File | Allowed | Justification |
|---|---|---|
| `events/bus.ts` | ✅ YES | Orchestration events, verification bridges |
| `realtime/stream-topics.ts` | ✅ YES | Constants only |
| `db/index.ts` | ❌ NO | No direct DB access in orchestrators |
| All others | ❌ NO | Not orchestrator concerns |

### Tools
| File | Allowed | Justification |
|---|---|---|
| `events/bus.ts` | ✅ YES | Process started/exited events |
| `sandbox/sandbox.util.ts` | ✅ YES | Sandbox path resolution |
| `realtime/stream-topics.ts` | ✅ YES | Constants |
| All others | ❌ NO | Tools should be thin — no DB, no runtime management |

### Memory Platform
| File | Allowed | Justification |
|---|---|---|
| `realtime/stream-topics.ts` | ✅ YES (if needed) | Constants — no side effects |
| All others | ❌ NO | Memory platform is self-contained with its own persistence |

---

## 14. Files That Must Remain Internal

| File | Why Internal |
|---|---|
| `runtime/runtime-types.ts` | Implementation-detail types for the runtime subsystem; external consumers should use `processRegistry` or accept `RuntimeEntry` as opaque |
| `checkpoints/atomic-write.util.ts` | Implementation detail of `safe-fs.util.ts`; direct use bypasses the safety wrapper and risks double-backup |

---

## Summary Answer

> **"What is the correct infrastructure entry file that Agents, Services, Orchestrators, and Tools should import?"**

| Consumer | Correct Entry File | Purpose |
|---|---|---|
| **All consumers (events)** | `server/infrastructure/events/bus.ts` | Cross-module pub/sub |
| **All consumers (paths)** | `server/infrastructure/sandbox/sandbox.util.ts` | Sandbox path resolution |
| **All consumers (topics)** | `server/infrastructure/realtime/stream-topics.ts` | SSE topic constants |
| **Services (DB)** | `server/infrastructure/db/index.ts` | Database access |
| **Runtime services only** | `server/infrastructure/runtime/runtime-manager.ts` | Process management |
| **Metrics services only** | `server/infrastructure/process/process-registry.ts` | Process observability |
| **Chat layer only (SSE)** | `server/infrastructure/events/sse/sse-manager.ts` | SSE connection pool |
| **File services only** | `server/infrastructure/checkpoints/safe-fs.util.ts` | Safe file writes |
| **File-explorer only** | `server/infrastructure/events/file-change-emitter.ts` | File change events |
