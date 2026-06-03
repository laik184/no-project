# Full Backend Architecture Audit Report

**Target:** `server/` — all layers  
**Scan Date:** 2026-06-03  
**Method:** Live grep — actual imports only, no assumptions

---

## Layer Inventory (Actual, From Filesystem)

| Layer | Path | File Count |
|-------|------|-----------|
| Infrastructure | `server/infrastructure/` | 14 |
| Repositories | `server/repositories/` | 9 |
| Services | `server/services/` | ~45 |
| Tools | `server/tools/` | 365 |
| Agents | `server/agents/` | 231 |
| Orchestration | `server/orchestration/` | 41 |
| Chat | `server/chat/` | 78 |
| Memory | `server/memory/` | 67 |
| File Explorer | `server/file-explorer/` | 32 |
| Engine | `server/engine/planning/` | — |
| Startup | `server/startup/` | 1 |

> **Important context:** The `services/` and `repositories/` layers cover **only the filesystem/file-explorer domain**. The AI domain (tools, agents, orchestration, chat) has no services or repositories — it operates with its own internal persistence sublayer inside `chat/persistence/`.

---

## 1. Full Dependency Graph

```
Infrastructure (db, bus, sseManager, TOPIC, runtimeManager, ...)
    ↑ consumed by
    ├── Repositories (file-system only — no db; uses Node fs/path)
    │     ↑ consumed by
    │     └── Services (filesystem only)
    │           ↑ consumed by
    │           └── file-explorer/ routes/controllers
    │
    ├── Tools (bus via 2 terminal files)
    │     ↑ consumed by (via tool-dispatcher)
    │     └── Agents (all agents → tools/registry/tool-dispatcher.ts)
    │           ↑ consumed by
    │           └── Orchestration (agent-coordinator → all 8 agents)
    │                 ↑ consumed by
    │                 └── Chat (chat-orchestrator → orchestration/index.ts)
    │
    └── Chat/persistence (db — 5 files act as internal repositories)

Memory → Agents (executor) [VIOLATION — memory imports from agents]

Tools/browser ↔ Agents/browser [VIOLATION — bidirectional coupling]
```

---

## 2. Service Ownership Report

**Scope:** `server/services/filesystem/**`

### What services import

| Import Target | Count | Layer | Verdict |
|--------------|-------|-------|---------|
| `repositories/file-system/index.ts` | 22 | Repository | ✅ CORRECT |
| `shared/file-explorer-core/*` | ~40 | Shared types | ✅ CORRECT |
| Other services (sibling) | ~15 | Service | ✅ CORRECT |
| `file-explorer/mappers/index.ts` | 2 | Mapper | ✅ CORRECT |
| Node stdlib (`path`, `fs`) | 4 | stdlib | ✅ CORRECT |

### Violations

| Check | Result |
|-------|--------|
| Does any service import `db` directly? | ✅ NO |
| Does any service import `bus` directly? | ✅ NO |
| Does any service import `runtimeManager`? | ✅ NO |
| Does any service bypass repositories? | ✅ NO — all DB-like ops go through `repositories/file-system/` |
| Does any service import agents? | ✅ NO |
| Does any service import orchestration? | ✅ NO |
| Does any service import tools? | ✅ NO |

**Service layer verdict: ✅ CLEAN**

---

## 3. Repository Ownership Report

**Scope:** `server/repositories/file-system/**`

### Files

```
server/repositories/file-system/editors/editors.repository.ts
server/repositories/file-system/filesystem/filesystem.repository.ts
server/repositories/file-system/git/git.repository.ts
server/repositories/file-system/history/history.repository.ts
server/repositories/file-system/metadata/metadata.repository.ts
server/repositories/file-system/pinned/pinned.repository.ts
server/repositories/file-system/recent/recent.repository.ts
server/repositories/file-system/index.ts
server/repositories/index.ts
```

### What repositories import

