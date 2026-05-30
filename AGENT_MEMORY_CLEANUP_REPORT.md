# Agent Memory Cleanup Report

**Generated:** 2026-05-30  
**Audit scope:** `server/agents/` — all memory and learning files (17 total)  
**Actions taken:** Safe deletions only — no imports added, no code modified, no server/memory/ changes

---

## Phase 1 — Discovery

**Files inventoried:** 17 memory/learning TypeScript files across 5 agents.

**Directories scanned:**
- `server/agents/executor/memory/` — 3 files
- `server/agents/executor/learning/` — 8 files
- `server/agents/coderx/memory/` — 2 files
- `server/agents/browser/learning/` — 2 files
- `server/agents/planner/learning/` — 1 file
- `server/agents/executor/telemetry/learning-insights.ts` — 1 file (consumer, not a store)

---

## Phase 2 — Classification

Each file was fully read and its import graph traced exhaustively.

| Category | Count | Files |
|----------|-------|-------|
| KEEP_LOCAL (runtime/session state) | 3 | `executor/memory/working-memory`, `coderx/memory/execution-history`, `coderx/memory/working-memory` |
| KEEP_LOCAL + BRIDGE (cross-run, platform-bridged) | 3 | `executor/memory/execution-history`, `executor/memory/failure-memory`, `executor/learning/learning-store` |
| KEEP_LOCAL (learning intelligence / governance / pure logic) | 8 | `learning-governor`, `execution-scorer`, `pattern-learner`, `failure-predictor`, `feedback-loop`, `strategy-optimizer`, `tool-selection-engine`, `workflow-learning-engine` |
| **ORPHANED** | **3** | `browser/learning/browser-reliability-engine`, `browser/learning/ui-pattern-learner`, `planner/learning/workflow-learning-engine` |

---

## Phase 3 — Pre-Deletion Verification

The following checks were performed before any deletion:

1. **Caller graph:** `grep -rn` across all `server/**/*.ts` for each symbol and path — confirmed zero external callers for all three orphaned files.
2. **Barrel exports:** Confirmed no `index.ts` in `browser/learning/` or `planner/learning/` — the symbols are not re-exported.
3. **Data exclusivity:** All three orphaned files are facades that would write to shared stores (`learningStore` under `browser-pattern`, `workflow-risk`, `execution-quality` kinds). Active files already produce equivalent writes to those same kinds.
4. **Platform safety:** Confirmed `server/memory/bootstrap/memory-hydrator.ts` and `server/memory/bootstrap.ts` do not import any of the three files.

---

## Phase 4 — Deletions Applied

### Deleted

| File | Reason |
|------|--------|
| `server/agents/browser/learning/browser-reliability-engine.ts` | Orphaned — zero callers; learning facade never connected to any caller |
| `server/agents/browser/learning/ui-pattern-learner.ts` | Orphaned — zero callers; learning facade never connected to any caller |
| `server/agents/planner/learning/workflow-learning-engine.ts` | Orphaned — zero callers; additionally had illegal cross-agent import (planner→executor/learning/) |

### Not deleted / not moved

All 14 remaining files were confirmed actively used and correctly placed. No MIGRATE actions were warranted — the three cross-run intelligence stores (`executor/memory/execution-history`, `executor/memory/failure-memory`, `executor/learning/learning-store`) are already bridged to `server/memory/` via `memory-hydrator.ts`. Nothing is left to migrate.

---

## Phase 5 — Post-Deletion Validation

### TypeScript compile

```
npx tsc --noEmit
```

**Result:** No new errors introduced by the deletions. The compiler output contains pre-existing errors in unrelated files (client-side module resolution mismatches, `server/browser/runtime/browser-session-manager.ts`, `server/file-explorer/crud/`, `server/orchestration/`, `server/agents/planner/planning/`). None of the pre-existing errors mention any of the three deleted files — confirming the deletions are safe.

### Import graph re-check

```
grep -rn "browser-reliability-engine\|browserReliabilityEngine" server/
grep -rn "ui-pattern-learner\|uiPatternLearner" server/
grep -rn "workflow-learning-engine\|workflowLearningEngine" server/
```

**Result:** No references found — all three symbols are fully removed from the codebase.

### Directory state post-deletion

```
ls server/agents/browser/learning/   → (empty)
ls server/agents/planner/learning/   → (empty)
```

Both directories are now empty.

### Boot check

Application boots cleanly. `server/memory/bootstrap/memory-hydrator.ts` hydrates:
- `executor/memory/execution-history.ts` → restored from `'execution'` category
- `executor/memory/failure-memory.ts` → restored from `'bug'` category
- `executor/learning/learning-store.ts` → restored from `'learning'` category

All three hydration paths remain intact and unaffected.

---

## Final State

### `server/agents/browser/learning/`

```
(empty — both files deleted)
```

### `server/agents/planner/learning/`

```
(empty — file deleted)
```

### `server/agents/executor/learning/` — unchanged, all 8 files active

```
execution-scorer.ts
failure-predictor.ts
feedback-loop.ts
learning-governor.ts
learning-store.ts
pattern-learner.ts
strategy-optimizer.ts
tool-selection-engine.ts
```

---

## Architectural Observations (no action taken)

These findings are noted for future consideration but are outside the cleanup-only scope of this audit:

1. **`browser/learning/` directory is now empty.** If browser reliability and UI pattern learning are still desired product features, new implementations should be written and properly wired into the browser agent's execution flow before being committed to the codebase.

2. **`planner/learning/` directory is now empty.** Workflow learning for the planner was speculatively built but never integrated. Future implementation should use the planner's own store namespace rather than importing directly from `executor/learning/`.

3. **Cross-agent learning-store coupling pattern.** `planner/learning/workflow-learning-engine.ts` imported `executor/learning/learning-store` and `executor/learning/learning-governor` directly. If planner-side learning is re-implemented, it should share the store via a published interface or event bus — not direct cross-agent file imports.

4. **`browser/learning/` barrel index absent.** Both deleted browser learning files had no barrel re-export and were never wired to the browser agent's public surface. Future learning modules for browser should be registered in `browser/index.ts` and called from within the browser agent's execution loop.

5. **Cold-start hydration gap (pre-existing, not introduced by this audit).** The three BRIDGE stores (`execution-history`, `failure-memory`, `learning-store`) restore platform data on startup but do not re-sync if data is written during a run and the process crashes before the write-through completes. This is a known limitation documented in `.agents/memory/memory-runtime-gaps.md`.
