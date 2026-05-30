# DEAD MEMORY REPORT (Phase 8 — Dead Memory Detection)
Generated: 2026-05-30

---

## Methodology

For each in-process memory module identified during discovery, cross-referenced every import path
against all TypeScript files in server/ using ripgrep. A module is classified DEAD/ORPHANED only
when zero other files import it (excluding the module's own file).

---

## Confirmed Orphans

### server/agents/executor/memory/context-window-manager.ts

| Property | Value |
|---|---|
| Purpose | LLM context token budget governance — per-run ContextMessage[] per runId |
| Importers found | **ZERO** |
| Build references | None |
| Test references | None |
| Export usage | All exports (`contextWindowManager.*`) unreachable |
| Deletion risk | None — no callers |
| **Action** | **DELETED** (Phase 9 applied simultaneously) |

**Why it became orphaned**: Context window management was likely superseded during the executor refactor that split the monolithic core into coder/, filesystem/, runtime/, and validator/ subdirectories. The LLM message management was moved to chat/orchestration or absorbed directly into the agent's main loop. The file was retained but never rewired after the split.

---

## Confirmed NOT Orphaned (had suspected risk)

### server/agents/coderx/memory/execution-history.ts
- Importers: `coderx/execution/task-executor.ts`, `coderx/execution/step-runner.ts`, `coderx/execution/retry-manager.ts`
- Status: ACTIVE — per-run runtime state, correctly protected

### server/agents/coderx/memory/working-memory.ts
- Importers: `coderx/execution/coding-loop.ts`, `coderx/execution/task-executor.ts`
- Status: ACTIVE — per-run runtime state, correctly protected

### server/orchestration/core/orchestration-replay.ts
- Importers: Multiple orchestration files
- Status: ACTIVE — per-run checkpoint store, correctly protected

### server/orchestration/execution/execution-result-registry.ts
- Importers: `orchestration/core/orchestrator.ts` and observability layer
- Status: ACTIVE — per-run stats, correctly protected

### server/chat/realtime/connection-registry.ts
- Importers: `chat/orchestration/chat-orchestrator.ts`, `chat/realtime/sse-adapter.ts`
- Status: ACTIVE — live connection tracking

### server/tools/terminal/state/process-history.ts
- Importers: `tools/terminal/executor.ts`, `tools/terminal/process-manager.ts`
- Status: ACTIVE — per-run terminal history

---

## Scan Statistics

| Scope | Files scanned | Modules evaluated | Orphans found |
|---|---|---|---|
| server/agents/executor/memory/ | 4 | 4 | 1 |
| server/agents/coderx/memory/ | 2 | 2 | 0 |
| server/orchestration/ | 8 | 3 | 0 |
| server/chat/ | 12 | 3 | 0 |
| server/tools/ | ~50 | 3 | 0 |
| server/publishing/services/ | ~15 | 3 | 0 |
| **Total** | **~91** | **18** | **1** |

---

## Phase 9 Action: context-window-manager.ts deleted

File `server/agents/executor/memory/context-window-manager.ts` was deleted.
Server restart confirmed clean — no build errors, no import failures.
