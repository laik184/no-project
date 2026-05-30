---
name: Memory platform integration
description: Rules for integrating server/memory/ into agents; boot order, import discipline, and fire-and-forget pattern.
---

## The Rule
`bootstrapMemory()` must be called in `main.ts` BEFORE `loadAllTools()` and `initOrchestration()`.
Calling it multiple times throws ("Store already registered") — call it once only.

**Why:** `bootstrapMemory()` registers 11 domain stores into the singleton `memoryRegistry`.
Any `memoryEngine.store(category, ...)` call before bootstrap will fail with "unknown category".

## Import discipline
- Agents may ONLY import `server/memory/core/memory-engine.ts` — never sub-modules.
- Relative path from `server/agents/[agent]/[agent]-agent.ts`: `../../memory/core/memory-engine.ts`
- Relative path from `server/chat/orchestration/chat-orchestrator.ts`: `../../memory/core/memory-engine.ts`

## Fire-and-forget pattern (required)
All `memoryEngine.store()` calls must be non-blocking:
```ts
memoryEngine.store({ category, content, tags, score, meta }).catch(console.error);
```
**Why:** store() is async file I/O. A memory write failure must never fail an agent run.

## Category mapping
| Agent | Category |
|-------|----------|
| planner | decision + architecture |
| executor | execution |
| verifier | bug (only on failure) |
| supervisor | decision |
| browser | learning |
| coderx | execution |
| chat | conversation |

## Private memory modules — DO NOT REPLACE
executor/memory/* and coderx/memory/* are hot-path in-process stores with agent-specific typed schemas.
They serve a completely different purpose (transient/tuning) from memoryEngine (persistent/categorized).
Naming collisions (both called working-memory.ts, execution-history.ts) are false positives — different interfaces.

## Boot sequence log (confirmed working)
```
[memory-manager] Booted — eviction every 60000ms
[memory] Platform ready — 11 stores registered
[tool-loader] N tools registered
[orchestrator] Initialized
```
