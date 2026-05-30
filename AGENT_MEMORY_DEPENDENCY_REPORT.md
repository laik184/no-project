# Agent Memory Dependency Report

**Generated:** 2026-05-30  
**Scope:** `server/agents/` — all memory and learning files  
**Method:** Full source read + exhaustive import graph trace  
**Constraint:** Read-only analysis. No code was modified.

---

## Audit Inventory (17 files)

### Legend

| Symbol | Meaning |
|--------|---------|
| `KEEP_LOCAL` | File must remain in place — actively used by local agent(s) |
| `BRIDGE` | File is KEEP_LOCAL AND already bridged to server/memory/ platform |
| `ORPHANED` | File has zero callers outside its own file — safe to delete |

---

## 1. `server/agents/executor/memory/execution-history.ts`

**Classification:** `KEEP_LOCAL + BRIDGE`  
**Memory category:** Cross-run intelligence (ring-buffer of execution snapshots)  
**Persistence:** Write-through to `'execution'` MemoryCategory via `memoryEngine`. Has `hydrate()`.  
**Internal callers (within agents/):**

| Caller | Usage |
|--------|-------|
| `coderx/execution/retry-manager.ts` | `executionHistory.recordRetry()` |
| `coderx/execution/step-runner.ts` | `executionHistory.recordSnapshot()` |
| `coderx/execution/task-executor.ts` | `executionHistory.recordTaskOutput()` |
| `coderx/coderx-agent.ts` | `executionHistory.getSnapshots()` |
| `executor/learning/failure-predictor.ts` | `executionHistory.summary()` |
| `executor/learning/pattern-learner.ts` | reads summary |
| `executor/reasoning/decision-engine.ts` | `hasPriorFix()`, `findSimilarFailure()` |
| `executor/recovery/recovery-engine.ts` | `recordExecution()` |
| `executor/recovery/rollback-manager.ts` | `recordExecution()` |
| `executor/executor-agent.ts` | `summary()` |

**Platform callers (server/memory/):**

| Caller | Usage |
|--------|-------|
| `memory/bootstrap/memory-hydrator.ts` | `executionHistory.hydrate(entries)` — startup restore |
| `memory/bootstrap/memory-loader.ts` | imports `ExecutionHistoryEntry` type |

**Verdict:** Canonical cross-run execution store. Dual use: CoderX writes snapshots, Executor writes full records, learning subsystem reads intelligence. Platform hydrator restores it on cold start. Must remain in `executor/memory/` — moving it would break 10+ callers.

---

## 2. `server/agents/executor/memory/failure-memory.ts`

**Classification:** `KEEP_LOCAL + BRIDGE`  
**Memory category:** Cross-run failure pattern detection (ring-buffer + storm detection)  
**Persistence:** Write-through to `'bug'` MemoryCategory. Has `hydrate()`.  
**Callers:**

| Caller | Usage |
|--------|-------|
| `executor/learning/failure-predictor.ts` | `isRetryStorm()`, `chroniclePatterns()` |
| `executor/learning/pattern-learner.ts` | `isRetryStorm()`, `chroniclePatterns()` |
| `executor/reasoning/decision-engine.ts` | `analyze()`, `isRetryStorm()` |
| `executor/recovery/recovery-engine.ts` | `recordFailurePattern()` |
| `executor/executor-agent.ts` | `chroniclePatterns()` |
| `memory/bootstrap/memory-hydrator.ts` | `failureMemory.hydrate(patterns)` |
| `memory/bootstrap/memory-loader.ts` | imports `FailurePattern` type |

**Verdict:** Core failure intelligence store. Bridged to platform. Must stay local.

---

## 3. `server/agents/executor/memory/working-memory.ts`

**Classification:** `KEEP_LOCAL`  
**Memory category:** Runtime state (per-run browser slots, retry state, file tracking)  
**Persistence:** None — pure in-memory Map/Set. Cleared when run ends.  
**Callers:**

| Caller | Usage |
|--------|-------|
| `coderx/execution/coding-loop.ts` | `setAnalysis()`, `setPlan()` |
| `coderx/execution/task-executor.ts` | `setActiveTask()`, `markTaskCompleted/Failed()` |
| `coderx/coderx-agent.ts` | `workingMemory.init()`, `workingMemory.get()` |
| `executor/recovery/rollback-manager.ts` | `get()`, `update()`, `restore()` |
| `executor/recovery/self-healing-loop.ts` | `init()` |
| `executor/telemetry/runtime-visualizer.ts` | `get()` |

