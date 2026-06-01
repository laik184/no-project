---
name: Agent runtime blockers recovery
description: 6 critical runtime fixes for the planner→executor→verifier chain — what was wrong and how it was fixed.
---

## Context
NURAX-AGENT: Full-stack AI agent platform. The planner→executor→verifier chain had 6 blockers preventing any agent run from completing.

## The 6 Fixes

### BLK-01: `create_execution_plan` not registered
`planning-loop.ts` Phase 6 called `buildCoordinatorTasks()` + `runCoordinatorTasks()` which dispatched via the tool registry using `create_execution_plan` — a tool that was never registered. **Fix:** Remove Phase 6 coordinator dispatch entirely. The plan is already returned from Phase 5; `workflow-runner.ts enrichPhase()` passes it to the executor automatically. Also registered `create_execution_plan` as a noop tool as a safety net.

**Why:** The coordinator dispatch was architecturally redundant. The orchestration layer already handles planner→executor plan handoff via `enrichPhase()`.

### BLK-02: PlanTask → ExecutionTask type mismatch
`workflow-runner.ts enrichPhase()` passes `PlanTask[]` to the executor, but:
- `PlanTask.id` ≠ `ExecutionTask.taskId` (execution-validator throws immediately)
- `PlanTask.category` ≠ `ExecutionTask.kind` (must be `'terminal'|'filesystem'|'coding'|'verify'|'browser'`)
- `PlanTask.title` ≠ `ExecutionTask.description`

**Fix:** Added `planTaskToExecutionTask()` + `normalizeTaskKind()` helpers in `server/orchestration/coordination/agent-coordinator.ts` executor case. Category mapping: frontend/backend/api/database/auth/crud → `coding`; build → `terminal`; test/testing/runtime → `verify`.

### BLK-03: OPENROUTER_API_KEY missing — silent crash
`llm-client.ts` throws on first use when key absent. **Fix:** `server/startup/health-diagnostics.ts` — validates env vars at boot with clear warnings. Called from `initOrchestrator()`.

### BLK-04: No LLM response to user
`streamManager.append()` was never called. Completion message was static: `"Run complete — N/M workflows in Xms"`. **Fix:** `server/chat/llm/chat-responder.ts` — after orchestration, streams LLM summary via `streamManager.append()`. Falls back to structured plain text when no LLM key. Called from `chat-orchestrator.ts` before `completeRun()`.

### BLK-05: Verifier fails on missing sandbox
`run_typecheck`, `run_build` etc. tried to run in `.sandbox/` which doesn't exist when `AGENT_PROJECT_ROOT` is unset. **Fix:** `existsSync()` check in `runVerification()` before building steps. Returns `{ok:true, steps:[], errors:[]}` when sandbox absent — non-fatal skip.

### BLK-06: `execute_${type}_task` latent bug
Task-planner generated task toolNames like `execute_frontend_task` which don't exist in the registry. This was masked by BLK-01. **Fix:** Removed the finalize task from `buildTaskList()` in `task-planner.ts`.

## Files Changed
- Created: `server/startup/health-diagnostics.ts`, `server/tools/planner/register-planner-tools.ts`, `server/chat/llm/chat-responder.ts`
- Modified: `server/orchestration/orchestrator.ts`, `server/tools/registry/tool-loader.ts`, `server/agents/planner/execution/planning-loop.ts`, `server/agents/planner/planning/task-planner.ts`, `server/orchestration/coordination/agent-coordinator.ts`, `server/agents/verifier/verifier-agent.ts`, `server/chat/orchestration/chat-orchestrator.ts`

## How to apply
Any future change to the planner→executor handoff must maintain the `planTaskToExecutionTask()` transform in `agent-coordinator.ts`. Any new planner task type must be added to the `normalizeTaskKind()` MAP. New tools needed by planner must be registered in `register-planner-tools.ts`.
