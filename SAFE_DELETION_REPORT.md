# Safe Deletion Report

**Generated:** 2026-05-30  
**Scope:** `server/agents/` memory and learning files  
**Basis:** AGENT_MEMORY_DEPENDENCY_REPORT.md — full import graph trace  

---

## Files Approved for Deletion

Three files are confirmed orphaned (exported singleton, zero callers anywhere in the codebase). Deleting them removes dead code with zero runtime impact.

---

### 1. `server/agents/browser/learning/browser-reliability-engine.ts`

**Why safe:**
- Exports `browserReliabilityEngine` singleton.
- Exhaustive grep for `browserReliabilityEngine` and `browser-reliability-engine` across all `server/**/*.ts` found **zero callers** outside this file itself.
- The file is a facade that delegates to `executor/learning/learning-store.ts` and `executor/learning/learning-governor.ts`. Deleting it does not touch either of those files.
- No re-export barrel (`browser/learning/index.ts`) exists — the symbol is not in any public API surface.

**Runtime impact:** None. The `browserReliabilityEngine` object is never constructed or called.  
**Data impact:** None. No data is stored exclusively by this file; it would have written to the shared `learningStore` under `browser-pattern` kind, but it never runs.

---

### 2. `server/agents/browser/learning/ui-pattern-learner.ts`

**Why safe:**
- Exports `uiPatternLearner` singleton.
- Exhaustive grep for `uiPatternLearner` and `ui-pattern-learner` across all `server/**/*.ts` found **zero callers** outside this file itself.
- Same facade pattern as above — delegates all storage to `executor/learning/learning-store.ts` and `executor/learning/learning-governor.ts`.
- No barrel re-export.

**Runtime impact:** None.  
**Data impact:** None.

---

### 3. `server/agents/planner/learning/workflow-learning-engine.ts`

**Why safe:**
- Exports `workflowLearningEngine` singleton.
- Exhaustive grep for `workflowLearningEngine` and `workflow-learning-engine` across all `server/**/*.ts` found **zero callers** outside this file itself.
- Additionally carries a structural problem: it imports `../../executor/learning/learning-store.ts` and `../../executor/learning/learning-governor.ts` — a planner→executor direct coupling that bypasses agent boundaries. Since it is orphaned, this coupling has no runtime effect, but it is a design smell that confirms this file was written speculatively and never integrated.

**Runtime impact:** None.  
**Data impact:** None. No data is stored exclusively by this file; any `workflow-risk` and `execution-quality` writes it would have made are also produced by `executor/learning/pattern-learner.ts` and `executor/learning/strategy-optimizer.ts` (which are active).

---

## Files NOT Approved for Deletion

All 14 remaining memory/learning files in `server/agents/` are actively called. See AGENT_MEMORY_DEPENDENCY_REPORT.md for the full caller graph.

---

## Deletion Checklist

| File | Zero callers confirmed | Delegates only (no exclusive data) | No barrel re-export | Approved |
|------|----------------------|-------------------------------------|---------------------|---------|
| `browser/learning/browser-reliability-engine.ts` | ✓ | ✓ | ✓ | ✓ |
| `browser/learning/ui-pattern-learner.ts` | ✓ | ✓ | ✓ | ✓ |
| `planner/learning/workflow-learning-engine.ts` | ✓ | ✓ (+ cross-agent coupling flag) | ✓ | ✓ |

---

## Post-Deletion Validation Plan

After deletion:

1. **TypeScript compile check** — `npx tsc --noEmit` should report zero new errors.
2. **Import graph re-check** — grep for the three deleted symbols confirms no remaining references.
3. **Boot check** — `server/memory/bootstrap/memory-hydrator.ts` and `server/memory/bootstrap.ts` do not import any of the three deleted files (confirmed pre-deletion).
4. **Learning subsystem integrity** — `executor/learning/learning-store.ts` and `executor/learning/learning-governor.ts` are unmodified; all active callers remain intact.
