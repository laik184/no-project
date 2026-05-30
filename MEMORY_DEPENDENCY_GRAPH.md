# MEMORY DEPENDENCY GRAPH
Generated: 2026-05-30

---

## Legend
```
→  imports
↓  calls
■  module
□  platform store
```

---

## Graph 1: execution-history (executor)

```
server/agents/executor/memory/execution-history.ts  [EXECUTION_HISTORY]
  ← imported by:
    │
    ├─■ executor/learning/pattern-learner.ts
    │     ↓ executionHistory.summary() — reads topFailures for strategy selection
    │
    ├─■ executor/learning/failure-predictor.ts
    │     ↓ executionHistory.summary() — reads topFailures for risk scoring
    │
    ├─■ executor/reasoning/decision-engine.ts
    │     ↓ executionHistory.hasPriorFix(toolName, errorClass) — repair decision
    │     ↓ executionHistory.findSimilarFailure(toolName, error) — retry rationale
    │
    ├─■ executor/recovery/recovery-engine.ts
    │     ↓ executionHistory.recordExecution(...) — records recovery attempt
    │
    └─■ executor/recovery/rollback-manager.ts
          ↓ executionHistory.recordExecution(...) — records rollback event

All calls: SYNCHRONOUS
Access pattern: write-heavy (recordExecution per step) + read-light (summary per prediction)
```

---

## Graph 2: failure-memory (executor)

```
server/agents/executor/memory/failure-memory.ts  [BUG_INTELLIGENCE]
  ← imported by:
    │
    ├─■ executor/reasoning/decision-engine.ts
    │     ↓ failureMemory.analyze(runId, toolName, kind, error) — WRITES + reads category
    │     ↓ failureMemory.isRetryStorm() — reads recent timestamps
    │
    ├─■ executor/recovery/recovery-engine.ts
    │     ↓ failureMemory.recordFailurePattern(runId, toolName, kind, error) — WRITES
    │
    ├─■ executor/learning/pattern-learner.ts
    │     ↓ failureMemory.chroniclePatterns() — reads for strategy adjustment
    │     ↓ failureMemory.isRetryStorm() — reads
    │
    └─■ executor/learning/failure-predictor.ts
          ↓ failureMemory.isRetryStorm() — reads
          ↓ failureMemory.chroniclePatterns() — reads

All calls: SYNCHRONOUS
Access pattern: write on every failure + read during prediction/strategy
```

---

## Graph 3: learning-store (executor — shared)

```
server/agents/executor/learning/learning-store.ts  [LEARNING_SYSTEM]
  ← imported by 9 files:
    │
    ├─■ executor/learning/pattern-learner.ts
    │     ↓ learningStore.getValue('tool-reliability', ...) — HOT-PATH READ
    │     ↓ learningStore.get(...) — HOT-PATH READ
    │     ↓ learningStore.upsert(...) — WRITE (governor-gated)
    │     ↓ learningStore.byKind('tool-reliability') — READ
    │
    ├─■ executor/learning/tool-selection-engine.ts
    │     ↓ learningStore.getValue(...) — HOT-PATH READ (called per task)
    │     ↓ learningStore.get(...) — HOT-PATH READ
    │     ↓ learningStore.upsert(...) — WRITE (governor-gated)
    │     ↓ learningStore.byKind(...) — READ
    │
    ├─■ executor/learning/strategy-optimizer.ts
    │     ↓ learningStore.getValue(...) — READ
    │     ↓ learningStore.get(...) — READ
    │     ↓ learningStore.upsert(...) — WRITE (governor-gated)
    │
    ├─■ executor/learning/failure-predictor.ts
    │     ↓ learningStore.get('tool-reliability', ...) — READ
    │     ↓ learningStore.byKind('tool-reliability') — READ
    │
    ├─■ executor/learning/feedback-loop.ts
    │     ↓ learningStore.getValue(...) — READ
    │     ↓ learningStore.get(...) — READ
    │     ↓ learningStore.upsert(...) — WRITE
    │     ↓ learningStore.version() — READ
    │     ↓ learningStore.size() — READ
    │
    ├─■ executor/telemetry/learning-insights.ts
    │     ↓ learningStore.summary() — READ (telemetry only)
    │     ↓ learningStore.byKind(...) — READ
    │
    ├─■ executor/learning/learning-governor.ts
    │     [indirect — learning-governor is called by modules that use learning-store,
    │      but does not itself import learning-store]
    │
    ├─■ agents/planner/learning/workflow-learning-engine.ts
    │     ↓ learningStore.getValue('workflow-risk', ...) — READ
    │     ↓ learningStore.upsert('workflow-risk', ...) — WRITE
    │
    ├─■ agents/browser/learning/ui-pattern-learner.ts
    │     ↓ learningStore.upsert('browser-pattern', ...) — WRITE
    │     ↓ learningStore.byKind('browser-pattern') — READ
    │
    └─■ agents/browser/learning/browser-reliability-engine.ts
          ↓ learningStore.getValue('tool-reliability', ...) — READ
          ↓ learningStore.upsert('tool-reliability', ...) — WRITE

All calls: SYNCHRONOUS
HOT-PATH: tool-selection-engine calls getValue() during every task routing decision
CONSTRAINT: Cannot be made async without refactoring all 9 callers + execution loop
```