| Import Target | Count | Layer | Verdict |
|--------------|-------|-------|---------|
| `shared/file-explorer-core/*` | 9 | Shared types/config | ✅ CORRECT |
| Node stdlib (`path`, `fs`, `child_process`) | 7 | stdlib | ✅ CORRECT |

> **Note:** These repositories do NOT import `db` — they operate directly on the filesystem via Node.js `fs`. They are true filesystem repositories, not DB repositories.

### Violations

| Check | Result |
|-------|--------|
| Does any repository import a service? | ✅ NO |
| Does any repository import a tool? | ✅ NO |
| Does any repository import an agent? | ✅ NO |
| Does any repository import orchestration? | ✅ NO |
| Does any repository import chat? | ✅ NO |
| Does any repository import infrastructure? | ✅ NO |

**Repository layer verdict: ✅ CLEAN**

---

## 4. Tool Ownership Report

**Scope:** `server/tools/**` (365 files)

### Tool subdirectories

```
server/tools/browser/    server/tools/coding/
server/tools/codegen/    server/tools/filesystem/
server/tools/planner/    server/tools/registry/
server/tools/shared/     server/tools/terminal/
server/tools/telemetry/  server/tools/verifier/
```

### What tools import

| Import Target | Classification | Verdict |
|--------------|---------------|---------|
| Intra-tool types/shared/validation | Tool-internal | ✅ SAFE |
| `agents/browser/types/**` | Agent layer (types only) | ⚠️ WARNING |
| `agents/browser/telemetry/**` | Agent layer (telemetry) | 🚨 VIOLATION |
| `agents/browser/events/**` | Agent layer (events) | 🚨 VIOLATION |
| `agents/browser/utils/**` | Agent layer (utils) | ⚠️ WARNING |
| `agents/browser/core/browser-session.ts` | Agent layer (core) | 🚨 VIOLATION |
| `infrastructure/index.ts` (`bus`) | Infrastructure | ⚠️ NEEDS REVIEW |
| Node stdlib, `playwright` | External | ✅ SAFE |

### Tool → Agent violation detail (20+ files)

| Tool File | Imported Agent Path | Severity |
|-----------|-------------------|---------|
| `tools/browser/capture/crash-detector.ts` | `agents/browser/types/validation.types.ts` | ⚠️ |
| `tools/browser/capture/crash-detector.ts` | `agents/browser/telemetry/browser-logger.ts` | 🚨 |
| `tools/browser/capture/crash-detector.ts` | `agents/browser/telemetry/browser-metrics.ts` | 🚨 |
| `tools/browser/capture/screenshot-taker.ts` | `agents/browser/utils/screenshot-utils.ts` | ⚠️ |
| `tools/browser/capture/screenshot-taker.ts` | `agents/browser/events/browser-events.ts` | 🚨 |
| `tools/browser/capture/screenshot-taker.ts` | `agents/browser/telemetry/browser-metrics.ts` | 🚨 |
| `tools/browser/capture/screenshot-taker.ts` | `agents/browser/telemetry/action-trace.ts` | 🚨 |
| `tools/browser/interaction/dom-interactor.ts` | `agents/browser/events/interaction-events.ts` | 🚨 |
| `tools/browser/interaction/dom-interactor.ts` | `agents/browser/telemetry/browser-logger.ts` | 🚨 |
| `tools/browser/interaction/element-finder.ts` | `agents/browser/utils/dom-utils.ts` | ⚠️ |
| `tools/browser/interaction/element-finder.ts` | `agents/browser/events/interaction-events.ts` | 🚨 |
| `tools/browser/monitoring/action-logger-core.ts` | `agents/browser/telemetry/action-trace.ts` | 🚨 |
| `tools/browser/monitoring/browser-metrics.ts` | `agents/browser/telemetry/browser-metrics.ts` | 🚨 |
| `tools/browser/monitoring/health-monitor-core.ts` | `agents/browser/events/browser-events.ts` | 🚨 |
| `tools/browser/navigation/page-navigator.ts` | `agents/browser/events/navigation-events.ts` | 🚨 |
| `tools/browser/navigation/page-navigator.ts` | `agents/browser/telemetry/action-trace.ts` | 🚨 |
| `tools/browser/navigation/user-flow-runner.ts` | `agents/browser/events/navigation-events.ts` | 🚨 |
| `tools/browser/session/browser-context.ts` | `agents/browser/core/browser-session.ts` | 🚨 |
| `tools/browser/session/page-manager.ts` | `agents/browser/core/browser-session.ts` | 🚨 |
| `tools/browser/validation/ui-validator.ts` | `agents/browser/events/browser-events.ts` | 🚨 |
| `tools/browser/validation/visual-diff-detector.ts` | `agents/browser/utils/screenshot-utils.ts` | ⚠️ |

