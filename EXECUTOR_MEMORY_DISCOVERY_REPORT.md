# EXECUTOR MEMORY DISCOVERY REPORT
> Phase 1 — Deep Scan
> Generated: 2026-05-31

---

## FILE 1 — execution-history.ts

**File Path:** `server/agents/executor/memory/execution-history.ts`

**Purpose:**
Cross-run execution intelligence. Maintains a bounded in-process ring-buffer (MAX_RUNS = 200) of per-tool-call outcomes across the executor's lifetime. Enables learning, recovery, and decision subsystems to query what happened in prior tool invocations — synchronously, without async overhead. Uses a write-through pattern to also persist entries to the central memory platform.

**Classes:** None (module-pattern singleton)

**Functions / Methods:**
| Name | Signature | Role |
|---|---|---|
| `_classifyError` | `(errorText: string) → string` | Normalises error text into one of 8 categories (TIMEOUT, PERMISSION, NOT_FOUND, SYNTAX, NETWORK, TYPE_ERROR, MODULE, VALIDATION, UNKNOWN) |
| `recordExecution` | `(params) → ExecutionHistoryEntry` | Core write path — appends to ring-buffer, fires write-through to memoryEngine |
| `recordFailure` | `(params) → ExecutionHistoryEntry` | Convenience wrapper over recordExecution with outcome='failure' |
| `recordSuccess` | `(params) → ExecutionHistoryEntry` | Convenience wrapper over recordExecution with outcome='success' |
| `findSimilarFailure` | `(toolName, errorText) → entry \| undefined` | Reverse-scan for a prior failure matching same tool + error class |
| `getByRun` | `(runId) → entries[]` | Return all entries for a specific run, newest first |
| `getExecutionHistory` | `(limit?) → entries[]` | Return last N entries, newest first |
| `hasPriorFix` | `(toolName, errorClass) → string \| undefined` | Scan for a successful fix ever applied to this tool/errorClass |
| `summary` | `() → ExecutionHistorySummary` | Aggregate stats: success rate, avg retries, top failure classes, top success tools |
| `hydrate` | `(entries[]) → number` | Restore from persisted data at startup. Idempotent. |
| `reset` | `() → void` | Clear the buffer (used in tests) |
| `size` | `() → number` | Current buffer length |

**Exports:**
- `HistoryOutcome` (type: `'success' | 'failure' | 'partial'`)
- `ExecutionHistoryEntry` (interface)
- `ExecutionHistorySummary` (interface)
- `executionHistory` (singleton object — all methods above)

**Dependencies:**
- `TaskKind` from `../types/executor.types.ts`
- `memoryEngine` from `../../../memory/index.ts` (write-through only — fire-and-forget)

**Internal State:**
- `_history: ExecutionHistoryEntry[]` — in-process ring-buffer, max 200 entries
- `_seq: number` — monotonic ID counter

**Write-Through Behaviour:**
On every `recordExecution()` call, a fire-and-forget `memoryEngine.store()` is issued with:
- `category: 'execution'`
- `meta.agentSource: 'executor-execution-history'`
This means data is dual-written: in-process cache AND central platform.

**Consumers (external):**
- `server/agents/executor/executor-agent.ts`
- `server/agents/executor/learning/failure-predictor.ts`
- `server/agents/executor/learning/pattern-learner.ts`
- `server/agents/executor/reasoning/decision-engine.ts`
- `server/agents/executor/recovery/recovery-engine.ts`
- `server/agents/executor/recovery/rollback-manager.ts`
- `server/agents/coderx/coderx-agent.ts`
- `server/agents/coderx/execution/retry-manager.ts`
- `server/agents/coderx/execution/step-runner.ts`
- `server/agents/coderx/execution/task-executor.ts`
- `server/agents/executor/index.ts` (re-export)
- `server/agents/coderx/index.ts` (re-export from executor/memory)
- `server/memory/bootstrap/memory-hydrator.ts` (calls `hydrate()`)
- `server/memory/bootstrap/memory-loader.ts` (loads entries for hydration)

---

## FILE 2 — failure-memory.ts

**File Path:** `server/agents/executor/memory/failure-memory.ts`

**Purpose:**
Failure pattern intelligence across runs. Maintains a Map keyed by normalised error signature (`kind::toolName::normalised_error`). Detects repeated/chronic failures (threshold: 3+ occurrences), retry storms (10+ failures within 30s), and categorises failure types. Provides real-time pattern detection used synchronously by the decision engine and recovery system. Uses write-through to persist patterns to the central memory platform.

**Classes:** None (module-pattern singleton)

