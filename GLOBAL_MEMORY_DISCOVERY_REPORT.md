# GLOBAL MEMORY DISCOVERY REPORT
Scan date: 2026-05-30 | Roots: server/agents/, server/orchestration/, server/chat/, server/tools/, server/publishing/, server/memory/

---

## 1. server/agents/executor/memory/

### execution-history.ts
- **Purpose**: Cross-run execution intelligence. Ring-buffer (max 200 entries). Persists successful/failed tool outcomes, retry counts, error classification, fix patterns.
- **Storage**: Module-level `_history: ExecutionHistoryEntry[]` — in-process array, not persisted.
- **Exports**: `executionHistory` — `recordExecution()`, `recordFailure()`, `recordSuccess()`, `findSimilarFailure()`, `getByRun()`, `getExecutionHistory()`, `hasPriorFix()`, `summary()`, `reset()`, `size()`
- **Imports**: `TaskKind` type only — no external deps
- **Runtime usage**: ACTIVE. Called on every executor step.
- **Callers**: `executor/learning/pattern-learner.ts`, `executor/learning/failure-predictor.ts`, `executor/reasoning/decision-engine.ts`, `executor/recovery/recovery-engine.ts`, `executor/recovery/rollback-manager.ts`
- **Owner**: executor agent
- **Classification**: **EXECUTION_HISTORY** | **LONG_TERM_MEMORY**
- **Note**: Cross-run (not cleared between runs). Lost on server restart → persistence gap.

### failure-memory.ts
- **Purpose**: Cross-run failure pattern intelligence. Maintains frequency table of normalized error signatures, detects chronic failures and retry storms.
- **Storage**: Module-level `_patterns: Map<string, FailurePattern>` — in-process Map, not persisted.
- **Exports**: `failureMemory` — `recordFailurePattern()`, `hasSeenFailure()`, `getFailureFrequency()`, `analyze()`, `isRetryStorm()`, `chroniclePatterns()`, `allPatterns()`, `reset()`, `size()`
- **Imports**: `TaskKind` type only
- **Runtime usage**: ACTIVE. Called during recovery, failure prediction, decision engine.
- **Callers**: `executor/reasoning/decision-engine.ts`, `executor/recovery/recovery-engine.ts`, `executor/learning/pattern-learner.ts`, `executor/learning/failure-predictor.ts`
- **Owner**: executor agent
- **Classification**: **BUG_INTELLIGENCE** | **LONG_TERM_MEMORY**
- **Note**: Cross-run. Lost on restart → persistence gap.

### working-memory.ts
- **Purpose**: Per-run transient execution state. Stores current task ID, active files, tool outputs, retry counts, browser session state, validation results, snapshot history for the current run only.
- **Storage**: Module-level `Map<runId, WorkingMemorySlot>` — per-run, cleared after run.
- **Exports**: `workingMemory` — `init()`, `get()`, `set()`, `clear()`, `has()`
- **Runtime usage**: ACTIVE. Hot-path — called every task/step.
- **Callers**: `executor/execution/task-executor.ts`, `executor/telemetry/runtime-visualizer.ts`, `executor/recovery/self-healing-loop.ts`, `executor/recovery/rollback-manager.ts`
- **Owner**: executor agent
- **Classification**: **RUNTIME_STATE** | PROTECT

### context-window-manager.ts
- **Purpose**: LLM context token budget governance. Per-run Map of ContextMessage[], trim/compress logic, priority ordering.
- **Storage**: Module-level `_windows: Map<runId, ContextMessage[]>`
- **Exports**: `contextWindowManager` — `init()`, `push()`, `trim()`, `getMessages()`, `tokenUsage()`, `clear()`, `size()`
- **Runtime usage**: **ZERO IMPORTERS FOUND** — no file imports this module.
- **Callers**: None
- **Owner**: executor agent (unconnected)
- **Classification**: **ORPHANED**
- **Action**: Safe to delete — no callers, no build reference.

---

## 2. server/agents/executor/learning/