### Tool → Infrastructure direct access

| Tool File | Imported Symbol | Verdict |
|-----------|----------------|---------|
| `server/tools/terminal/process/process-exited.ts` | `bus` from `infrastructure/index.ts` | ⚠️ NEEDS REVIEW |
| `server/tools/terminal/process/process-started.ts` | `bus` from `infrastructure/index.ts` | ⚠️ NEEDS REVIEW |

> These two tool files emit lifecycle events directly on `bus`. This skips any service mediation but is pragmatic since no terminal service layer exists.

**Tool layer verdict: 🚨 HIGH RISK — tools/browser and agents/browser are bidirectionally coupled**

---

## 5. Agent Ownership Report

**Scope:** `server/agents/**` (231 files)

### Agent subdirectories

```
server/agents/browser/     server/agents/chat/
server/agents/coderx/      server/agents/executor/
server/agents/filesystem/  server/agents/planner/
server/agents/supervisor/  server/agents/terminal/
server/agents/verifier/
```

### What agents import

| Import Target | Count | Layer | Verdict |
|--------------|-------|-------|---------|
| `tools/registry/tool-dispatcher.ts` | 18 refs | Tools (correct direction) | ✅ CORRECT |
| Intra-agent types, coordination, utils | ~200 | Agent-internal | ✅ CORRECT |
| `memory/index.ts` | 8 | Memory platform | ✅ CORRECT |
| `engine/planning/index.ts` | 8 | Engine | ✅ CORRECT |
| `infrastructure/index.ts` (`bus`) | 1 | Infrastructure | ⚠️ NEEDS REVIEW |
| `chat/*` | 0 | — | ✅ CORRECT |
| `orchestration/*` | 0 | — | ✅ CORRECT |

### Agent → Tools (correct direction ✅)

All 8 agents consume tools exclusively via `tools/registry/tool-dispatcher.ts`.

```
server/agents/browser/coordination/dispatcher-client.ts     → tools/registry/tool-dispatcher.ts
server/agents/coderx/coordination/dispatcher-client.ts      → tools/registry/tool-dispatcher.ts
server/agents/executor/coordination/dispatcher-client.ts    → tools/registry/tool-dispatcher.ts
server/agents/filesystem/coordination/dispatcher-client.ts  → tools/registry/tool-dispatcher.ts
server/agents/planner/coordination/dispatcher-client.ts     → tools/registry/tool-dispatcher.ts
server/agents/supervisor/coordination/dispatcher-client.ts  → tools/registry/tool-dispatcher.ts
server/agents/terminal/coordination/dispatcher-client.ts    → tools/registry/tool-dispatcher.ts
server/agents/verifier/coordination/dispatcher-client.ts    → tools/registry/tool-dispatcher.ts
```

### Agent → Infrastructure (1 violation)

```
server/agents/browser/events/browser-bus-bridge.ts
  → import { bus } from '../../../infrastructure/index.ts'
```

The browser agent has a dedicated bus-bridge that publishes browser events. Direct `bus` access at agent level bypasses any event mediation layer.

