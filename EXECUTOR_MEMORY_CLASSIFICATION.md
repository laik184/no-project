# EXECUTOR MEMORY CLASSIFICATION REPORT
> Phase 2 — Memory Classification
> Generated: 2026-05-31

---

## Classification Summary

| File | Primary Class | Secondary Class | Decision |
|---|---|---|---|
| `execution-history.ts` | `EXECUTION_MEMORY` | `LONG_TERM_MEMORY` (via write-through) | KEEP_LOCAL |
| `failure-memory.ts` | `BUG_MEMORY` | `LONG_TERM_MEMORY` (via write-through) | KEEP_LOCAL |
| `working-memory.ts` | `RUNTIME_STATE` | `TEMP_CONTEXT` | KEEP_LOCAL |

---

## FILE 1 — execution-history.ts

### Classification: `EXECUTION_MEMORY` + `LONG_TERM_MEMORY` (bridge)

### Evidence

**EXECUTION_MEMORY:**
- Tracks per-tool-call outcomes: toolName, kind, outcome, retries, durationMs, errorClass
- Ring-buffer bounded at 200 entries — designed to hold recent execution intelligence, not unlimited archive
- Queried synchronously by 10+ callers in the hot execution path (recovery, learning, reasoning)
- Has `findSimilarFailure()` and `hasPriorFix()` — real-time decision support APIs
- Sequence counter (`_seq`) advances monotonically per process lifetime

**LONG_TERM_MEMORY (bridge — NOT primary):**
- Every write fires `memoryEngine.store({ category: 'execution', agentSource: 'executor-execution-history' })`
- Has `hydrate()` method, called by `server/memory/bootstrap/memory-hydrator.ts` at startup
- `server/memory/bootstrap/memory-loader.ts:loadExecutionHistory()` reads it back from the platform on boot
- Data survives process restarts via this round-trip

**Why NOT classified as pure LONG_TERM_MEMORY:**
- The in-process buffer is the primary operational artifact — all callers read from it synchronously
- The write-through is a side-channel for durability, not the primary storage contract
- The central `ExecutionStore` (`server/memory/execution-memory/execution-store.ts`) exists as a separate entity with a different schema — they are NOT the same store
- 18+ sync callers cannot be converted to async without a full architectural refactor

### Classification Verdict: `EXECUTION_MEMORY` — is also a `LONG_TERM_MEMORY` bridge via intentional write-through. Architecture is correct and already complete.

---

## FILE 2 — failure-memory.ts

### Classification: `BUG_MEMORY` + `LONG_TERM_MEMORY` (bridge)

### Evidence

**BUG_MEMORY:**
- Core capability: real-time failure pattern detection and normalisation
- Signature-based deduplication (`kind::toolName::normalised_error`) — unique to this store
- `_categorise()` classifies live errors into 7 categories for immediate routing decisions
- `isRetryStorm()` — 30-second sliding window storm detection — pure runtime intelligence
- `chroniclePatterns()` — identifies chronic failures (3+ occurrences) for escalation
- `analyze()` returns `FailureAnalysis.recommendation` — used synchronously by decision-engine.ts

**LONG_TERM_MEMORY (bridge — NOT primary):**
- Every pattern write/update fires `memoryEngine.store({ category: 'bug', agentSource: 'executor-failure-memory' })`
- Has `hydrate()` method, called by `server/memory/bootstrap/memory-hydrator.ts`
- `server/memory/bootstrap/memory-loader.ts:loadFailurePatterns()` restores Map from platform on boot
- Pattern counts (occurrences, firstSeen, lastSeen) survive restarts

**Why NOT classified as pure LONG_TERM_MEMORY:**
- The Map is the primary operational artifact; the central BugStore has a completely different schema
- Central `BugStore` stores structured resolved bugs (errorType, stackTrace, rootCause, fix, resolved)
- Executor's failure-memory stores normalised pattern signatures for real-time detection — orthogonal concern
- `isRetryStorm()` is runtime-only; has no equivalent in server/memory/

### Classification Verdict: `BUG_MEMORY` — is also a `LONG_TERM_MEMORY` bridge via intentional write-through. Architecture is correct and already complete.

---

## FILE 3 — working-memory.ts

### Classification: `RUNTIME_STATE` + `TEMP_CONTEXT`

### Evidence

**RUNTIME_STATE:**
- Strictly per-runId — slots are isolated and meaningless outside a run
- Tracks: currentWorkflow, currentTaskId, currentStepId — live pointers to the running orchestration
- `browserState` (sessionId, lastUrl, screenshotB64, domSnapshot, isStable) — live browser session handle
- `executionContext: Record<string, unknown>` — arbitrary runtime scratch space
- `clear(runId)` is called at run teardown — data intentionally discarded

**TEMP_CONTEXT:**
- `toolOutputs: Map<string, unknown>` — last output of each tool, only valid within a run
- `retryCounts: Map<string, number>` — per-tool retry state for current run only
- `validationResults: Map<string, ValidationMemoryState>` — validation pass/fail within run
- `snapshot()` / `restore()` — rollback support within a run, no cross-run meaning
- `modifiedFiles: Set<string>` — files touched in this run, for diff generation

**Why NOT LONG_TERM_MEMORY:**
- Zero `memoryEngine` calls — no write-through, no persistence
- No `hydrate()` method — no startup restoration
- Data in Maps and Sets is not serialisable across restarts in any supported path
- Semantically: working memory is the agent's "RAM" — it is correct for it to be transient

**Why NOT CACHE:**
- Not storing computed results for reuse — storing live execution pointers
- Cache implies the data could be re-derived; working memory is the source of truth during a run

### Classification Verdict: `RUNTIME_STATE` — correct placement in executor/memory/. No migration warranted.