**Verdict:** Live runtime state for active runs. No persistence desired — this is the correct architecture. Must stay local.

---

## 4. `server/agents/coderx/memory/execution-history.ts`

**Classification:** `KEEP_LOCAL`  
**Memory category:** Session state (per-run step snapshots, retry log)  
**Persistence:** None. `clearRun()` wipes all state. No `hydrate()`, no platform bridge.  
**Callers:**

| Caller | Usage |
|--------|-------|
| `coderx/execution/retry-manager.ts` | `recordRetry()` |
| `coderx/execution/step-runner.ts` | `recordSnapshot()` |
| `coderx/execution/task-executor.ts` | `recordTaskOutput()` |
| `coderx/coderx-agent.ts` | `getSnapshots()` |
| `coderx/index.ts` | re-exports to public API |

**Verdict:** Intentionally ephemeral. CoderX tracks step output and retries within a single run for in-run reasoning. Not the same module as `executor/memory/execution-history.ts` (different schema, different lifecycle). Correct location and classification.

---

## 5. `server/agents/coderx/memory/working-memory.ts`

**Classification:** `KEEP_LOCAL`  
**Memory category:** Runtime scratchpad (analysis, plan, active task, completed/failed sets)  
**Persistence:** None. Keyed by `runId`, cleared per run.  
**Callers:**

| Caller | Usage |
|--------|-------|
| `coderx/execution/coding-loop.ts` | `setAnalysis()`, `setPlan()` |
| `coderx/execution/task-executor.ts` | `setActiveTask()`, task state tracking |
| `coderx/coderx-agent.ts` | `init()`, `get()` |
| `coderx/index.ts` | re-exports |

**Verdict:** Runtime scratchpad. Correct design — no persistence needed or desired. Stay local.

---

## 6. `server/agents/executor/learning/learning-store.ts`

**Classification:** `KEEP_LOCAL + BRIDGE`  
**Memory category:** Long-term learning (tool reliability, workflow risk, strategy weight, execution quality, browser patterns)  
**Persistence:** Write-through to `'learning'` MemoryCategory. Has `hydrate()`.  
**Callers (13 unique files):**