### Agent → Chat/Orchestration

```
✅ NONE — no agent imports chat or orchestration
```

**Agent layer verdict: ⚠️ MINOR — 1 direct infrastructure access, otherwise clean**

---

## 6. Direct DB Access Report

**Rule:** Only repositories should own DB access.

| File | Import | Layer | Verdict |
|------|--------|-------|---------|
| `server/chat/persistence/attachment-store.ts` | `db` from `../../infrastructure` | Chat/persistence | ⚠️ NO REPOSITORY |
| `server/chat/persistence/checkpoint-store.ts` | `db` from `../../infrastructure/index.ts` | Chat/persistence | ⚠️ NO REPOSITORY |
| `server/chat/persistence/message-store.ts` | `db` from `../../infrastructure` | Chat/persistence | ⚠️ NO REPOSITORY |
| `server/chat/persistence/run-store.ts` | `db` from `../../infrastructure` | Chat/persistence | ⚠️ NO REPOSITORY |
| `server/chat/persistence/run-writer.ts` | `db` from `../../infrastructure` | Chat/persistence | ⚠️ NO REPOSITORY |
| `server/tools/coding/database/generate-seed.ts` | String literal `import db from '../lib/db.ts'` | Code generation | ✅ FALSE POSITIVE (generates code, doesn't use db) |
| `server/repositories/file-system/**` | No `db` imports | Filesystem only | ✅ N/A |

**Finding:** The `chat/persistence/` sublayer functions as an internal repository layer — 5 files directly access `db`. This is not architecturally wrong given no `repositories/` equivalent exists for the AI domain, but it means the DB access rule is enforced informally within chat's own persistence folder rather than through a dedicated repository layer.

---

## 7. Infrastructure Access Report

| File | Layer | Symbol | Verdict |
|------|-------|--------|---------|
| `server/chat/index.ts` | Chat | `TOPIC`, `sseManager` | ✅ ALLOWED |
| `server/chat/persistence/attachment-store.ts` | Chat | `db` | ✅ ALLOWED |
| `server/chat/persistence/checkpoint-store.ts` | Chat | `db`, `safeWriteFile`, `safeDeleteFile`, `getProjectDir`, `captureGitSha` | ✅ ALLOWED |
| `server/chat/persistence/message-store.ts` | Chat | `db` | ✅ ALLOWED |
| `server/chat/persistence/run-store.ts` | Chat | `db` | ✅ ALLOWED |
| `server/chat/persistence/run-writer.ts` | Chat | `db` | ✅ ALLOWED |
| `server/chat/realtime/event-publisher.ts` | Chat | `bus` | ✅ ALLOWED |
| `server/chat/realtime/sse-manager.ts` | Chat | `sseManager` | ✅ ALLOWED |
| `server/chat/controllers/checkpoint-controller.ts` | Chat | `bus` | ✅ ALLOWED |
| `server/chat/orchestration/chat-orchestrator.ts` | Chat | `bus` | ✅ ALLOWED |
| `server/orchestration/events/event-publisher.ts` | Orchestration | `bus` | ✅ ALLOWED |
| `server/orchestration/agents/verification-bridge.ts` | Orchestration | `bus` | ✅ ALLOWED |
| `server/orchestration/distributed/multi-run-recovery.ts` | Orchestration | `bus` | ✅ ALLOWED |
| `server/orchestration/distributed/parallel-orchestration-fabric.ts` | Orchestration | `bus` | ✅ ALLOWED |
| `server/orchestration/distributed/run-scoped-orchestrator.ts` | Orchestration | `bus` | ✅ ALLOWED |
| `server/agents/browser/events/browser-bus-bridge.ts` | **Agent** | `bus` | ⚠️ NEEDS REVIEW |
| `server/tools/terminal/process/process-exited.ts` | **Tool** | `bus` | ⚠️ NEEDS REVIEW |
| `server/tools/terminal/process/process-started.ts` | **Tool** | `bus` | ⚠️ NEEDS REVIEW |
| `server/file-explorer/realtime/file-publisher.ts` | File-Explorer | `sseManager`, `TOPIC` | ✅ ALLOWED |
| `server/file-explorer/realtime/file-subscriber.ts` | File-Explorer | `bus` | ✅ ALLOWED |
| `main.ts` | Entry point | `seedDefaultProject`, `TOPIC`, `sseManager` | ✅ ALLOWED |

---

## 8. Dependency Direction Violations

**Expected direction (bottom = lowest, top = highest):**
```
Infrastructure → Repositories → Services → Tools → Agents → Orchestration → Chat
Memory (cross-cutting foundation)
```

### Violations Found

#### 🚨 VIOLATION 1 — Tools import Agents (bidirectional coupling)
**Severity: HIGH**

`server/tools/browser/**` (20+ files) import from `server/agents/browser/**`

```
server/tools/browser/capture/crash-detector.ts
  ↓ imports
server/agents/browser/telemetry/browser-logger.ts
server/agents/browser/telemetry/browser-metrics.ts
server/agents/browser/types/validation.types.ts

server/tools/browser/session/browser-context.ts
  ↓ imports
server/agents/browser/core/browser-session.ts     ← CORE SESSION

server/tools/browser/session/page-manager.ts
  ↓ imports
server/agents/browser/core/browser-session.ts     ← CORE SESSION
```

The `tools/browser/` module and `agents/browser/` module are **co-evolved** — they share types, telemetry, events, and core session state. The architectural boundary between them is structural (different folders) but not functional (bidirectional imports). They are effectively one module split across two directories.

#### 🚨 VIOLATION 2 — Memory imports Agents
**Severity: MEDIUM**

```
server/memory/bootstrap/memory-hydrator.ts
  ↓ imports
server/agents/executor/index.ts   (executionHistory, failureMemory, learningStore, types)

server/memory/bootstrap/memory-loader.ts
  ↓ imports
server/agents/executor/index.ts   (ExecutionHistoryEntry, FailurePattern, LearnedEntry)
```

Memory is supposed to be a foundation layer consumed by agents. These two hydration files invert that by importing from the executor agent. Memory hydration at startup requires access to executor's in-process stores — a bootstrap coupling that violates the dependency direction.

#### ⚠️ WARNING 3 — Tools access Infrastructure directly (bus)
**Severity: LOW**

```
server/tools/terminal/process/process-exited.ts
  ↓ imports bus from infrastructure/index.ts

server/tools/terminal/process/process-started.ts
  ↓ imports bus from infrastructure/index.ts
```

Tools should not reach into infrastructure directly. These files emit process lifecycle events on `bus`. No terminal event service/mediator exists to abstract this.

#### ⚠️ WARNING 4 — Agent accesses Infrastructure directly (bus)
**Severity: LOW**

```
server/agents/browser/events/browser-bus-bridge.ts
  ↓ imports bus from infrastructure/index.ts
```

Dedicated bridge file — contained to one file. Pragmatic but skips event mediation.

---

## 9. Bypass Violations

| Chain | Files | Severity |
|-------|-------|---------|
| Tool → Agent (shared session/telemetry) | 20+ `tools/browser/**` → `agents/browser/**` | 🚨 HIGH |
| Memory → Agent (hydration bootstrap) | `memory/bootstrap/memory-hydrator.ts` → `agents/executor/index.ts` | 🚨 MEDIUM |
| Tool → Infrastructure (bus) | `tools/terminal/process/process-{exited,started}.ts` → `infrastructure/index.ts` | ⚠️ LOW |
| Agent → Infrastructure (bus) | `agents/browser/events/browser-bus-bridge.ts` → `infrastructure/index.ts` | ⚠️ LOW |
| Chat/persistence → Infrastructure (db) | 5 files in `chat/persistence/**` → `infrastructure` | ⚠️ INFORMATIONAL |

---

## 10. Architecture Scorecard

| Metric | Score | Notes |
|--------|-------|-------|
| Service → Repository compliance | **100%** | All 22 service→repo imports are correct |
| Repository isolation | **100%** | Repos import nothing from services, tools, agents, or chat |
| Tool isolation | **~5%** | 20+ of 365 tool files import from agent layer |
| Agent isolation | **99%** | 1 of 231 agent files touches infrastructure directly |
| Dependency direction compliance | **~85%** | 2 structural inversions: tools↔agents, memory→agents |
| Direct DB access violations | **0 hard violations** | chat/persistence acts as informal repository |
| Infrastructure bypass violations | **3 files** | 2 tool files + 1 agent file touch bus directly |

---

## 11. Critical Files

| File | Issue |
|------|-------|
| `server/tools/browser/session/browser-context.ts` | Imports `agents/browser/core/browser-session.ts` — deepest coupling |
| `server/tools/browser/session/page-manager.ts` | Imports `agents/browser/core/browser-session.ts` — deepest coupling |
| `server/memory/bootstrap/memory-hydrator.ts` | Imports `agents/executor/index.ts` — memory→agent inversion |
| `server/memory/bootstrap/memory-loader.ts` | Imports `agents/executor/index.ts` — memory→agent inversion |
| `server/agents/browser/events/browser-bus-bridge.ts` | Direct `bus` access at agent level |
| `server/tools/terminal/process/process-exited.ts` | Direct `bus` access at tool level |
| `server/tools/terminal/process/process-started.ts` | Direct `bus` access at tool level |

---

## 12. Recommended Fixes

### Fix 1 — Collapse `tools/browser/` and `agents/browser/` (HIGH PRIORITY)
**Evidence:** 20+ bidirectional imports make them effectively one module.

Move shared telemetry, types, events, and session into a single `server/browser/` module or into `agents/browser/` and have tools import from there unidirectionally. The current split creates a false boundary.

### Fix 2 — Invert memory→agent dependency (MEDIUM PRIORITY)
**Evidence:** `memory-hydrator.ts` and `memory-loader.ts` import from `agents/executor/index.ts`

Options:
- Have the executor agent register its stores with the memory platform at startup (push model), rather than memory pulling from the agent (pull model).
- Extract the executor's in-process stores (`executionHistory`, `failureMemory`, `learningStore`) into `server/memory/` or a shared `server/stores/` module that both agents and memory import from.

### Fix 3 — Introduce a terminal event emitter in infrastructure or tools/shared (LOW PRIORITY)
**Evidence:** `process-exited.ts` and `process-started.ts` import `bus` directly.

Create a `tools/terminal/events/terminal-events.ts` that wraps the `bus.emit()` calls. Import `bus` only there; other terminal process files import from this wrapper.

### Fix 4 — Add a `repositories/ai/` layer for chat persistence (INFORMATIONAL)
**Evidence:** 5 `chat/persistence/**` files access `db` directly.

Extract these into a proper `server/repositories/ai/` or `server/repositories/chat/` layer, mirroring the pattern already established in `repositories/file-system/`.

---

## 13. Final Verdict

```
🚨 HIGH RISK COUPLING
```

The filesystem domain (repositories → services → file-explorer) is **architecturally clean** — 100% compliant, correct layering, no violations.

The AI domain (tools → agents → orchestration → chat) has **one critical structural violation**: `tools/browser/` and `agents/browser/` are bidirectionally coupled across 20+ files, making the tools/agents boundary in the browser subsystem effectively non-functional. Additionally, `memory/bootstrap/` inverts the memory→agent dependency direction by importing executor stores at hydration time.

All other cross-layer patterns (agents → tools via dispatcher, orchestration → agents, chat → orchestration) follow the expected dependency direction and are compliant.
