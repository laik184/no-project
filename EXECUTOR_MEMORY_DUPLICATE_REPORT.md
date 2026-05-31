# EXECUTOR MEMORY DUPLICATE REPORT
> Phase 3 — Central Memory Comparison
> Generated: 2026-05-31

---

## Comparison Matrix

| Executor Memory | Central Equivalent | Schema Match | Purpose Match | Is Duplicate? |
|---|---|---|---|---|
| `execution-history.ts` | `server/memory/execution-memory/execution-store.ts` | NO | PARTIAL | NO |
| `failure-memory.ts` | `server/memory/bug-memory/bug-store.ts` | NO | PARTIAL | NO |
| `working-memory.ts` | _(none)_ | N/A | N/A | NO |

---

## Detailed Comparison

### 1. execution-history.ts vs ExecutionStore

**Executor Store — Schema:**
```
ExecutionHistoryEntry {
  id, runId, taskId, toolName, kind, outcome,
  errorText, retries, durationMs, errorClass, fixApplied, ts
}
```
Granularity: **per tool call** (many per run)

**Central Store — Schema (`execution-store.ts`):**
```
CreateExecutionInput {
  runId, goal, agentType, toolsUsed[], durationMs,
  success, errorSummary?
}
```
Granularity: **per agent run** (one per run)

**Functional Difference:**
| Capability | Executor (execution-history) | Central (ExecutionStore) |
|---|---|---|
| Per-tool-call tracking | YES | NO |
| Error class normalisation | YES | NO |
| `findSimilarFailure()` | YES | NO |
| `hasPriorFix()` | YES | NO |
| Retry count per call | YES | NO |
| Agent-level success flag | NO | YES |
| Goal / agentType metadata | NO | YES |
| Tools used (array) | NO | YES |
| Async API | NO (sync) | YES (async) |
| Hydration on boot | YES | NO |

**Relationship:** The executor store is the fine-grained per-call telemetry layer. The central store is the per-run summary layer. They operate at different granularities and are **complementary, not duplicates**. The executor store writes to `memoryEngine` with `category: 'execution'`; the central `ExecutionStore` reads from the same engine via `BaseMemoryStore`. They share the same backing store but with different schemas and agentSource filters.

**Duplicate verdict: NO**

---

### 2. failure-memory.ts vs BugStore

**Executor Store — Schema:**
```
FailurePattern {
  signature, toolName, kind, errorSnippet,
  occurrences, firstSeen, lastSeen, runIds[]
}
```
Core concept: **normalised error signature with frequency**

**Central Store — Schema (`bug-store.ts`):**
```
CreateBugInput {
  errorType, stackTrace?, rootCause, fix
}
BugEntry adds: recurrence, resolved
```
Core concept: **structured bug record with root cause and fix**

**Functional Difference:**
| Capability | Executor (failure-memory) | Central (BugStore) |
|---|---|---|
| Signature normalisation | YES | NO |
| Retry storm detection | YES | NO |
| Chronic pattern detection (3+) | YES | NO |
| `analyze()` + recommendation | YES | NO |
| Category routing (7 types) | YES | NO |
| Root cause field | NO | YES |
| Fix field | NO | YES |
| Resolved/unresolved tracking | NO | YES |
| `findSimilar()` by errorType | NO | YES |
| `topRecurring()` query | NO | YES |
| Real-time pattern detection | YES (sync) | NO (async) |

**Relationship:** The executor failure-memory is a **real-time runtime pattern detector** — it catches errors as they happen, normalises them, and makes instant routing decisions. The central BugStore is a **knowledge base of known bugs** — structured records of past bugs with their diagnosed root causes and applied fixes. These are orthogonal capabilities serving different concerns. Both write/read from the backing `memoryEngine` with `category: 'bug'` but with different `agentSource` filters.

**Duplicate verdict: NO**

---

### 3. working-memory.ts vs Central Memory

**Central memory scan — no equivalent found.**

Searched all 62 files in `server/memory/` for:
- Run-scoped transient state management: NOT FOUND
- Browser session state tracking: NOT FOUND
- Live retry counter maps: NOT FOUND
- Snapshot/restore within a run: NOT FOUND

The closest candidate is `server/memory/checkpoints/` but that stores full project snapshots (file diffs, agent state at checkpoint boundaries) — not live intra-run working state. Checkpoints are explicit user-visible save points; working-memory is the agent's moment-to-moment RAM.

**Duplicate verdict: NO — no central equivalent exists, and none should.**

---

## Cross-Agent Duplicate Check

During the consumer scan, two files were found in `server/agents/coderx/memory/`:
- `server/agents/coderx/memory/execution-history.ts`
- `server/agents/coderx/memory/working-memory.ts`

**Are these duplicates of the executor files?**

| | CoderX execution-history | Executor execution-history |
|---|---|---|
| Schema | `ExecutionSnapshot` (CodingTaskOutput, CodingTaskKind) | `ExecutionHistoryEntry` (TaskKind, outcome, errorClass) |
| Write-through | NO | YES |
| Hydrate | NO | YES |
| Purpose | Per-step snapshot for CoderX coding runs | Cross-run tool-call history for Executor |

| | CoderX working-memory | Executor working-memory |
|---|---|---|
| Schema | `WorkingMemoryEntry` (CodingTaskAnalysis, CodingPlan) | `WorkingMemorySlot` (browserState, toolOutputs, retryCounts) |
| Write-through | NO | NO |
| Purpose | CoderX reasoning context (analysis, plan, scratchpad) | Executor runtime state (browser, files, retries) |

**CoderX files are NOT duplicates** — they use different types, different schemas, and serve the CoderX agent's distinct coding-loop concerns. The similar naming is conventional (both agents have working memory), not duplication.

**Cross-agent duplicate verdict: NO**

---

## Summary

No true duplicates exist anywhere in the executor memory system. The architecture is correctly layered:

```
Layer 1 (Runtime):     executor/memory/working-memory.ts    — ephemeral, in-process only
Layer 2 (Hot Cache):   executor/memory/execution-history.ts  — sync in-process + write-through
                       executor/memory/failure-memory.ts     — sync in-process + write-through
Layer 3 (Persistence): server/memory/ (execution-store, bug-store, etc.) — async durable
Layer 4 (Bootstrap):   server/memory/bootstrap/ — loads Layer 3 → hydrates Layer 2 at startup
```
