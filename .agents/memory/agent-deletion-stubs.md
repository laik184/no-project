---
name: Agent deletion stubs
description: How to safely delete agents in nura-x without breaking compilation — stub pattern and dependency map.
---

## Rule
When removing agent directories from `server/agents/`, always create stub files for any deleted module that is imported elsewhere. Never leave broken imports.

**Why:** The nura-x architecture has deep cross-agent imports. Deleting agents without stubs causes `ERR_MODULE_NOT_FOUND` crashes at startup.

## How to apply
1. `grep -rn "from.*agents/<deleted>" server/` to find all broken imports.
2. For each broken import, create a minimal stub at the exact deleted path that exports the required types/functions as no-ops.
3. Never stub a kept agent's internal files — only stub the deleted modules.

## Kept agents (self-contained, no cross-agent deps)
- `server/agents/supervisor/` — only imports from its own subdirectory + contracts/types
- `server/agents/planner/` — only imports contracts/types + bus
- `server/agents/executor/` — only imports contracts/types + toolOrchestrator
- `server/agents/verifier/` — self-contained
- `server/agents/browser/` — self-contained
- `server/agents/contracts/` — shared types only

## Critical stubs required (always needed when these agents are deleted)
- `server/agents/core/tool-loop/tool-loop.agent.ts` — imported by dag-agent-executor, specialist-executor
- `server/agents/core/tool-loop/index.ts` — imported by tool-loop.executor, supervisor-bridge
- `server/agents/core/tool-loop/tool-reference.ts` — re-exported by chat/run/tool-reference.ts
- `server/agents/core/pipeline/index.ts` — imported by chat/run/executor.ts (executePipeline)
- `server/agents/core/pipeline/orchestrator.ts` — imported by chat/orchestrator.ts (getMetrics)
- `server/agents/core/pipeline/registry/orchestrator.registry.ts` — imported by master-registry.ts
- `server/agents/memory/index.ts` — imported by tool-loop.executor, memory-tools, memory-bridge
- `server/agents/memory/vector/vector-types.ts` — imported by memory pipeline files
- `server/agents/memory/vector/embedding-engine.ts`, `semantic-search.ts`, `memory-ranking.ts`
- `server/agents/planning/index.ts` — imported by controller.ts (needsPlanning), planned.executor.ts
- `server/agents/coordination/coordination-agent.ts` + `types.ts`
- `server/agents/runtime/runtime-agent.ts` + `types.ts`
- `server/agents/review/review-agent.ts` + `types.ts`
- `server/agents/recovery/crash-responder.ts` — imported by main.ts directly
- `server/agents/swarm/dynamic-agent-spawner.ts` — imported by active-swarm-engine.ts
