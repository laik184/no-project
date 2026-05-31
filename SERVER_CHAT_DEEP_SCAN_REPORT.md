# SERVER/CHAT/ — Deep Scan Report

**Generated:** 2025-07-02  
**Scope:** Full `server/chat/` + all downstream orchestration, agents, tools, and LLM layers  
**Files Read:** 40+ TypeScript modules across chat, orchestration, agents, tools, shared  
**Status of System:** ❌ CHATBOT NOT RESPONDING — 4 critical blockers + 8 severe issues  

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Request Lifecycle — Ideal State](#2-request-lifecycle--ideal-state)
3. [Request Lifecycle — Current State (What Actually Happens)](#3-request-lifecycle--current-state-what-actually-happens)
4. [Problems Found — Full Catalogue](#4-problems-found--full-catalogue)
5. [Root Cause Analysis](#5-root-cause-analysis)
6. [Fix Priority Matrix](#6-fix-priority-matrix)
7. [Files Audited](#7-files-audited)

---

## 1. System Architecture Overview

NURAX-AGENT is **NOT a conversational chatbot**. It is a full multi-agent orchestration system. Understanding this is essential to diagnosing why it appears "not responding."

```
USER (browser)
    │
    │  POST /api/chat/:conversationId/messages
    │  GET  /api/chat/stream (SSE)
    ▼
┌────────────────────────────────────────────────┐
│  server/chat/  (Chat Infrastructure Layer)     │
│                                                │
│  chat.routes.ts → chat-controller.ts          │
│  → chat-orchestrator.ts                       │
│    ├── conversation-manager.ts (in-mem)       │
│    ├── turn-manager.ts (in-mem)               │
│    ├── message-store.ts (in-mem)              │
│    ├── stream-manager.ts (in-mem SSE buf)     │
│    ├── context-builder.ts → context-loader.ts │
│    ├── clarification-manager.ts               │
│    └── sse-manager.ts → EventBus → client     │
└────────────────────────────────────────────────┘
    │
    │  chatOrchestrator.startRun()
    │  → orchestrate() [fire-and-forget async]
    ▼
┌────────────────────────────────────────────────┐
│  server/orchestration/  (Orchestration Layer)  │
│                                                │
│  orchestrator.ts                              │
│  → execution-plan-builder.ts                  │
│    → workflow-planner.ts → phase-planner.ts   │
│  → orchestration-loop.ts                      │
│    → workflow-runner.ts                       │
│      → phase-runner.ts                        │
│        → agent-coordinator.ts                 │
│          → [planner | executor | verifier |   │
│             browser | filesystem | terminal   │
│             | supervisor | coderx]            │
└────────────────────────────────────────────────┘
    │
    │  Each agent uses:
    ▼
┌────────────────────────────────────────────────┐
│  server/agents/  (Agent Layer)                 │
│                                                │
│  planner/  → planning-loop.ts                 │
│              → task-planner.ts                │
│              → agent-coordinator.ts (planner) │
│                → routing → tool-dispatcher    │
│                                               │
│  executor/ → execution-loop.ts               │
│              → step-runner.ts                 │
│              → tool-dispatcher                │
│                                               │
│  verifier/ → verification-runner.ts          │
│              → verification-loop.ts           │
│              → tool-dispatcher                │
└────────────────────────────────────────────────┘
    │
    ▼
┌────────────────────────────────────────────────┐
│  server/shared/llm-client.ts                   │
│  OpenRouter / OpenAI-compatible API            │
│  Requires: OPENROUTER_API_KEY                  │
└────────────────────────────────────────────────┘
```

**Key design fact:** The system is an AI coding agent. When a user sends a message, the system plans and executes code tasks. There is **no path** where an LLM reply is streamed back as a chat message to the user in natural language.

---

## 2. Request Lifecycle — Ideal State

This is what SHOULD happen for a user message like `"Build a 3D racing game"`:

```
Step 1  POST /api/chat/:conversationId/messages
        └── chat-controller.ts validates request
        └── conversation-manager creates/fetches conversation
        └── message-store saves user message
        └── clarification-manager checks if goal needs clarification
              ├── If unclear → sends clarification question via SSE → STOP
              └── If clear  → proceed

Step 2  chat-orchestrator.startRun()
        └── Creates assistant turn in turn-manager
        └── Opens stream in stream-manager (SSE tokens buffer)
        └── Emits "run:start" event on EventBus
        └── Calls orchestrate() [fire-and-forget]
        └── Returns HTTP 201 immediately

Step 3  GET /api/chat/stream (SSE long-poll)
        └── Client subscribes to SSE fan-out
        └── Receives events as they fire

Step 4  orchestrate() runs async in background
        └── orchestrator.ts.start()
              └── execution-plan-builder.buildExecutionPlan()
                    └── workflow-planner.planWorkflows() → [plan|execute|verify] phases
              └── orchestration-loop runs each workflow:
                    Phase A: planner agent
                      └── planning-loop → analyzeGoal → buildTaskList → buildExecutionPlan
                      └── Returns: ExecutionPlan { tasks, phases, estimatedMs }
                    Phase B: executor agent
                      └── Takes planner's plan
                      └── execution-loop → step-runner → tool-dispatcher
                      └── Tools write files, run commands in .sandbox/
                      └── Emits SSE events per step (action cards)
                    Phase C: verifier agent
                      └── Runs typecheck, build, runtime checks
                      └── Returns pass/fail per step

Step 5  chatOrchestrator.completeRun()
        └── Saves final assistant message to message-store
        └── Closes stream in stream-manager
        └── Emits "run:complete" event

Step 6  Client sees:
        └── SSE: run:start → action cards → step results → run:complete
        └── Final assistant message: execution summary
```

**Current design gap:** In this ideal flow, the "assistant reply" is a structured summary of what the agent DID — not a conversational LLM response. This is by design (coding agent, not chatbot), but the user perceives it as "no response."

---

## 3. Request Lifecycle — Current State (What Actually Happens)

```
Step 1  POST /api/chat/:conversationId/messages  ← ✅ Works
        └── Request validates, message saved
        └── HTTP 201 returned immediately

Step 2  chatOrchestrator.startRun()             ← ✅ Works
        └── Turn opened, stream opened
        └── orchestrate() launched fire-and-forget

Step 3  GET /api/chat/stream                    ← ✅ Works
        └── Client connected to SSE
        └── Receives "run:start" event

Step 4A  orchestration-loop → planner agent      ← ❌ FAILS
         └── runPlannerCycle() called
         └── planning-loop.ts runs phases 1-5 successfully:
               ✅ analyzeGoal → components extracted
               ✅ buildTaskList → tasks array built
               ✅ resolveDependencies → ordering done
               ✅ buildExecutionPhases → phases built
               ✅ buildExecutionPlan → valid plan created
         └── Phase 6: runCoordinatorTasks() ← ❌ FAILS HERE
               └── buildCoordinatorTasks() creates tasks with:
                     toolName: 'create_execution_plan'  ← NOT REGISTERED
               └── routePlanningTask() → tool-dispatcher
               └── tool-resolver throws:
                     "[ToolResolver] Tool not found: 'create_execution_plan'"
               └── plannerLogger.warn: "Coordinator task failed"
               └── BUT: planner returns the plan anyway (non-fatal)
               └── runPlannerCycle returns { success: true, plan }

Step 4B  orchestration-loop → executor agent    ← ❌ FAILS
         └── Receives planner output (plan with tasks)
         └── runExecutorAgent() called
         └── assertAgentInput() validates input:
               └── Checks plan.tasks[].taskId  ← MISSING
               └── Planner uses task.id, executor expects task.taskId
               └── Throws: "[execution-validator] task.taskId is required"
         └── Returns failResult(... error) immediately
         └── No execution happens

Step 4C  orchestration-loop → verifier agent    ← ❌ FAILS
         └── runVerification() called
         └── Builds verification steps: typecheck, build, runtime
         └── runVerificationLoop → tool-dispatcher for each step
         └── All steps fail: "Step result marked as failure"
         └── Likely: tools not found OR .sandbox/ not set up

Step 5  chatOrchestrator.completeRun()          ← ✅ Runs (but misleading)
        └── Creates assistant message:
              "Run complete — 0/1 workflows succeeded in Xms"
        └── Saves to message-store
        └── Closes stream
        └── Client sees the "complete" message

Step 6  Client sees:                            ← ❌ Confusing UX
        └── SSE: run:start ... run:complete
        └── No action cards (executor never ran)
        └── No LLM text response (no path for that)
        └── Final message: "Run complete — 0/1 workflows succeeded"
        └── User perception: "chatbot is not responding"
```

---

## 4. Problems Found — Full Catalogue

---

### 🔴 CRITICAL — System-Breaking (Fix These First)

---

#### C-1: `OPENROUTER_API_KEY` Not Set → All LLM Calls Throw

**File:** `server/shared/llm-client.ts` (lines 20–33)

```typescript
function resolveApiKey(): string {
  const key =
    process.env.OPENROUTER_API_KEY ||
    process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY;

  if (!key) {
    throw new Error(
      '[llm-client] No LLM API key found. ' +
      'Set OPENROUTER_API_KEY or connect the OpenRouter Replit integration.',
    );
  }
  return key;
}
```

**Impact:** `getLLMClient()` is called by every agent that makes LLM requests. If this key is not set:
- Every LLM-dependent planner step throws immediately
- Executor tool calls that use LLM fail
- CoderX agent fails entirely
- The error is caught at agent level and turned into a `PhaseResult { ok: false }`
- User sees no output and no error message explaining why

**Evidence:** `hasLLMKey()` function exists (line 59) — it was clearly anticipated that the key might be missing, but no path warns the user in chat.

**Fix:** Set `OPENROUTER_API_KEY` in Replit Secrets. The client is already wired to pick it up. Alternatively, trigger the OpenRouter Replit integration (`AI_INTEGRATIONS_OPENROUTER_API_KEY`).

---

#### C-2: `create_execution_plan` Tool Not Registered in Tool Dispatcher

**Files:**
- `server/agents/planner/coordination/agent-coordinator.ts` (lines 25, 45)
- `server/agents/planner/planning/task-planner.ts` (line 102)
- `server/tools/registry/tool-resolver.ts` (line 17)

**What happens:**

`task-planner.ts` adds a finalise task with `toolName: 'create_execution_plan'`:
```typescript
tasks.push({
  id:       makeTaskId('finalize'),
  toolName: 'create_execution_plan',   // ← referenced as a registered tool
  ...
});
```

`agent-coordinator.ts` (planner's own coordinator) creates phase tasks and seal tasks, both with:
```typescript
toolName: 'create_execution_plan'   // ← same unregistered tool
```

When `routePlanningTask()` dispatches these, the central tool dispatcher calls:
```typescript
// tool-resolver.ts line 17
throw new ToolNotFoundError(`[ToolResolver] Tool not found: "${name}"`);
```

**Logged error (from workflow logs):**
```
[planner-agent][WARN][runId] Coordinator task failed — label="Phase 1 — build: 3D racing game"
{ error: '[ToolResolver] Tool not found: "create_execution_plan"' }
```

**Impact:** The planner treats coordinator failures as non-fatal (they are logged but ignored). The plan IS returned from `runPlannerCycle()`. However, the coordinator dispatch step (Phase 6 of the planning loop) produces zero useful work. The downstream executor then receives a plan whose structure doesn't match what it expects.

**Fix Option A:** Register `create_execution_plan` as a tool in the tool registry that wraps `createExecutionPlan()` from `planner-agent.ts`.

**Fix Option B:** Remove the coordinator dispatch step entirely from `planning-loop.ts` (lines 134–138). The plan is already built and returned — dispatching it through the tool layer is redundant.

---

#### C-3: `task.id` vs `task.taskId` Mismatch — Executor Always Fails Input Validation

**Files:**
- `server/agents/planner/types/planner.types.ts` — defines `PlannedTask { id: string; ... }`
- `server/agents/executor/validation/execution-validator.ts` — validates `task.taskId`
- `server/agents/executor/executor-agent.ts` (line 86)

**What happens:**

The planner builds tasks using the `PlannedTask` type, which uses `id` as the primary key:
```typescript
// planner task structure
{ id: "task-xyz", label: "...", toolName: "...", ... }
```

The orchestration loop takes the planner's `plan.tasks` and passes it to the executor. The executor's validator calls `assertAgentInput()`, which checks:
```typescript
// execution-validator.ts (inferred from error)
if (!task.taskId) throw new Error('[execution-validator] task.taskId is required');
```

The planner never sets `taskId` — it sets `id`. The executor expects `taskId`. They never agree.

**Logged error:**
```
[executor:runId] Input validation failed: [execution-validator] task.taskId is required.
```

**Impact:** The executor never runs. Every run where the planner phase precedes the executor phase fails at validation. No code is ever executed, no files are written.

**Fix:** Either:
- Map `id → taskId` in the orchestration-loop when building the executor's input
- OR normalize both planner and executor to use the same field name (`taskId` everywhere)

---

#### C-4: No Direct LLM→User Text Response Path Exists

**Files:** All of `server/chat/` + all agent files

**What happens:**

There is NO code path in the entire system where:
1. An LLM generates a natural-language response
2. That response is streamed token-by-token to the user via SSE
3. The user sees a chat message

The only "assistant message" the user ever receives is built in `chat-orchestrator.ts`:
```typescript
// chat-orchestrator.ts (completeRun logic)
const content = `Run complete — ${succeeded}/${total} workflows succeeded in ${durationMs}ms`;
await messageStore.saveAssistantMessage(conversationId, content);
```

This is a static status string, not an LLM response.

`streamManager.append()` (which would stream tokens) is **never called** by any agent in the system. The stream opens, events fire (start/progress/complete), but zero LLM tokens flow through it.

**Impact:** From the user's perspective, asking any question produces only a mechanical status message like `"Run complete — 0/1 workflows succeeded in 847ms"`. This looks like "the chatbot is not responding."

**Fix options (choose one based on product direction):**

| Option | Description | Effort |
|--------|-------------|--------|
| A | Add a simple LLM chat handler before orchestration — check if the message is a conversational query (not a coding task) and reply with a direct LLM stream | Medium |
| B | Add a "supervisor" pre-phase that generates a natural-language plan summary and streams it to the user before executor runs | High |
| C | Change the final assistant message to be LLM-generated (post-run summary) | Low |
| D | Accept current design: the product is an agent, not a chatbot. Update UI to set expectations | Minimal |

---

### 🟠 SEVERE — Major Functionality Broken

---

#### S-1: Planner Task List Uses Unregistered Tool Names for Every Task

**File:** `server/agents/planner/planning/task-planner.ts` (line 35)

```typescript
toolName: `execute_${component.type}_task`,
// Generates names like:
//   execute_frontend_task
//   execute_backend_task
//   execute_database_task
//   execute_api_task
```

None of these dynamically-constructed tool names are registered. The `goal component types` come from `engine/planning/analyzeGoal()`, which can produce any string. The generated tool names will never exist in the registry.

**Impact:** Every single task in the task list (except the finalize task, which has its own bug — see C-2) will fail with `Tool not found` when dispatched.

**Fix:** Use generic registered tools like `execute_coding_task` or `run_agent_task`, OR make task dispatch happen through the agent layer directly (bypassing tool-dispatcher for task execution).

---

#### S-2: Verifier Steps Always Fail — "Step result marked as failure"

**File:** `server/agents/verifier/execution/verification-loop.ts` (inferred)

**What happens:**

The verifier generates steps for `typecheck`, `build`, `runtime` phases. Each step is dispatched through the tool-dispatcher to run shell commands (tsc, npm build, etc.) inside `.sandbox/`. All steps immediately fail with `"Step result marked as failure"` and `durationMs: 0`, indicating they fail before execution begins.

**Likely causes (in order of probability):**
1. The verification tools (`run_typecheck`, `build_check`, `runtime_check`) are not registered in tool-dispatcher
2. `AGENT_PROJECT_ROOT` is not set → sandboxRoot defaults to `.sandbox` which doesn't exist
3. The tools exist but crash during initialization with an unhandled exception

**Logged evidence:**
```
[verifier-agent:runId] Step [typecheck:run_typecheck:id] → fail
  { durationMs: 0, attempt: 1, error: "Step result marked as failure" }
```

**Fix:** Verify that verification tools are registered. Set `AGENT_PROJECT_ROOT` to a valid writable path.

---

#### S-3: `AGENT_PROJECT_ROOT` Not Set — Sandbox Root Defaults to `.sandbox` (Non-Existent)

**File:** `server/orchestration/coordination/agent-coordinator.ts` (line 85)

```typescript
const sandboxRoot =
  (input.sandboxRoot as string | undefined) ??
  process.env.AGENT_PROJECT_ROOT ??
  '.sandbox';                          // ← fallback if env var not set
```

If `AGENT_PROJECT_ROOT` is not set as an env var, all filesystem operations, terminal commands, and code execution attempt to write to a `.sandbox` directory relative to the process working directory. This directory almost certainly does not exist.

**Impact:** Executor filesystem tools fail. Terminal tools fail. Any agent that writes files silently operates on a non-existent path (or throws).

**Fix:** Set `AGENT_PROJECT_ROOT` in env, or create `.sandbox/` at startup.

---

#### S-4: `task-planner.ts` `execute_${type}_task` Tools — Dynamic Names Are Unmatchable

*(Covered in S-1 above but listed separately for severity tracking)*

The fact that tool names are assembled at runtime from user-supplied goal text means:
- They can never be pre-registered
- The tool registry will never contain them
- This is a fundamental architectural mismatch between task-planner and tool-registry

---

#### S-5: No Stream Token Flow — `streamManager.append()` Never Called

**All agent files:** No agent calls `streamManager.append()` at any point.

The `stream-manager.ts` has `append(runId, chunk)` — designed to buffer streaming LLM tokens for the SSE client. But the call chain ends at:

```
chatOrchestrator → orchestrate() [fire-and-forget]
  → orchestrator (no stream reference passed)
    → agents (no stream reference)
      → LLM calls (tokens generated but discarded)
```

The stream manager is opened and closed, but nothing is ever written to it.

**Impact:** Even if the API key is set and agents run successfully, zero LLM output tokens reach the client.

**Fix:** Pass a `streamWriter` callback through the orchestration context, and call it from the planner/executor LLM response handlers.

---

#### S-6: All State Is In-Memory — No Persistence

**Files:**
- `server/chat/state/conversation-manager.ts` — `Map<conversationId, Conversation>`
- `server/chat/state/turn-manager.ts` — `Map<runId, Turn>`
- `server/chat/state/message-store.ts` — `Map<conversationId, Message[]>`
- `server/chat/realtime/sse-manager.ts` — `Map<runId, SSEClient[]>`
- `server/memory/` — all in-memory engines

**Impact:** Any server restart (deploy, crash, HMR) wipes all conversations, messages, turns, and agent memory. Users lose their entire conversation history.

**Fix:** Connect to PostgreSQL (already configured with Drizzle ORM) and persist conversations/messages to DB.

---

### 🟡 MAJOR — Significant Issues

---

#### M-1: Clarification Flow Is Disconnected From Orchestration

**File:** `server/chat/clarification/clarification-manager.ts`

Clarification questions are generated but there is no mechanism to:
1. Pause the orchestration loop while waiting for user response
2. Resume from where it left off with the clarification answer
3. Route the user's follow-up message to the waiting run (vs. starting a new run)

**Impact:** Clarification questions are generated and emitted, but the run starts immediately anyway. User answers go into a new run, not the paused one.

---

#### M-2: SSE Fan-Out Has No Event Replay

**File:** `server/infrastructure/events/sse/sse-manager.ts`

If the client's SSE connection drops and reconnects (network hiccup, tab refocus), all events emitted during the outage are lost. There is no event store or sequence number for replay.

**Impact:** User sees partial run results if their connection is interrupted.

---

#### M-3: `chatOrchestrator.completeRun()` Gives Misleading Success Message on Failure

**File:** `server/chat/orchestration/chat-orchestrator.ts`

The completion message `"Run complete — 0/1 workflows succeeded in Xms"` sounds like a success even when nothing worked. Users see no error explanation.

**Fix:** Distinguish between success and failure completion messages. On failure, include the first error from the phase results.

---

#### M-4: Ambiguity Detector Output Is Not Enforced

**File:** `server/chat/clarification/ambiguity-detector.ts`

The ambiguity detector scores user goals for ambiguity. But even when a goal scores as highly ambiguous, the orchestration proceeds immediately without asking clarifying questions (see M-1).

---

#### M-5: Context Cache Is In-Memory Only

**File:** `server/chat/context/context-cache.ts` (inferred from context-builder.ts)

Context built for each run (file tree, recent changes, project metadata) is cached in-memory. Restarting the server means rebuilding context from scratch on every run.

---

#### M-6: No LLM Health Check at Startup

The system doesn't validate that `OPENROUTER_API_KEY` is set and working at startup. The first indication of a missing key is a failed agent run, which the user experiences as "no response."

**Fix:** Add a startup probe in `server/index.ts` that calls `hasLLMKey()` and logs a clear warning if false.

---

### 🟢 MODERATE — Quality/Reliability Issues

---

#### Q-1: No Run Timeout at Orchestration Level

Long-running orchestrations have no global timeout. A stuck agent phase can hang indefinitely, consuming memory and blocking the SSE connection.

#### Q-2: Memory Stores Not Persisted to DB

`memoryEngine`, `graphStore`, `executionHistory`, `failureMemory`, `learningStore` are all in-RAM stores. Every restart, the agent "forgets" everything it learned.

#### Q-3: `plannerCycle` Returns `success: true` Even When Coordinator Fails

In `planner-agent.ts` (lines 120–145), the `runPlannerCycle` function returns `success: true` as long as a plan object was built — even if the coordinator dispatch step failed. This masks the C-2 bug.

#### Q-4: `execution-validator.ts` Error Message Is Opaque

`"[execution-validator] task.taskId is required"` doesn't tell you which task or what value was found. The log entry makes it hard to diagnose field-name mismatches (C-3).

#### Q-5: `workflow-runner.ts` and `run-store.ts` Not Fully Scanned

These files were not read during this scan due to context limits. They may contain additional issues related to workflow state persistence and run tracking.

---

## 5. Root Cause Analysis

### Why is the chatbot "not responding"?

There are **two independent causes**, either of which alone would cause the symptom:

**Cause 1 (Architectural):** The system is an AI coding agent, not a chatbot. It never generates a natural-language reply. The only text sent to the user is a static status string. This is a design choice, but it creates user confusion.

**Cause 2 (Technical):** Even the agent's work product (action cards, step results) never reaches the user because:
- The planner's coordinator dispatch always fails (C-2: `create_execution_plan` not found)
- The executor always fails validation (C-3: `taskId` vs `id` mismatch)
- The verifier always fails (S-2: verification tools not found)
- The API key may be missing (C-1), causing all LLM calls to throw

**The compound effect:**
```
User types message
  → run starts         ← user sees this (SSE "run:start")
  → planner runs       ← coordinator silently fails, no output
  → executor fails     ← validation error, no output
  → verifier fails     ← all steps fail
  → "Run complete — 0/1 workflows succeeded in Xms"  ← user sees this
```

User perception: "I typed something and got a weird status message. The chatbot is broken."

---

## 6. Fix Priority Matrix

| ID | Problem | Severity | Effort | Fix First? |
|----|---------|----------|--------|------------|
| C-1 | `OPENROUTER_API_KEY` not set | CRITICAL | Trivial (set env var) | ✅ Yes |
| C-2 | `create_execution_plan` tool not registered | CRITICAL | Low | ✅ Yes |
| C-3 | `task.id` vs `task.taskId` field mismatch | CRITICAL | Low | ✅ Yes |
| C-4 | No LLM→user text response path | CRITICAL | Medium–High | After C-1–C-3 |
| S-1 | Dynamic `execute_${type}_task` tool names unmatchable | SEVERE | Medium | After C-3 |
| S-2 | Verifier steps all fail | SEVERE | Medium | After env vars set |
| S-3 | `AGENT_PROJECT_ROOT` not set | SEVERE | Trivial (set env var) | ✅ Yes |
| S-5 | `streamManager.append()` never called | SEVERE | Medium | With C-4 |
| S-6 | All state in-memory (no DB persistence) | SEVERE | High | Later |
| M-1 | Clarification flow disconnected | MAJOR | High | Later |
| M-3 | Misleading completion message | MAJOR | Low | ✅ Yes (quick win) |
| M-6 | No LLM health check at startup | MAJOR | Low | ✅ Yes (quick win) |

### Minimum viable fix to get basic agent output visible:

```
1. Set OPENROUTER_API_KEY in Replit Secrets
2. Set AGENT_PROJECT_ROOT to a writable path (e.g. /tmp/sandbox)
3. Fix task.id → task.taskId mapping in orchestration-loop.ts
4. Either:
   a. Register create_execution_plan as a tool, OR
   b. Remove the coordinator dispatch step from planning-loop.ts Phase 6
5. Add a simple LLM chat response for conversational messages (C-4)
```

After these 5 steps, the system should:
- Run the planner successfully
- Pass executor validation
- Attempt actual code execution
- Return a meaningful response

---

## 7. Files Audited

### server/chat/
| File | Status |
|------|--------|
| `index.ts` | ✅ Clean export barrel |
| `chat.routes.ts` | ✅ Routes correctly wired |
| `chat-controller.ts` | ✅ Input validation, correct delegation |
| `chat-orchestrator.ts` | ⚠️ Completion message misleading (M-3) |
| `run-start.router.ts` | ✅ Correct |
| `stream-manager.ts` | ⚠️ `append()` never called externally (S-5) |
| `turn-manager.ts` | ⚠️ In-memory only (S-6) |
| `conversation-manager.ts` | ⚠️ In-memory only (S-6) |
| `context-builder.ts` | ✅ Correct |
| `context-loader.ts` | ✅ Correct |
| `event-publisher.ts` | ✅ Correct — emits events |
| `sse-manager.ts` | ⚠️ No event replay (M-2) |
| `message-store.ts` | ⚠️ In-memory only (S-6) |
| `clarification-manager.ts` | ⚠️ Disconnected from orchestration (M-1) |
| `system-message.ts` | ✅ Correct |
| `message-builder.ts` | ✅ Correct |
| `stream.constants.ts` | ✅ Correct |
| `ambiguity-detector.ts` | ⚠️ Not enforced (M-4) |

### server/orchestration/
| File | Status |
|------|--------|
| `orchestrator.ts` | ✅ Correct — builds plan, runs loop |
| `orchestration-loop.ts` | ❌ **C-3**: passes planner `id` as executor `taskId` |
| `phase-runner.ts` | ✅ Correct |
| `agent-coordinator.ts` | ✅ Correct — dispatches to right agent |
| `execution-plan-builder.ts` | ✅ Correct — plan builder |
| `workflow-planner.ts` | ✅ Correct — intent → phases |
| `agent-routing.ts` | ✅ Correct |
| `bus.ts` | ✅ Correct |

### server/agents/
| File | Status |
|------|--------|
| `planner/planner-agent.ts` | ⚠️ **Q-3**: returns success even on coordinator failure |
| `planner/execution/planning-loop.ts` | ❌ **C-2**: calls `create_execution_plan` tool (Phase 6) |
| `planner/planning/task-planner.ts` | ❌ **C-2, S-1**: uses unregistered tool names |
| `planner/coordination/agent-coordinator.ts` | ❌ **C-2**: all coordinator tasks use `create_execution_plan` |
| `executor/executor-agent.ts` | ❌ **C-3**: validates `task.taskId` which planner doesn't set |
| `verifier/verifier-agent.ts` | ❌ **S-2**: all steps fail |

### server/shared/
| File | Status |
|------|--------|
| `llm-client.ts` | ❌ **C-1**: throws if `OPENROUTER_API_KEY` not set |

### server/tools/registry/
| File | Status |
|------|--------|
| `tool-resolver.ts` | ✅ Correctly throws `Tool not found` |
| `tool-dispatcher.ts` | ✅ Correct |
| `tool-registry.ts` | ❌ Missing `create_execution_plan` registration |

---

*End of Report*
