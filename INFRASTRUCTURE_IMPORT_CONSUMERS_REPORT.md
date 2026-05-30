# INFRASTRUCTURE_IMPORT_CONSUMERS_REPORT.md

**Date:** 2026-05-30  
**Scan Target:** `server/` — all `.ts` files  
**Scan Method:** `grep -rn "from.*infrastructure/"` — evidence-based, zero assumptions  
**Question:** `server/infrastructure/index.ts` ko kaun kaun import karega?

---

## Summary

| Category | Files | Infrastructure Symbols Used |
|---|---|---|
| Agents | 1 | `bus` |
| Browser Service | 3 | `bus`, `runtimeManager`, `getProjectDir` |
| Chat | 6 | `db`, `bus`, `sseManager`, `TOPIC` |
| Console | 3 | `db`, `bus` |
| File-Explorer | 2 | `emitFileChange`, `safeWriteFile`, `safeDeleteFile`, `safeBackup` |
| Orchestration | 5 | `bus` |
| Preview | 6 | `bus`, `runtimeManager`, `processRegistry` |
| Publishing | 8 | `db`, `bus`, `runtimeManager`, `getProjectDir` |
| Tools | 2 | `bus` |
| **TOTAL** | **36 files** | — |

---

## CATEGORY 1 — AGENTS