### learning-store.ts
- **Purpose**: Cross-run bounded in-process scored intelligence (max 1000 entries). Single source of truth for learned tool reliability, strategy weights, workflow risk, browser patterns, failure predictions, execution quality.
- **Storage**: Module-level `_store: Map<string, LearnedEntry>` — in-process, not persisted.
- **Exports**: `learningStore` — `upsert()`, `get()`, `getValue()`, `byKind()`, `topByKind()`, `summary()`, `reset()`, `size()`, `version()`
- **API characteristic**: **ALL SYNCHRONOUS** — critical for hot-path tool selection.
- **Callers (9 files)**: `executor/learning/pattern-learner.ts`, `executor/learning/tool-selection-engine.ts`, `executor/learning/strategy-optimizer.ts`, `executor/learning/failure-predictor.ts`, `executor/learning/feedback-loop.ts`, `executor/telemetry/learning-insights.ts`, `executor/learning/learning-governor.ts`, `agents/planner/learning/workflow-learning-engine.ts`, `agents/browser/learning/ui-pattern-learner.ts`, `agents/browser/learning/browser-reliability-engine.ts`
- **Owner**: executor agent (shared cross-agent)
- **Classification**: **LEARNING_SYSTEM** | **LONG_TERM_MEMORY**
- **Note**: Cross-run. Lost on restart → persistence gap. Cannot be replaced (synchronous hot-path reads).

### learning-governor.ts
- **Purpose**: Hard governance boundary for all learning updates. Rate limiting, delta clamping, boundary assertions.
- **Storage**: Stateless rule engine — no persistent state.
- **Classification**: **LEARNING_SYSTEM (logic)** | PROTECT (pure logic, not a store)

### tool-selection-engine.ts
- **Purpose**: Adaptive tool selection using learned confidence scores.
- **Classification**: **LEARNING_SYSTEM (consumer)** | PROTECT

### strategy-optimizer.ts
- **Purpose**: Learns which execution strategies work best per workflow type.
- **Classification**: **LEARNING_SYSTEM (consumer)** | PROTECT

### pattern-learner.ts
- **Purpose**: Central learning intelligence engine. Reads executionHistory + failureMemory → extracts patterns → writes to learningStore.
- **Classification**: **LEARNING_SYSTEM (consumer)** | PROTECT

### failure-predictor.ts
- **Purpose**: Pre-execution failure prediction using learned patterns.
- **Classification**: **LEARNING_SYSTEM (consumer)** | PROTECT

### feedback-loop.ts
- **Purpose**: Closes the learning cycle. Rate-limited (500 cycles/hour). Governor-gated.
- **Classification**: **LEARNING_SYSTEM (consumer)** | PROTECT

### learning-insights.ts
- **Purpose**: Telemetry aggregator for all learning modules.
- **Classification**: **LEARNING_SYSTEM (consumer)** | PROTECT

---

## 3. server/agents/coderx/memory/