**Functions / Methods:**
| Name | Signature | Role |
|---|---|---|
| `_normalise` | `(error: string) → string` | Strip run-specific tokens; truncate to 120 chars — produces stable signature base |
| `_makeSignature` | `(toolName, kind, error) → string` | Compose `kind::toolName::normalised` as dedup key |
| `_categorise` | `(error, kind) → FailureCategory` | Classify into: browser-instability, ts-error, validation-failure, infinite-loop, dead-execution, unknown |
| `recordFailurePattern` | `(runId, toolName, kind, error) → FailurePattern` | Upsert pattern, increment occurrences, fire write-through |
| `hasSeenFailure` | `(toolName, kind, error) → boolean` | O(1) existence check |
| `getFailureFrequency` | `(toolName, kind, error) → number` | Occurrence count for a specific signature |
| `analyze` | `(runId, toolName, kind, error) → FailureAnalysis` | Record + categorise + generate recommendation. Primary consumer-facing API |
| `isRetryStorm` | `() → boolean` | True if 10+ failures in last 30 seconds |
| `chroniclePatterns` | `() → FailurePattern[]` | All patterns with occurrences ≥ 3 |
| `allPatterns` | `() → FailurePattern[]` | All known patterns |
| `hydrate` | `(patterns[]) → number` | Restore from persisted data. Idempotent. |
| `reset` | `() → void` | Clear all patterns |
| `size` | `() → number` | Pattern count |

**Exports:**
- `FailurePattern` (interface)
- `FailureCategory` (union type)
- `FailureAnalysis` (interface)
- `failureMemory` (singleton)

**Dependencies:**
- `TaskKind` from `../types/executor.types.ts`
- `memoryEngine` from `../../../memory/index.ts` (write-through only — fire-and-forget)

**Internal State:**
- `_patterns: Map<string, FailurePattern>` — signature → pattern, unbounded
- `_recentTimestamps: number[]` — raw timestamp log for storm detection

**Write-Through Behaviour:**
On every `recordFailurePattern()` call (new or update), a fire-and-forget `memoryEngine.store()` is issued with:
- `category: 'bug'`
- `meta.agentSource: 'executor-failure-memory'`
- `meta.signature: sig`

**Consumers (external):**
- `server/agents/executor/executor-agent.ts`
- `server/agents/executor/learning/failure-predictor.ts`
- `server/agents/executor/learning/pattern-learner.ts`
- `server/agents/executor/reasoning/decision-engine.ts`
- `server/agents/executor/recovery/recovery-engine.ts`
- `server/agents/executor/index.ts` (re-export)
- `server/memory/bootstrap/memory-hydrator.ts` (calls `hydrate()`)
- `server/memory/bootstrap/memory-loader.ts` (loads patterns for hydration)

---

## FILE 3 — working-memory.ts

**File Path:** `server/agents/executor/memory/working-memory.ts`

**Purpose:**
Run-scoped live memory for the executor agent. Pure in-process, per-runId transient state. Tracks everything active within a single execution run: current workflow/task/step pointers, modified files, tool outputs, retry counts, validation results, browser state, and execution context. Also provides snapshot/restore for rollback support. Strictly no cross-run state — each runId is fully isolated.

**Classes:** None (module-pattern singleton)

**Functions / Methods:**
| Name | Signature | Role |
|---|---|---|
| `init` | `(runId) → WorkingMemorySlot` | Create a fresh slot. Idempotent. |
| `get` | `(runId) → slot \| undefined` | Read slot for a run |
| `update` | `(runId, patch) → void` | Partial merge: scalars replaced, Maps/Sets deep-merged |
| `set` | `(runId, key, value) → void` | Direct key assignment on a slot |
| `snapshot` | `(runId) → void` | Push lightweight scalar snapshot onto the slot's history (max 10) |
| `restore` | `(runId) → boolean` | Pop last snapshot — restores scalar fields |
| `clear` | `(runId) → void` | Delete a run's slot entirely |
| `incrementRetry` | `(runId, key) → number` | Atomically increment a retry counter, return new count |
| `recordToolOutput` | `(runId, toolName, output) → void` | Store the last output for a tool |
| `recordFileModified` | `(runId, filePath) → void` | Mark a file as modified within this run |
| `allRunIds` | `() → string[]` | List all active run IDs |
| `size` | `() → number` | Number of active slots |

**Exports:**
- `BrowserMemoryState` (interface)
- `ValidationMemoryState` (interface)
- `WorkingMemorySlot` (interface)
- `workingMemory` (singleton)

**Dependencies:**
- None external. Zero imports.

**Internal State:**
- `_store: Map<string, WorkingMemorySlot>` — runId → slot
- `MAX_SNAPSHOT_HISTORY = 10`

**Write-Through Behaviour:** NONE. No memoryEngine calls. No persistence. Fully ephemeral.

**Hydrate:** NONE. No `hydrate()` method. Data does not survive process restart.

**Consumers (external):**
- `server/agents/executor/recovery/rollback-manager.ts`
- `server/agents/executor/recovery/self-healing-loop.ts`
- `server/agents/executor/telemetry/runtime-visualizer.ts`
- `server/agents/coderx/coderx-agent.ts`
- `server/agents/coderx/execution/coding-loop.ts`
- `server/agents/coderx/execution/task-executor.ts`
- `server/agents/executor/index.ts` (implicit — re-exports only types)