### `server/agents/browser/events/browser-bus-bridge.ts`
| Field | Value |
|---|---|
| **Type** | Agent |
| **Current Import** | `import { bus } from '../../../infrastructure/events/bus.ts'` |
| **Normalized Import** | `import { bus } from '../../../infrastructure'` |
| **Symbols Needed** | `bus` |
| **Depth from server/** | `agents/browser/events/` → 3 levels |

---

## CATEGORY 2 — BROWSER SERVICE

> `server/browser/` is NOT the browser agent (`server/agents/browser/`). It is the browser runtime service layer.

### `server/browser/browser-validator.ts`
| Field | Value |
|---|---|
| **Type** | Browser Service |
| **Current Import** | `import { bus } from "../infrastructure/events/bus.ts"` |
| **Normalized Import** | `import { bus } from '../infrastructure'` |
| **Symbols Needed** | `bus` |
| **Depth from server/** | `browser/` → 1 level |

### `server/browser/checks/console-error-collector.ts`
| Field | Value |
|---|---|
| **Type** | Browser Service |
| **Current Import** | `import { getProjectDir } from "../../infrastructure/sandbox/sandbox.util.ts"` |
| **Normalized Import** | `import { getProjectDir } from '../../infrastructure'` |
| **Symbols Needed** | `getProjectDir` |
| **Depth from server/** | `browser/checks/` → 2 levels |

### `server/browser/runtime/browser-session-manager.ts`
| Field | Value |
|---|---|
| **Type** | Browser Runtime Service |
| **Current Imports** | `bus` from `../../infrastructure/events/bus.ts` + `runtimeManager` from `../../infrastructure/runtime/runtime-manager.ts` |
| **Normalized Import** | `import { bus, runtimeManager } from '../../infrastructure'` |
| **Symbols Needed** | `bus`, `runtimeManager` |
| **Depth from server/** | `browser/runtime/` → 2 levels |

---

## CATEGORY 3 — CHAT

### `server/chat/index.ts`
| Field | Value |
|---|---|
| **Type** | Chat Module Root |
| **Current Imports** | `TOPIC` from `../infrastructure/realtime/stream-topics.ts` + `sseManager` from `../infrastructure/events/sse/sse-manager.ts` |
| **Normalized Import** | `import { TOPIC, sseManager } from '../infrastructure'` |
| **Symbols Needed** | `TOPIC`, `sseManager` |
| **Depth from server/** | `chat/` → 1 level |

### `server/chat/persistence/attachment-store.ts`
| Field | Value |
|---|---|
| **Type** | Chat Persistence |
| **Current Import** | `import { db } from '../../infrastructure/db/index.ts'` |
| **Normalized Import** | `import { db } from '../../infrastructure'` |
| **Symbols Needed** | `db` |
| **Depth from server/** | `chat/persistence/` → 2 levels |

### `server/chat/persistence/message-store.ts`
| Field | Value |
|---|---|
| **Type** | Chat Persistence |
| **Current Import** | `import { db } from '../../infrastructure/db/index.ts'` |
| **Normalized Import** | `import { db } from '../../infrastructure'` |
| **Symbols Needed** | `db` |

### `server/chat/persistence/run-store.ts`
| Field | Value |
|---|---|
| **Type** | Chat Persistence |
| **Current Import** | `import { db } from '../../infrastructure/db/index.ts'` |
| **Normalized Import** | `import { db } from '../../infrastructure'` |
| **Symbols Needed** | `db` |

### `server/chat/realtime/event-publisher.ts`
| Field | Value |
|---|---|
| **Type** | Chat Realtime |
| **Current Import** | `import { bus } from '../../infrastructure/events/bus.ts'` |
| **Normalized Import** | `import { bus } from '../../infrastructure'` |
| **Symbols Needed** | `bus` |

### `server/chat/realtime/sse-manager.ts`
| Field | Value |
|---|---|
| **Type** | Chat SSE Wrapper |
| **Current Import** | `import { sseManager as infraSseManager } from '../../infrastructure/events/sse/sse-manager.ts'` |
| **Normalized Import** | `import { sseManager as infraSseManager } from '../../infrastructure'` |
| **Symbols Needed** | `sseManager` |

---

## CATEGORY 4 — CONSOLE

### `server/console/history/history.service.ts`
| Field | Value |
|---|---|
| **Type** | Console Service |
| **Current Import** | `import { db } from '../../infrastructure/db/index.ts'` |
| **Normalized Import** | `import { db } from '../../infrastructure'` |
| **Symbols Needed** | `db` |

### `server/console/persist/persist.service.ts`
| Field | Value |
|---|---|
| **Type** | Console Service |
| **Current Import** | `import { db } from '../../infrastructure/db/index.ts'` |
| **Normalized Import** | `import { db } from '../../infrastructure'` |
| **Symbols Needed** | `db` |

### `server/console/runtime/runtime-states.ts`
| Field | Value |
|---|---|
| **Type** | Console Runtime |
| **Current Import** | `import { bus } from '../../infrastructure/events/bus.ts'` |
| **Normalized Import** | `import { bus } from '../../infrastructure'` |
| **Symbols Needed** | `bus` |

---

## CATEGORY 5 — FILE-EXPLORER

### `server/file-explorer/crud/crud.controller.ts`
| Field | Value |
|---|---|
| **Type** | File-Explorer Controller |
| **Current Import** | `import { emitFileChange } from '../../infrastructure/events/file-change-emitter.ts'` |
| **Normalized Import** | `import { emitFileChange } from '../../infrastructure'` |
| **Symbols Needed** | `emitFileChange` |

### `server/file-explorer/crud/crud.service.ts`
| Field | Value |
|---|---|
| **Type** | File-Explorer Service |
| **Current Import** | `import { safeWriteFile, safeDeleteFile, safeBackup } from '../../infrastructure/checkpoints/safe-fs.util.ts'` |
| **Normalized Import** | `import { safeWriteFile, safeDeleteFile, safeBackup } from '../../infrastructure'` |
| **Symbols Needed** | `safeWriteFile`, `safeDeleteFile`, `safeBackup` |

---

## CATEGORY 6 — ORCHESTRATION

### `server/orchestration/agents/verification-bridge.ts`
| Field | Value |
|---|---|
| **Type** | Orchestration Bridge |
| **Current Import** | `import { bus } from '../../infrastructure/events/bus.ts'` |
| **Normalized Import** | `import { bus } from '../../infrastructure'` |
| **Symbols Needed** | `bus` |

### `server/orchestration/distributed/multi-run-recovery.ts`
| Field | Value |
|---|---|
| **Type** | Orchestration Distributed |
| **Current Import** | `import { bus } from '../../infrastructure/events/bus.ts'` |
| **Normalized Import** | `import { bus } from '../../infrastructure'` |
| **Symbols Needed** | `bus` |

### `server/orchestration/distributed/parallel-orchestration-fabric.ts`
| Field | Value |
|---|---|
| **Type** | Orchestration Distributed |
| **Current Import** | `import { bus } from '../../infrastructure/events/bus.ts'` |
| **Normalized Import** | `import { bus } from '../../infrastructure'` |
| **Symbols Needed** | `bus` |

### `server/orchestration/distributed/run-scoped-orchestrator.ts`
| Field | Value |
|---|---|
| **Type** | Orchestration Distributed |
| **Current Import** | `import { bus } from '../../infrastructure/events/bus.ts'` |
| **Normalized Import** | `import { bus } from '../../infrastructure'` |
| **Symbols Needed** | `bus` |

### `server/orchestration/events/event-publisher.ts`
| Field | Value |
|---|---|
| **Type** | Orchestration Events |
| **Current Import** | `import { bus } from '../../infrastructure/events/bus.ts'` |
| **Normalized Import** | `import { bus } from '../../infrastructure'` |
| **Symbols Needed** | `bus` |

---

## CATEGORY 7 — PREVIEW

### `server/preview/lifecycle/preview-lifecycle-bridge.ts`
| Field | Value |
|---|---|
| **Type** | Preview Lifecycle |
| **Current Import** | `import { bus } from "../../infrastructure/events/bus.ts"` |
| **Normalized Import** | `import { bus } from '../../infrastructure'` |
| **Symbols Needed** | `bus` |

### `server/preview/lifecycle/preview-lifecycle.manager.ts`
| Field | Value |
|---|---|
| **Type** | Preview Lifecycle |
| **Current Import** | `import { bus } from "../../infrastructure/events/bus.ts"` |
| **Normalized Import** | `import { bus } from '../../infrastructure'` |
| **Symbols Needed** | `bus` |

### `server/preview/metrics/metrics.service.ts`
| Field | Value |
|---|---|
| **Type** | Preview Metrics Service |
| **Current Import** | `import { processRegistry } from "../../infrastructure/process/process-registry.ts"` |
| **Normalized Import** | `import { processRegistry } from '../../infrastructure'` |
| **Symbols Needed** | `processRegistry` |

### `server/preview/run-scoped-preview-fabric.ts`
| Field | Value |
|---|---|
| **Type** | Preview Fabric |
| **Current Import** | `import { bus } from "../infrastructure/events/bus.ts"` |
| **Normalized Import** | `import { bus } from '../infrastructure'` |
| **Symbols Needed** | `bus` |
| **Depth from server/** | `preview/` → 1 level |

### `server/preview/runtime/runtime.controller.ts`
| Field | Value |
|---|---|
| **Type** | Preview Runtime Controller |
| **Current Import** | `import { runtimeManager } from '../../infrastructure/runtime/runtime-manager.ts'` |
| **Normalized Import** | `import { runtimeManager } from '../../infrastructure'` |
| **Symbols Needed** | `runtimeManager` |

### `server/preview/runtime/runtime.service.ts`
| Field | Value |
|---|---|
| **Type** | Preview Runtime Service |
| **Current Imports** | `runtimeManager` + `processRegistry` — both from deep paths |
| **Normalized Import** | `import { runtimeManager, processRegistry } from '../../infrastructure'` |
| **Symbols Needed** | `runtimeManager`, `processRegistry` |

---

## CATEGORY 8 — PUBLISHING

### `server/publishing/events/deploy-events.ts`
| Field | Value |
|---|---|
| **Type** | Publishing Events |
| **Current Import** | `import { bus } from "../../infrastructure/events/bus.ts"` |
| **Normalized Import** | `import { bus } from '../../infrastructure'` |
| **Symbols Needed** | `bus` |

### `server/publishing/services/app-settings/settings-store.ts`
| Field | Value |
|---|---|
| **Type** | Publishing Service |
| **Current Import** | `import { db } from "../../../infrastructure/db/index.ts"` |
| **Normalized Import** | `import { db } from '../../../infrastructure'` |
| **Symbols Needed** | `db` |
| **Depth from server/** | `publishing/services/app-settings/` → 3 levels |

### `server/publishing/services/auth/auth-config-store.ts`
| Field | Value |
|---|---|
| **Type** | Publishing Service |
| **Current Import** | `import { db } from "../../../infrastructure/db/index.ts"` |
| **Normalized Import** | `import { db } from '../../../infrastructure'` |
| **Symbols Needed** | `db` |

### `server/publishing/services/deployment/builder.ts`
| Field | Value |
|---|---|
| **Type** | Publishing Deployment |
| **Current Import** | `import { getProjectDir } from "../../../infrastructure/sandbox/sandbox.util.ts"` |
| **Normalized Import** | `import { getProjectDir } from '../../../infrastructure'` |
| **Symbols Needed** | `getProjectDir` |

### `server/publishing/services/deployment/bundler.ts`
| Field | Value |
|---|---|
| **Type** | Publishing Deployment |
| **Current Import** | `import { getProjectDir } from "../../../infrastructure/sandbox/sandbox.util.ts"` |
| **Normalized Import** | `import { getProjectDir } from '../../../infrastructure'` |
| **Symbols Needed** | `getProjectDir` |

### `server/publishing/services/deployment/promoter.ts`
| Field | Value |
|---|---|
| **Type** | Publishing Deployment |
| **Current Import** | `import { runtimeManager } from "../../../infrastructure/runtime/runtime-manager.ts"` |
| **Normalized Import** | `import { runtimeManager } from '../../../infrastructure'` |
| **Symbols Needed** | `runtimeManager` |

### `server/publishing/services/deployment/provisioner.ts`
| Field | Value |
|---|---|
| **Type** | Publishing Deployment |
| **Current Import** | `import { getProjectDir } from "../../../infrastructure/sandbox/sandbox.util.ts"` |
| **Normalized Import** | `import { getProjectDir } from '../../../infrastructure'` |
| **Symbols Needed** | `getProjectDir` |

### `server/publishing/services/domains/domain-manager.ts`
| Field | Value |
|---|---|
| **Type** | Publishing Service |
| **Current Import** | `import { db } from "../../../infrastructure/db/index.ts"` |
| **Normalized Import** | `import { db } from '../../../infrastructure'` |
| **Symbols Needed** | `db` |

---

## CATEGORY 9 — TOOLS

### `server/tools/terminal/process/process-exited.ts`
| Field | Value |
|---|---|
| **Type** | Terminal Tool |
| **Current Import** | `import { bus } from '../../../infrastructure/events/bus.ts'` |
| **Normalized Import** | `import { bus } from '../../../infrastructure'` |
| **Symbols Needed** | `bus` |
| **Depth from server/** | `tools/terminal/process/` → 3 levels |

### `server/tools/terminal/process/process-started.ts`
| Field | Value |
|---|---|
| **Type** | Terminal Tool |
| **Current Import** | `import { bus } from '../../../infrastructure/events/bus.ts'` |
| **Normalized Import** | `import { bus } from '../../../infrastructure'` |
| **Symbols Needed** | `bus` |

---

## Master Symbol Usage Matrix

Who needs which symbol from `server/infrastructure/index.ts`:

| Symbol | Agents | Browser | Chat | Console | File-Explorer | Orchestration | Preview | Publishing | Tools |
|---|---|---|---|---|---|---|---|---|---|
| `bus` | ✅ 1 | ✅ 2 | ✅ 2 | ✅ 1 | — | ✅ 5 | ✅ 4 | ✅ 1 | ✅ 2 |
| `db` | — | — | ✅ 3 | ✅ 2 | — | — | — | ✅ 4 | — |
| `sseManager` | — | — | ✅ 2 | — | — | — | — | — | — |
| `runtimeManager` | — | ✅ 1 | — | — | — | — | ✅ 2 | ✅ 1 | — |
| `processRegistry` | — | — | — | — | — | — | ✅ 2 | — | — |
| `getProjectDir` | — | ✅ 1 | — | — | — | — | — | ✅ 3 | — |
| `emitFileChange` | — | — | — | — | ✅ 1 | — | — | — | — |
| `safeWriteFile` | — | — | — | — | ✅ 1 | — | — | — | — |
| `safeDeleteFile` | — | — | — | — | ✅ 1 | — | — | — | — |
| `safeBackup` | — | — | — | — | ✅ 1 | — | — | — | — |
| `TOPIC` | — | — | ✅ 1 | — | — | — | — | — | — |
| `getNuraDir` | — | — | — | — | — | — | — | — | — |
| `BusEventMap` | — | — | — | — | — | — | — | — | — |
| `FileChangeEvent` | — | — | — | — | — | — | — | — | — |
| `Topic` | — | — | — | — | — | — | — | — | — |

> `getNuraDir`, `BusEventMap`, `FileChangeEvent`, `Topic` — currently no external consumers. Available in the barrel but unused.

---

## Import Depth Reference

| Relative Path to `infrastructure/` | Files at this Depth |
|---|---|
| `'../infrastructure'` (1 level) | `chat/index.ts`, `browser/browser-validator.ts`, `preview/run-scoped-preview-fabric.ts` |
| `'../../infrastructure'` (2 levels) | All `chat/persistence/`, `chat/realtime/`, `console/*`, `file-explorer/crud/`, `orchestration/*`, `preview/lifecycle/`, `preview/metrics/`, `preview/runtime/`, `publishing/events/`, `browser/checks/`, `browser/runtime/` |
| `'../../../infrastructure'` (3 levels) | `agents/browser/events/`, `publishing/services/**/*`, `tools/terminal/process/` |

---

## Files With ZERO Infrastructure Imports (by major folder)

These folders/agents have NO direct infrastructure dependency — they are fully self-contained or depend only on other internal modules:

| Folder | Infrastructure Imports |
|---|---|
| `server/agents/coderx/` | ❌ None |
| `server/agents/executor/` | ❌ None |
| `server/agents/filesystem/` | ❌ None |
| `server/agents/planner/` | ❌ None |
| `server/agents/supervisor/` | ❌ None |
| `server/agents/terminal/` | ❌ None |
| `server/agents/verifier/` | ❌ None |
| `server/memory/` | ❌ None |
| `server/tools/filesystem/` | ❌ None |
| `server/tools/coding/` | ❌ None |
| `server/tools/verifier/` | ❌ None |
| `server/orchestration/core/` | ❌ None |
| `server/engine/` | ❌ None |

---

## Conclusion

**36 files** across **9 categories** currently import from `server/infrastructure/` sub-paths.

All 36 can normalize to import from `server/infrastructure/index.ts` (the new barrel).

**Most used symbol:** `bus` — used by 18 files across 7 categories  
**Most concentrated user:** Orchestration (5 files, all use only `bus`)  
**Widest consumer:** Publishing (8 files, uses `db`, `bus`, `runtimeManager`, `getProjectDir`)