### execution-history.ts
- **Purpose**: Per-run snapshots, retry history, and task outputs for CoderX runs. Keyed by runId.
- **Storage**: Module-level `Map<runId, ExecutionSnapshot[]>` — per-run, has `clearRun(runId)`.
- **Exports**: `executionHistory` — `recordSnapshot()`, `recordRetry()`, `recordTaskOutput()`, `getSnapshots()`, `getRetries()`, `getTaskOutputs()`, `getRetryCountForStep()`, `clearRun()`
- **Callers**: `coderx/execution/task-executor.ts`, `coderx/execution/step-runner.ts`, `coderx/execution/retry-manager.ts`
- **Owner**: coderx agent (different schema from executor's execution-history)
- **Classification**: **RUNTIME_STATE** — per-run, has clearRun(), does NOT cross runs
- **Action**: PROTECT

### working-memory.ts
- **Purpose**: Per-run context store for CoderX (coding task analysis, coding plan, completed/failed task sets, scratchpad).
- **Storage**: `Map<runId, WorkingMemoryEntry>` — per-run.
- **Exports**: `workingMemory` — `init()`, `get()`, `set()`, `clear()`
- **Classification**: **RUNTIME_STATE** | PROTECT

---

## 4. server/orchestration/

### core/orchestration-replay.ts
- **Purpose**: Per-run phase checkpoint store for replay consumers. 3 functions: storeCheckpoint, getCheckpoints, clearCheckpoints.
- **Storage**: `Map<runId, unknown[]>` — per-run, in-process.
- **Classification**: **CHECKPOINT/RUNTIME_STATE** | PROTECT

### execution/execution-result-registry.ts
- **Purpose**: Per-run execution statistics for observability. No persistence, no TTL.
- **Storage**: `Map<runId, ExecutionStats>` — per-run.
- **Classification**: **RUNTIME_STATE** | PROTECT

### distributed/run-scoped-orchestrator.ts
- **Purpose**: Phase-level state machine. Has per-instance Checkpoint[] array.
- **Classification**: **RUNTIME_STATE** | PROTECT

---

## 5. server/chat/

### persistence/chat-store.ts, message-store.ts, run-store.ts, conversation-store.ts, attachment-store.ts
- **Purpose**: DB-backed persistence via Drizzle ORM (PostgreSQL).
- **Classification**: **DB_BACKED** | PROTECT (different storage tier)

### context/context-cache.ts
- **Purpose**: In-memory LRU cache for chat context. Keyed by runId, evicted after run.
- **Classification**: **CACHE/RUNTIME_STATE** | PROTECT

### realtime/connection-registry.ts
- **Purpose**: Active SSE/WS connection registry. Ephemeral.
- **Classification**: **RUNTIME_STATE** | PROTECT

### run/registry.ts
- **Purpose**: Cleanup coordinator — calls clear on run-scoped caches at eviction time. Owns no state itself.
- **Classification**: **RUNTIME_STATE (coordinator)** | PROTECT

---

## 6. server/tools/

### filesystem/lib/workspace/workspace-history.ts
- **Purpose**: File-backed workspace operation history (.history/*.json, max 500 entries/workspace). Records write/edit/delete/rename operations.
- **Storage**: File-backed JSON — ALREADY PERSISTENT.
- **Classification**: **EXECUTION_HISTORY** | ALREADY PERSISTENT — no migration needed
- **Note**: Different scope (filesystem audit trail) from server/memory/ (agent intelligence). Not a duplicate.

### filesystem/lib/workspace/snapshot-manager.ts
- **Purpose**: File snapshot manager for workspace rollback.
- **Classification**: **CHECKPOINT** | PROTECT

### terminal/state/process-history.ts
- **Purpose**: Per-run process execution history (commands, PIDs, exit codes). Ring-buffer (max 200/run).
- **Storage**: `Map<runId, ProcessHistoryEntry[]>` — per-run, has `clear(runId)`.
- **Classification**: **RUNTIME_STATE** | PROTECT

### terminal/state/port-registry.ts
- **Purpose**: Active port allocation registry.
- **Classification**: **RUNTIME_STATE** | PROTECT

### registry/tool-registry.ts
- **Purpose**: Tool registration and lookup. Sealed after bootstrap.
- **Classification**: **RUNTIME_STATE** | PROTECT

---

## 7. server/publishing/services/

### app-settings/settings-store.ts
- **Purpose**: DB-backed deployment settings and secrets (Drizzle ORM).
- **Classification**: **DB_BACKED** | PROTECT

### logs/log-store.ts
- **Purpose**: Per-deployment in-memory log buffer (Map<deploymentId, DeployLogEntry[]>).
- **Classification**: **CACHE/RUNTIME_STATE** | PROTECT

### security/issue-store.ts
- **Purpose**: Per-deployment security scan results (Map<deploymentId, ScanResult>). In-memory.
- **Classification**: **CACHE/RUNTIME_STATE** | PROTECT

### auth/auth-config-store.ts
- **Purpose**: Deployment auth configuration.
- **Classification**: **DB_BACKED or RUNTIME** | PROTECT

---

## 8. server/memory/ (The Platform — 62 files)

Full inventory previously documented. Status as of this scan:
- 11 domain stores registered at bootstrap ✓
- bootstrapMemory() called in main.ts ✓ (added in previous phase)
- 7 agent entry points now using memoryEngine (planner, executor, verifier, supervisor, browser, coderx, chat) ✓
- **GAP**: executor/memory/execution-history.ts, executor/memory/failure-memory.ts, and executor/learning/learning-store.ts generate long-term intelligence that IS NOT being persisted to server/memory/.

---

## Summary

| Category | Count | Action |
|---|---|---|
| LONG_TERM_MEMORY (migration targets) | 3 | Write-through persistence |
| RUNTIME_STATE (protect) | 14 | No change |
| CACHE (protect) | 3 | No change |
| DB_BACKED (protect) | 5 | No change |
| ALREADY_PERSISTENT (protect) | 2 | No change |
| ORPHANED | 1 | Safe delete |
| LEARNING_SYSTEM consumers (protect) | 6 | No change |
| Platform (server/memory/) | 62 files | Source of truth |