---

## Graph 4: coderx/memory/working-memory (runtime)

```
server/agents/coderx/memory/working-memory.ts  [RUNTIME_STATE]
  ← imported by:
    ├─■ coderx/execution/coding-loop.ts
    │     ↓ workingMemory.init(runId), workingMemory.get(runId)
    └─■ coderx/execution/task-executor.ts
          ↓ workingMemory.get(runId), workingMemory.set(runId, ...)
```

---

## Graph 5: coderx/memory/execution-history (runtime)

```
server/agents/coderx/memory/execution-history.ts  [RUNTIME_STATE — per-run]
  ← imported by:
    ├─■ coderx/execution/task-executor.ts
    ├─■ coderx/execution/step-runner.ts
    └─■ coderx/execution/retry-manager.ts
          clearRun(runId) called at end of each run
```

---

## Graph 6: context-window-manager (ORPHANED)

```
server/agents/executor/memory/context-window-manager.ts  [ORPHANED]
  ← imported by: NONE
  
  Zero import references found across all of server/. Safe to delete.
```

---

## Graph 7: server/memory/ platform (target)

```
server/memory/core/memory-engine.ts  [PUBLIC API — ONLY ENTRY POINT]
  ← currently imported by:
    ├─■ main.ts (bootstrapMemory import)
    ├─■ agents/planner/planner-agent.ts
    ├─■ agents/executor/executor-agent.ts
    ├─■ agents/verifier/verifier-agent.ts
    ├─■ agents/supervisor/supervisor-agent.ts
    ├─■ agents/browser/browser-agent.ts
    ├─■ agents/coderx/coderx-agent.ts
    └─■ chat/orchestration/chat-orchestrator.ts

After migration will ALSO be imported by:
    ├─■ agents/executor/memory/execution-history.ts  [NEW — write-through]
    ├─■ agents/executor/memory/failure-memory.ts     [NEW — write-through]
    └─■ agents/executor/learning/learning-store.ts   [NEW — write-through]
```

---

## Circular Dependency Analysis

**New edges after migration:**
```
execution-history.ts → memory-engine.ts → memory-router → memory-registry → domain stores → BaseMemoryStore → Node built-ins
failure-memory.ts    → memory-engine.ts → (same chain)
learning-store.ts    → memory-engine.ts → (same chain)
```

**Does memory-engine.ts import from executor?** NO — confirmed by file inspection.
**Does memory-engine.ts import from agents?** NO — confirmed.

**RESULT: ZERO CIRCULAR DEPENDENCIES introduced by migration.**

---

## Runtime Call Path

```
Execution loop (per step):
  task-executor → step-runner → dispatcher → tool
                           ↓
                  executionHistory.recordExecution()
                           ↓ (fire-and-forget AFTER sync write)
                  memoryEngine.store('execution', ...) → file I/O

Recovery decision:
  recovery-engine → decisionEngine.decide()
                          ↓
               failureMemory.analyze() → SYNC read+write
                          ↓ (fire-and-forget AFTER sync write)
               memoryEngine.store('bug', ...) → file I/O

Post-run learning:
  feedback-loop → patternLearner.recordOutcome()
                          ↓
               learningStore.upsert() → SYNC in-process
                          ↓ (fire-and-forget AFTER sync write)
               memoryEngine.store('learning', ...) → file I/O
```

The memory platform is NEVER in the critical path — all writes are fire-and-forget.
