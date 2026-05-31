# EXECUTOR MEMORY ARCHITECTURE REPORT
> Final Report — All Phases Complete
> Generated: 2026-05-31

---

## 1. Files Scanned

| File | Lines | Scanned |
|---|---|---|
| `server/agents/executor/memory/execution-history.ts` | 209 | YES |
| `server/agents/executor/memory/failure-memory.ts` | 192 | YES |
| `server/agents/executor/memory/working-memory.ts` | 162 | YES |
| `server/memory/execution-memory/execution-store.ts` | 76 | YES (central comparison) |
| `server/memory/bug-memory/bug-store.ts` | 91 | YES (central comparison) |
| `server/memory/bootstrap/memory-hydrator.ts` | 85 | YES (bootstrap wiring) |
| `server/memory/bootstrap/memory-loader.ts` | 190 | YES (bootstrap wiring) |
| `server/agents/coderx/memory/execution-history.ts` | ~80 | YES (duplicate check) |
| `server/agents/coderx/memory/working-memory.ts` | ~80 | YES (duplicate check) |

**Total server/memory files catalogued:** 62

---

## 2. Classification Results

| File | Classification | Evidence |
|---|---|---|
| `execution-history.ts` | `EXECUTION_MEMORY` + `LONG_TERM_MEMORY` (bridge) | Ring-buffer for sync reads; write-through to `memoryEngine` category `'execution'`; hydrate() at startup |
| `failure-memory.ts` | `BUG_MEMORY` + `LONG_TERM_MEMORY` (bridge) | Map-based real-time pattern detector; write-through to `memoryEngine` category `'bug'`; hydrate() at startup |
| `working-memory.ts` | `RUNTIME_STATE` + `TEMP_CONTEXT` | Zero persistence; zero memoryEngine calls; run-scoped; cleared at run teardown |

---

## 3. Duplicate Memory Analysis

| Executor File | Central Candidate | Schema Match | Purpose Match | Verdict |
|---|---|---|---|---|
| `execution-history.ts` | `execution-memory/execution-store.ts` | NO — different granularity (per-call vs per-run) | PARTIAL | NOT A DUPLICATE |
| `failure-memory.ts` | `bug-memory/bug-store.ts` | NO — different schema (signature+occurrences vs rootCause+fix) | PARTIAL | NOT A DUPLICATE |
| `working-memory.ts` | None found | N/A | N/A | NOT A DUPLICATE — no central equivalent |

**Key finding:** The executor memory files and the central memory stores are **complementary layers**, not duplicates. They operate at different granularities, serve different callers, and have different schemas. The write-through pattern deliberately bridges the two layers — executor writes sync, central persists async.

---

## 4. Consumers

| File | Direct Callers | Re-exports | Bootstrap | Total References |
|---|---|---|---|---|
| `execution-history.ts` | 10 | 2 | 2 | 14 |
| `failure-memory.ts` | 6 | 1 | 2 | 9 |
| `working-memory.ts` | 6 | 1 | 0 | 7 |

**Critical-path callers (sync, hot-path):**
- `executor-agent.ts` — uses all three on every tool dispatch
- `decision-engine.ts` — uses execution-history + failure-memory on every decision
- `recovery-engine.ts` — uses all three during recovery
- `coding-loop.ts` — uses working-memory on every coding iteration
- `step-runner.ts` — uses execution-history on every step

---

## 5. Migration Decisions

### execution-history.ts → **KEEP_LOCAL**

**Decision:** KEEP_LOCAL

**Evidence:**
1. 10 synchronous callers in the hot execution path — no async refactor is safe without touching all of them
2. Write-through already bridges this store to `server/memory/` — persistence is covered without migration
3. Central `ExecutionStore` has a different schema (per-run aggregate vs per-tool-call detail) — they serve different analytics layers and must remain separate
4. `hydrate()` + `memory-loader.ts` + `memory-hydrator.ts` already provide startup restoration — the long-term memory concern is fully addressed
5. Moving ownership to `server/memory/` would introduce async to all 10 callers, create circular dependency risk (memory bootstrap already imports from executor/index.ts), and provide zero functional gain

**Architecture is complete and correct as-is.**

---

### failure-memory.ts → **KEEP_LOCAL**

**Decision:** KEEP_LOCAL

**Evidence:**
1. 6 synchronous callers rely on `analyze()`, `isRetryStorm()`, `hasSeenFailure()` in real-time
2. Write-through already bridges to `server/memory/` with `category: 'bug'`
3. Central `BugStore` schema is orthogonal (rootCause + fix + resolved) — cannot absorb the signature-normalisation, storm detection, or `FailureAnalysis.recommendation` capabilities
4. `isRetryStorm()` (sliding 30s window) is runtime-only — has no equivalent in any central store and cannot be replaced by a persisted store
5. Hydration wiring already complete via `memory-hydrator.ts` / `memory-loader.ts`

**Architecture is complete and correct as-is.**

---

### working-memory.ts → **KEEP_LOCAL**

