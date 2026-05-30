# MEMORY_DEEP_IMPORT_REPORT.md

**Report Date:** 2025-05-30  
**Scope:** All `server/**/*.ts` files  
**Pattern Scanned:** `from '*/memory/(core|context|knowledge-graph|…)/*'`

---

## Violations Found (Pre-Fix): 17 import lines across 15 files

| # | File | Line | Deep Import | Reason |
|---|------|------|-------------|--------|
| 1 | `server/chat/orchestration/chat-orchestrator.ts` | 35 | `../../memory/core/memory-engine.ts` | Bypasses public index |
| 2 | `server/chat/orchestration/chat-orchestrator.ts` | 36 | `../../memory/context/memory-context-builder.ts` | Bypasses public index |
| 3 | `server/orchestration/orchestrator.ts` | 23 | `../memory/context/memory-context-builder.ts` | Bypasses public index |
| 4 | `server/orchestration/orchestrator.ts` | 24 | `../memory/core/memory-engine.ts` | Bypasses public index |
| 5 | `server/orchestration/execution/workflow-runner.ts` | 23 | `../../memory/context/memory-context-builder.ts` | Bypasses public index |
| 6 | `server/orchestration/execution/phase-runner.ts` | 30 | `../../memory/context/memory-context-builder.ts` | Bypasses public index |
| 7 | `server/agents/verifier/verifier-agent.ts` | 25 | `../../memory/core/memory-engine.ts` | Bypasses public index |
| 8 | `server/agents/verifier/verifier-agent.ts` | 26 | `../../memory/context/memory-context-builder.ts` | Bypasses public index |
| 9 | `server/agents/supervisor/supervisor-agent.ts` | 24 | `../../memory/core/memory-engine.ts` | Bypasses public index |
| 10 | `server/agents/supervisor/supervisor-agent.ts` | 25 | `../../memory/context/memory-context-builder.ts` | Bypasses public index |
| 11 | `server/agents/filesystem/filesystem-agent.ts` | 23 | `../../memory/context/memory-context-builder.ts` | Bypasses public index |
| 12 | `server/agents/filesystem/filesystem-agent.ts` | 24 | `../../memory/core/memory-engine.ts` | Bypasses public index |
| 13 | `server/agents/terminal/terminal-agent.ts` | 25 | `../../memory/context/memory-context-builder.ts` | Bypasses public index |
| 14 | `server/agents/terminal/terminal-agent.ts` | 26 | `../../memory/core/memory-engine.ts` | Bypasses public index |
| 15 | `server/agents/planner/planner-agent.ts` | 27 | `../../memory/core/memory-engine.ts` | Bypasses public index |
| 16 | `server/agents/planner/planner-agent.ts` | 28 | `../../memory/knowledge-graph/graph-traversal.ts` | Bypasses public index |
| 17 | `server/agents/planner/planner-agent.ts` | 29 | `../../memory/knowledge-graph/graph-store.ts` | Bypasses public index |
| 18 | `server/agents/executor/executor-agent.ts` | 38 | `../../memory/core/memory-engine.ts` | Bypasses public index |
| 19 | `server/agents/executor/executor-agent.ts` | 39 | `../../memory/context/memory-context-builder.ts` | Bypasses public index |
| 20 | `server/agents/executor/memory/failure-memory.ts` | 12 | `../../../memory/core/memory-engine.ts` | Bypasses public index |
| 21 | `server/agents/executor/memory/execution-history.ts` | 12 | `../../../memory/core/memory-engine.ts` | Bypasses public index |
| 22 | `server/agents/executor/learning/learning-store.ts` | 9 | `../../../memory/core/memory-engine.ts` | Bypasses public index |
| 23 | `server/agents/coderx/coderx-agent.ts` | 29 | `../../memory/core/memory-engine.ts` | Bypasses public index |
| 24 | `server/agents/coderx/coderx-agent.ts` | 30 | `../../memory/context/memory-context-builder.ts` | Bypasses public index |
| 25 | `server/agents/browser/browser-agent.ts` | 20 | `../../memory/core/memory-engine.ts` | Bypasses public index |
| 26 | `server/agents/browser/browser-agent.ts` | 21 | `../../memory/context/memory-context-builder.ts` | Bypasses public index |

**Total violations: 26 import lines across 15 files**

---

## Symbols Involved

| Deep Path | Symbols Used By | Exported from index.ts? (Pre-fix) |
|-----------|----------------|-----------------------------------|
| `memory/core/memory-engine.ts` | 12 files | **YES** (`memoryEngine`, `MemoryEngine`) |
| `memory/context/memory-context-builder.ts` | 11 files | **NO** — missing export (violation) |
| `memory/knowledge-graph/graph-traversal.ts` | 1 file | **YES** (`graphTraversal`) |
| `memory/knowledge-graph/graph-store.ts` | 1 file | **YES** (`graphStore`) |

---

## Fix Applied

All 26 import lines replaced with canonical `server/memory/index.ts` imports.  
`buildMemoryContext`, `buildMemoryContextString`, `MemoryContext`, `ContextBuildOptions` added to `index.ts` to unblock the migration.

---

## Violations Remaining (Post-Fix)
**Zero.** Final scan confirmed: `No matches found`.
