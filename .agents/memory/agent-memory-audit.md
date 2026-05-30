---
name: Agent memory ownership audit
description: Results of the full server/agents/ memory/learning file audit — classifications, deletions, and architectural findings.
---

# Agent Memory Ownership Audit

**Why:** Needed to identify orphaned memory files, confirm platform-bridge completeness, and verify no misplaced long-term stores remain in agent directories.

## Classification (17 files audited)

### KEEP_LOCAL + BRIDGE (platform-bridged, synchronous hot-path)
- `executor/memory/execution-history.ts` — cross-run ring-buffer; hydrated from 'execution' category on startup
- `executor/memory/failure-memory.ts` — cross-run failure patterns; hydrated from 'bug' category on startup
- `executor/learning/learning-store.ts` — learning intelligence store; hydrated from 'learning' category on startup

### KEEP_LOCAL (runtime/session state — no persistence desired)
- `executor/memory/working-memory.ts` — live run state (Map/Set), per-run, no persistence
- `coderx/memory/execution-history.ts` — per-run step snapshots (clearRun()), no cross-run persistence
- `coderx/memory/working-memory.ts` — per-run scratchpad, no persistence

### KEEP_LOCAL (learning intelligence / governance / pure logic)
- `executor/learning/learning-governor.ts` — rate-limiting governance; 8 callers across 4 agents
- `executor/learning/execution-scorer.ts` — pure scoring math, no I/O
- `executor/learning/pattern-learner.ts` — reads history+failure-memory, writes to learning-store
- `executor/learning/failure-predictor.ts` — pre-execution risk assessment
- `executor/learning/feedback-loop.ts` — post-run learning cycle orchestrator
- `executor/learning/strategy-optimizer.ts` — strategy weight learner
- `executor/learning/tool-selection-engine.ts` — adaptive tool confidence
- `executor/telemetry/learning-insights.ts` — telemetry consumer (not a store)

### DELETED (orphaned — zero callers)
- `browser/learning/browser-reliability-engine.ts` — facade, never imported anywhere
- `browser/learning/ui-pattern-learner.ts` — facade, never imported anywhere
- `planner/learning/workflow-learning-engine.ts` — facade + illegal cross-agent import (planner→executor/learning/), never imported anywhere

## Key findings

**No MIGRATE candidates exist.** The three cross-run stores are already bridged. Everything else is correctly ephemeral or pure logic.

**Synchronous read constraint is non-negotiable.** `executor/learning/learning-store.ts` has 13 callers across 5 agents performing synchronous reads. Cannot be replaced with async platform calls without refactoring all 13 callers.

**Cross-agent coupling anti-pattern.** `planner/learning/workflow-learning-engine.ts` imported directly from `executor/learning/`. If planner-side learning is re-implemented, it must go through a shared interface, not a direct file import.

**`browser/learning/` and `planner/learning/` are now empty directories.** They were speculative implementations never wired into agent execution flows.

## How to apply
- When adding a new learning or memory file to any agent: check whether it has callers before committing — use grep for the exported symbol.
- When adding planner-side learning: do NOT import from `executor/learning/` directly; use a shared event or published interface.
- The three BRIDGE stores (execution-history, failure-memory, learning-store) are the only agent-owned files that write to server/memory/. All other agent files are ephemeral. This boundary should be maintained.