**Decision:** KEEP_LOCAL

**Evidence:**
1. Pure `RUNTIME_STATE` — run-scoped, intentionally ephemeral
2. No `memoryEngine` calls and no `hydrate()` — this is by design: working memory is the agent's live RAM, not a record
3. No central equivalent exists in `server/memory/` — there is no store for live Maps/Sets/browserState
4. Contains non-serialisable types (Set, Map) — cannot be stored in the central platform without lossful transformation
5. `clear(runId)` is called at run teardown — data is intentionally discarded
6. 6 callers need synchronous access to browser state, retry counts, and tool outputs during execution — async reads would stall the coding loop

**Migrating this store would be an architectural regression.**

---

## 6. Files Modified

**NONE.**

The audit found no evidence supporting migration, deletion, or merge for any of the three target files. All architecture decisions are KEEP_LOCAL. No code was changed.

---

## 7. Imports Updated

**NONE.** No import changes required.

---

## 8. Validation Results

### TypeScript Errors
No changes made → no new TypeScript errors introduced.

### Import Integrity
All 30 import references across 14 consumer files remain intact and unchanged.

### Circular Dependency Check
Existing dependency direction verified:
```
server/memory/bootstrap/ → server/agents/executor/index.ts → executor/memory/*.ts
```
This one-way dependency is correct. The bootstrap hydrators import from the executor, not vice versa. No circular risk.

### Runtime Errors
No code was modified → no new runtime errors possible.

### Duplicate Memory Ownership
Confirmed: **zero duplicate ownership**. Each store serves a distinct layer and purpose. Write-through is deliberate — not duplication.

---

## 9. Recommended Final Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  EXECUTOR MEMORY LAYER (server/agents/executor/memory/)         │
│                                                                 │
│  ┌─────────────────────────┐  ┌──────────────────────────────┐ │
│  │  execution-history.ts   │  │  failure-memory.ts           │ │
│  │  ─────────────────────  │  │  ───────────────────────     │ │
│  │  Classification:        │  │  Classification:             │ │
│  │  EXECUTION_MEMORY       │  │  BUG_MEMORY                  │ │
│  │                         │  │                              │ │
│  │  Ring-buffer (200 max)  │  │  Map<signature, pattern>     │ │
│  │  Sync read/write        │  │  Sync read/write             │ │
│  │  Write-through →        │  │  Write-through →             │ │
│  │  memoryEngine           │  │  memoryEngine                │ │
│  │  ← Hydrate on boot      │  │  ← Hydrate on boot           │ │
│  └─────────────────────────┘  └──────────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  working-memory.ts                                      │   │
│  │  ──────────────────────────────────────────────────     │   │
│  │  Classification: RUNTIME_STATE + TEMP_CONTEXT           │   │
│  │                                                         │   │
│  │  Map<runId, WorkingMemorySlot>                          │   │
│  │  Ephemeral — no persistence, no hydration               │   │
│  │  Contains: browserState, toolOutputs, retryCounts,      │   │
│  │            modifiedFiles, snapshot/restore              │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │ write-through (fire-and-forget)         ▲
         │                                         │ hydrate() on boot
         ▼                                         │
┌──────────────────────────────────────────────────────────────────┐
│  CENTRAL MEMORY PLATFORM (server/memory/)                        │
│                                                                  │
│  execution-memory/execution-store.ts  ← per-run aggregates      │
│  bug-memory/bug-store.ts              ← structured bug records   │
│  bootstrap/memory-loader.ts           ← reads platform entries   │
│  bootstrap/memory-hydrator.ts         ← injects into executor    │
│                                                                  │
│  (+ 58 other files: learning, decision, knowledge-graph, etc.)   │
└──────────────────────────────────────────────────────────────────┘
```

### Architecture Principles Confirmed

1. **Layered design is correct.** Runtime hot-path (executor/memory) is synchronous. Persistence (server/memory) is async. They are bridged by write-through + hydration, not merged.

2. **Write-through is not duplication.** It is the designed mechanism for giving ephemeral in-process stores durability without async callers.

3. **Hydration is complete.** Both execution-history and failure-memory already have full startup restoration via memory-loader + memory-hydrator.

4. **working-memory is intentionally ephemeral.** It is the executor's live RAM. Persisting it would be wrong by design.

5. **CoderX memory files are independent agents.** They use different schemas for different concerns and are not duplicates of executor memory.

---

## Success Criteria — Final Check

| Criterion | Status |
|---|---|
| Every executor memory file is classified | ✅ ALL 3 CLASSIFIED |
| No guessing | ✅ EVERY DECISION BACKED BY CODE EVIDENCE |
| No blind deletion | ✅ NOTHING DELETED |
| No blind migration | ✅ NOTHING MIGRATED |
| Evidence required before any change | ✅ 7 FILES READ, 30 REFERENCES TRACED |
| KEEP / MIGRATE / MERGE / DELETE decision for every file | ✅ ALL 3 → KEEP_LOCAL |
