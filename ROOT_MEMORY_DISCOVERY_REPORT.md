# ROOT MEMORY DISCOVERY REPORT
Generated: 2026-05-30

---

## Scan Methodology

Each of the 10 target roots was scanned recursively. Every file was inspected for imports
containing the keywords: `memory`, `store`, `cache`, `registry`, `retrieval`, `graph`,
`knowledge`, `reflection`, `history`, `checkpoint`, `persistence`, `learning`.

---

## ROOT: server/agents/planner/

### Memory-relevant files found

| File | Keyword match | Detail |
|------|--------------|--------|
| `learning/workflow-learning-engine.ts` | `learning` | Imports `learningStore` + `learningGovernor` from `executor/learning/` |
| `reasoning/dependency-analyzer.ts` | `graph` | Comment only — pure graph analysis, no imports |

### Agent entry point imports (planner-agent.ts)
None matching keywords. Imports: context, session, metrics, logger, monitor, validator,
planning-loop, utils.

### Summary
- No private memory modules owned by planner/
- 1 cross-agent learning dependency (borrowing executor's learningStore)
- No direct memoryEngine usage

---

## ROOT: server/agents/executor/

### Memory-relevant files found

| File | Keyword match | Detail |
|------|--------------|--------|
| `memory/working-memory.ts` | `memory` | OWNED — run-scoped transient state Map |
| `memory/execution-history.ts` | `history` | OWNED — cross-run ring-buffer (max 200) |
| `memory/failure-memory.ts` | `memory` | OWNED — failure pattern frequency table |
| `learning/learning-store.ts` | `learning` | OWNED — in-process scored intelligence (max 1000) |
| `learning/learning-governor.ts` | `learning` | OWNED — governance/rate-limiting for learning updates |
| `learning/tool-selection-engine.ts` | `learning`, `store` | Uses learningStore + learningGovernor |
| `learning/strategy-optimizer.ts` | `learning`, `store` | Uses learningStore + learningGovernor |
| `learning/pattern-learner.ts` | `learning`, `history`, `memory` | Uses executionHistory + failureMemory + learningStore + learningGovernor |
| `learning/failure-predictor.ts` | `history`, `memory`, `learning` | Uses executionHistory + failureMemory + learningStore |
| `learning/feedback-loop.ts` | `learning` | Uses learningGovernor + learningStore |
| `telemetry/learning-insights.ts` | `learning`, `store` | Aggregates all learning modules |
| `telemetry/runtime-visualizer.ts` | `memory` | Uses workingMemory |
| `recovery/self-healing-loop.ts` | `memory` | Uses workingMemory |
| `recovery/rollback-manager.ts` | `memory`, `history` | Uses workingMemory + executionHistory |
| `recovery/recovery-engine.ts` | `history`, `memory` | Uses executionHistory + failureMemory |
| `reasoning/decision-engine.ts` | `memory`, `history` | Uses failureMemory + executionHistory |
| `coordination/dispatcher-client.ts` | `registry` | Uses tool-dispatcher (not memory) |

### Agent entry point imports (executor-agent.ts)
None matching keywords. Clean orchestration entry.

### Summary
- 3 private memory modules (working-memory, execution-history, failure-memory) — all ACTIVE
- 2 private learning modules (learning-store, learning-governor) — ACTIVE, shared with other agents
- No memoryEngine usage

---

## ROOT: server/agents/verifier/

### Memory-relevant files found
None. Zero keyword matches in any verifier sub-file.

### Agent entry point imports (verifier-agent.ts)
None matching keywords.

### Summary
- No private memory, no learning, no caches, no registries
- Cleanest agent for memoryEngine injection

---

## ROOT: server/agents/browser/

### Memory-relevant files found

| File | Keyword match | Detail |
|------|--------------|--------|
| `learning/ui-pattern-learner.ts` | `learning`, `store` | Imports learningStore + learningGovernor from executor/ |
| `learning/browser-reliability-engine.ts` | `learning`, `store` | Imports learningStore + learningGovernor from executor/ |
| `coordination/dispatcher-client.ts` | registry | Uses tool-dispatcher |

### Agent entry point imports (browser-agent.ts)
None matching keywords. Clean orchestration entry.

### Summary
- No private memory owned by browser/
- 2 cross-agent learning dependencies (borrowing executor's modules)
- No memoryEngine usage

---

## ROOT: server/agents/filesystem/

### Memory-relevant files found

| File | Keyword match | Detail |
|------|--------------|--------|
| `coordination/dispatcher-client.ts` | `registry` | Uses tool-dispatcher |

### Summary
- No memory, history, cache, or learning modules
- No memoryEngine usage

---

## ROOT: server/agents/terminal/

### Memory-relevant files found
None. Zero keyword matches.

### Summary
- No memory modules of any kind

---

## ROOT: server/agents/supervisor/

### Memory-relevant files found
None. Zero keyword matches in any supervisor sub-file.

### Agent entry point imports (supervisor-agent.ts)
None matching keywords.

### Summary
- No private memory modules
- Clean entry point for memoryEngine injection

---

## ROOT: server/agents/coderx/

### Memory-relevant files found

| File | Keyword match | Detail |
|------|--------------|--------|
| `memory/working-memory.ts` | `memory` | OWNED — run-scoped Map<runId, WorkingMemoryEntry> |
| `memory/execution-history.ts` | `history` | OWNED — snapshots + retries + task outputs per run |
| `execution/task-executor.ts` | `memory`, `history` | Uses coderx workingMemory + executionHistory |
| `execution/step-runner.ts` | `history` | Uses coderx executionHistory |
| `execution/retry-manager.ts` | `history` | Uses coderx executionHistory |
| `execution/coding-loop.ts` | `memory` | Uses coderx workingMemory |

### Agent entry point imports (coderx-agent.ts)
- `import { workingMemory } from './memory/working-memory.ts'` (line 21)
- `import { executionHistory } from './memory/execution-history.ts'` (line 22)

### Summary
- 2 private memory modules (working-memory, execution-history) — ACTIVE
- Different schema from executor/'s private memory
- No memoryEngine usage

---

## ROOT: server/orchestration/

### Memory-relevant files found

| File | Keyword match | Detail |
|------|--------------|--------|
| `core/orchestration-replay.ts` | `checkpoint`, `store` | Per-run checkpoint Map<runId, unknown[]>. Lightweight replay store. |
| `core/run-manager.ts` | `registry` | Per-run RunRecord state Map. Lifecycle state only. |
| `execution/execution-result-registry.ts` | `registry` | Per-run ExecutionStats Map. Post-run observability. |
| `distributed/run-scoped-orchestrator.ts` | `checkpoint` | Per-run Checkpoint[] array within class instance. Phase state machine. |
| `coordination/dispatcher-client.ts` | `registry` | Uses tool-dispatcher |

### Orchestrator entry point (orchestrator.ts)
No memory/store/cache keyword imports.

### Summary
- 3 lightweight in-process state stores (NOT memory systems — no persistence, no TTL, no search)
- No learning, no retrieval, no knowledge graph
- No memoryEngine usage

---

## ROOT: server/chat/

### Memory-relevant files found

| File | Keyword match | Detail |
|------|--------------|--------|
| `persistence/chat-store.ts` | `store` | Aggregate facade over message-store + run-store (DB-backed) |
| `persistence/message-store.ts` | `store` | DB-backed message persistence |
| `persistence/run-store.ts` | `store` | DB-backed run record persistence |
| `persistence/conversation-store.ts` | `store` | DB-backed conversation persistence |
| `persistence/attachment-store.ts` | `store` | DB-backed attachment persistence |
| `context/context-loader.ts` | `store`, `cache` | Uses messageStore, runStore, contextCache |
| `context/context-cache.ts` | `cache` | In-memory LRU-like cache for chat context |
| `run/registry.ts` | `cache`, `registry` | Uses contextCache |
| `api/history.routes.ts` | `history` | HTTP route for history |
| `orchestration/chat-orchestrator.ts` | N/A | No memory keyword imports |

### Summary
- All persistence stores are DB-backed (PostgreSQL via Drizzle) — not memory system conflicts
- contextCache is an in-memory chat cache — scoped to chat module only
- No memoryEngine usage

---

## server/memory/ — The Memory Platform

Full structure mapped separately in MEMORY_COMPATIBILITY_REPORT.md.
Status: **BUILT AND REGISTERED. NEVER BOOTSTRAPPED. NEVER IMPORTED BY ANY AGENT.**