| Caller | Role |
|--------|------|
| `browser/learning/browser-reliability-engine.ts` | read/write `browser-pattern` kind |
| `browser/learning/ui-pattern-learner.ts` | read/write `browser-pattern` kind |
| `executor/learning/failure-predictor.ts` | read `tool-reliability` |
| `executor/learning/feedback-loop.ts` | read/write `execution-quality` |
| `executor/learning/pattern-learner.ts` | read/write `tool-reliability`, `workflow-risk` |
| `executor/learning/strategy-optimizer.ts` | read/write `strategy-weight`, `execution-quality` |
| `executor/learning/tool-selection-engine.ts` | read/write `tool-reliability`, `execution-quality` |
| `executor/telemetry/learning-insights.ts` | read summary |
| `executor/executor-agent.ts` | reads `topByKind('tool-reliability')` |
| `planner/learning/workflow-learning-engine.ts` | read/write `execution-quality`, `workflow-risk` |
| `memory/bootstrap/memory-hydrator.ts` | `learningStore.hydrate(entries)` |
| `memory/bootstrap/memory-loader.ts` | imports `LearnedEntry`, `LearnedKind` types |
| `memory/bootstrap.ts` | (via server/memory's own learningStore — different instance) |

**Note:** `server/memory/learning-memory/learning-store.ts` is a **separate, different** LearningStore instance. The platform's `server/memory/bootstrap.ts` registers its own instance with the memory registry. The hydrator bridges BOTH directions: it loads from the platform into the agent-local store on startup.

**Verdict:** The in-process synchronous store for all learning modules. 13 callers require synchronous reads — replacing with async platform calls would break the entire learning subsystem. Must stay local. Already properly bridged.

---

## 7. `server/agents/executor/learning/learning-governor.ts`

**Classification:** `KEEP_LOCAL`  
**Memory category:** Governance / rate-limiting (NOT a memory store — controls write throughput)  
**Persistence:** None — in-memory sliding window counters. Intentionally ephemeral.  
**Callers:**

| Caller | Usage |
|--------|-------|
| `browser/learning/browser-reliability-engine.ts` | `permitUpdate()` |
| `browser/learning/ui-pattern-learner.ts` | `permitUpdate()` |
| `executor/learning/feedback-loop.ts` | `assertBoundary()`, `permitUpdate()` |
| `executor/learning/pattern-learner.ts` | `permitUpdate()` |
| `executor/learning/strategy-optimizer.ts` | `permitUpdate()` |
| `executor/learning/tool-selection-engine.ts` | `permitUpdate()` |
| `executor/telemetry/learning-insights.ts` | `stats()` |
| `planner/learning/workflow-learning-engine.ts` | `permitUpdate()` |

**Verdict:** Rate-limiting governance engine. All learning writes gate through it. Must be synchronous and local (in-process rate limiting). Not a memory file — correctly placed in `learning/`.

---

## 8. `server/agents/executor/learning/execution-scorer.ts`

**Classification:** `KEEP_LOCAL`  
**Memory category:** Pure logic (no I/O, no state, no persistence)  
**Callers:** `executor/learning/feedback-loop.ts` only  

**Verdict:** Stateless scoring math (`scoreExecution()`, `summariseScore()`). No memory ownership. Correct location.

---

## 9. `server/agents/executor/learning/pattern-learner.ts`

**Classification:** `KEEP_LOCAL`  
**Memory category:** Learning intelligence (reads history + failure-memory, writes to learning-store)  
**Callers:**

| Caller | Usage |
|--------|-------|
| `executor/learning/failure-predictor.ts` | `getToolReliability()`, `getWorkflowRisk()` |
| `executor/learning/feedback-loop.ts` | `learnPattern()` |
| `executor/learning/tool-selection-engine.ts` | `patternLearner` import |
| `executor/telemetry/learning-insights.ts` | reads patterns |

**Verdict:** Core learning intelligence. Tightly coupled to local stores for synchronous reads. Keep.

---

## 10. `server/agents/executor/learning/failure-predictor.ts`

**Classification:** `KEEP_LOCAL`  
**Memory category:** Learning intelligence (reads from learning-store, failure-memory, executionHistory, pattern-learner)  
**Callers:** `executor/telemetry/learning-insights.ts` only (`highRiskTools()`)  

**Verdict:** Pre-execution risk assessment engine. Reads four local data sources synchronously. Keep.

---

## 11. `server/agents/executor/learning/feedback-loop.ts`

**Classification:** `KEEP_LOCAL`  
**Memory category:** Learning orchestrator (coordinates the execute → score → learn cycle)  
**Callers:** `executor/telemetry/learning-insights.ts` only (`stats()`)  

**Verdict:** Post-run learning cycle coordinator. Orchestrates pattern-learner, tool-selection-engine, strategy-optimizer. Keep.

---

## 12. `server/agents/executor/learning/strategy-optimizer.ts`

**Classification:** `KEEP_LOCAL`  
**Memory category:** Learning intelligence (reads/writes strategy-weight and execution-quality from learning-store)  
**Callers:** `executor/learning/feedback-loop.ts`, `executor/telemetry/learning-insights.ts`  

**Verdict:** Strategy recommendation engine. Keep.

---

## 13. `server/agents/executor/learning/tool-selection-engine.ts`

**Classification:** `KEEP_LOCAL`  
**Memory category:** Learning intelligence (reads/writes tool-reliability and execution-quality from learning-store)  
**Callers:** `executor/learning/feedback-loop.ts`, `executor/telemetry/learning-insights.ts`  

**Verdict:** Adaptive tool confidence engine. Keep.

---

## 14. `server/agents/browser/learning/browser-reliability-engine.ts`

**Classification:** `ORPHANED`  
**Memory category:** Learning facade (delegates all storage to executor/learning/learning-store + learning-governor)  
**Callers:** **None** — zero imports from any file outside itself  

**Verdict:** Dead code. Exports `browserReliabilityEngine` singleton but it is never imported anywhere in the codebase. Safe to delete.

---

## 15. `server/agents/browser/learning/ui-pattern-learner.ts`

**Classification:** `ORPHANED`  
**Memory category:** Learning facade (delegates all storage to executor/learning/learning-store + learning-governor)  
**Callers:** **None** — zero imports from any file outside itself  

**Verdict:** Dead code. Exports `uiPatternLearner` singleton but it is never imported anywhere in the codebase. Safe to delete.

---

## 16. `server/agents/planner/learning/workflow-learning-engine.ts`

**Classification:** `ORPHANED`  
**Memory category:** Learning intelligence (reads/writes executor/learning/learning-store via cross-agent import)  
**Callers:** **None** — zero imports from any file outside itself  
**Cross-agent coupling risk:** Imports `../../executor/learning/learning-store.ts` and `../../executor/learning/learning-governor.ts` — a planner→executor dependency that violates single-agent ownership.

**Verdict:** Dead code AND structurally problematic (cross-agent learning-store coupling with no consumer). Safe to delete.

---

## 17. `server/agents/executor/telemetry/learning-insights.ts`

**Classification:** `KEEP_LOCAL` (not a memory file — telemetry consumer)  
**Note:** Reads from learning-store, pattern-learner, failure-predictor, feedback-loop, strategy-optimizer, tool-selection-engine, learning-governor. Not in scope for memory ownership audit but noted as a key consumer of the learning subsystem.

---

## Summary Table

| File | Classification | Safe to Delete? | Bridged to Platform? |
|------|---------------|-----------------|----------------------|
| `executor/memory/execution-history.ts` | KEEP_LOCAL + BRIDGE | No | Yes (hydrator) |
| `executor/memory/failure-memory.ts` | KEEP_LOCAL + BRIDGE | No | Yes (hydrator) |
| `executor/memory/working-memory.ts` | KEEP_LOCAL | No | No (runtime state) |
| `coderx/memory/execution-history.ts` | KEEP_LOCAL | No | No (session state) |
| `coderx/memory/working-memory.ts` | KEEP_LOCAL | No | No (runtime state) |
| `executor/learning/learning-store.ts` | KEEP_LOCAL + BRIDGE | No | Yes (hydrator) |
| `executor/learning/learning-governor.ts` | KEEP_LOCAL | No | No (governance logic) |
| `executor/learning/execution-scorer.ts` | KEEP_LOCAL | No | No (pure logic) |
| `executor/learning/pattern-learner.ts` | KEEP_LOCAL | No | No (intelligence) |
| `executor/learning/failure-predictor.ts` | KEEP_LOCAL | No | No (intelligence) |
| `executor/learning/feedback-loop.ts` | KEEP_LOCAL | No | No (orchestrator) |
| `executor/learning/strategy-optimizer.ts` | KEEP_LOCAL | No | No (intelligence) |
| `executor/learning/tool-selection-engine.ts` | KEEP_LOCAL | No | No (intelligence) |
| `browser/learning/browser-reliability-engine.ts` | **ORPHANED** | **Yes** | No |
| `browser/learning/ui-pattern-learner.ts` | **ORPHANED** | **Yes** | No |
| `planner/learning/workflow-learning-engine.ts` | **ORPHANED** | **Yes** | No |

---

## Key Architectural Findings

1. **Write-through bridge is complete and correct.** The three stores with cross-run intelligence (`executor/memory/execution-history.ts`, `executor/memory/failure-memory.ts`, `executor/learning/learning-store.ts`) are already wired to `server/memory/` via the memory-hydrator. Their persistence architecture is sound.

2. **No MIGRATE candidates exist.** Every active memory file is already either correctly ephemeral (working-memory, session-state) or already bridged to the platform. There is nothing left to migrate.

3. **Three files are dead code.** `browser/learning/browser-reliability-engine.ts`, `browser/learning/ui-pattern-learner.ts`, and `planner/learning/workflow-learning-engine.ts` are exported singletons that are never imported. They accumulate maintenance surface with zero runtime benefit.

4. **Cross-agent learning-store coupling.** `planner/learning/workflow-learning-engine.ts` imports directly from `executor/learning/learning-store.ts` and `executor/learning/learning-governor.ts`. Since the file is orphaned, this coupling has no runtime effect — but it is structurally incorrect and confirms the file should be deleted rather than wired.

5. **Synchronous read constraint is non-negotiable.** All 13 callers of `executor/learning/learning-store.ts` perform synchronous reads. Migrating to async platform calls would require refactoring all 13 callers across 5 agents — scope far beyond a cleanup audit.
