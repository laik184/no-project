# Root Cause Analysis — Coding Task Failure

**Date:** 2026-06-04  
**System:** Nura-X Deployer — Agentic AI Vibe Coder  
**Problem:** Coding tasks never complete. Example response: *"The planner set up a frontend UI task but the required coding tool wasn't available."*

---

## Executive Summary

The planner constructs tool names using a pattern (`execute_<type>_task`) that does not match any registered tool in the system. The tool registry contains 46 coding tools all named with a `generate_*` pattern. The overlap between what the planner requests and what the registry provides is **zero**. Every coding task fails at the dispatcher with `ToolNotFoundError` before any code is written.

---

## Execution Flow Trace

```
User Request
    ↓
Chat (chat-orchestrator.ts)
    ↓
Orchestration → Planner Agent
    ↓
task-planner.ts  ← PROBLEM ORIGINATES HERE
    ↓
Executor Agent (step-runner.ts)
    ↓
Tool Dispatcher (tool-dispatcher.ts)
    ↓
Tool Resolver (tool-resolver.ts)  ← HARD FAILURE HERE
    ↓
Tool Registry → "execute_frontend_task" → NOT FOUND
    ↓
ToolNotFoundError propagates back up
    ↓
LLM (responder.service.ts) rewrites error as natural language
    ↓
User sees: "The planner set up a frontend UI task but the required coding tool wasn't available."
```

---

## Phase 1 — Planner Analysis

**File:** `server/agents/planner/planning/task-planner.ts`  
**Line:** 35

```ts
toolName: `execute_${component.type}_task`,
```

The planner generates a `toolName` for every task by interpolating `component.type` into this template. `component.type` is produced by the goal analysis engine in `server/engine/planning/index.ts`, which keyword-matches the user's input against a fixed set of types:

| Type | Trigger Keywords |
|---|---|
| `frontend` | ui, react, page, component, html, css, dashboard… |
| `backend` | server, express, node, service… |
| `api` | api, endpoint, route, rest… |
| `database` | database, db, schema, table, model… |
| `auth` | auth, login, jwt, session… |
| `storage` | storage, file upload, s3… |
| `testing` | test, spec, jest, e2e… |
| `deployment` | deploy, docker, ci/cd… |
| `generic` | *(fallback — nothing matched)* |

**Example:** User types *"Create an HTML file and write code"*
- Keyword `html` matches → `component.type = 'frontend'`
- Label assigned: `"Frontend UI"`
- **Emitted tool name: `execute_frontend_task`**

**Full list of tool names the planner can emit:**

```
execute_frontend_task
execute_backend_task
execute_api_task
execute_database_task
execute_auth_task
execute_storage_task
execute_testing_task
execute_deployment_task
execute_generic_task
```

---

## Phase 2 — Executor Analysis

**File:** `server/agents/executor/execution/step-runner.ts`  
**Line:** 63

```ts
const result = await executeTool(rs.step.toolName, rs.step.toolInput, toToolContext(context));
```

The executor passes the planner's `toolName` directly to the dispatcher with **no transformation and no fallback**. The `execute_frontend_task` name reaches the dispatcher unchanged.

The executor also has its own tool-selection table (`server/agents/executor/planning/tool-selection.ts`) with a `CODING_TOOLS` map, but this map is **never consulted** in the step execution path — it appears to be an unused lookup table.

---

## Phase 3 — Tool Dispatcher / Resolver Analysis

**File:** `server/tools/registry/tool-dispatcher.ts`  
**File:** `server/tools/registry/tool-resolver.ts`  
**Line:** 60

```ts
export function resolveTool(name: string): ToolDefinition {
  const tool = getTool(name);
  if (!tool) throw new ToolNotFoundError(name);   // ← FAILURE POINT
  return tool;
}
```

`getTool("execute_frontend_task")` returns `undefined`. `ToolNotFoundError` is thrown, caught by the dispatcher, and returned as:

```ts
{ ok: false, error: '[ToolResolver] Tool not found: "execute_frontend_task"', code: 'NOT_FOUND' }
```

`step-runner.ts` sees `result.ok === false`, throws the error, and after retries are exhausted the step is marked failed.

**Exact failure location:**
- **File:** `server/tools/registry/tool-resolver.ts`
- **Function:** `resolveTool()`
- **Line:** 60

---

## Phase 4 — Tool Registry Audit

**File:** `server/tools/coding/registry/register-coding-tools.ts`  
**File:** `server/tools/planner/register-planner-tools.ts`

The registry contains **47 tools total** across 6 categories:

| Category | Count | Naming Pattern | Example |
|---|---|---|---|
| Frontend | 7 | `generate_react_*`, `generate_tailwind_*` | `generate_react_page` |
| Backend | 7 | `generate_express_*`, `generate_service`, … | `generate_express_route` |
| API | 6 | `generate_rest_api`, `generate_api_*` | `generate_rest_api` |
| Auth | 7 | `generate_jwt_auth`, `generate_login_*` | `generate_jwt_auth` |
| Database | 7 | `generate_schema`, `generate_model`, … | `generate_schema` |
| Components | 7 | `generate_form`, `generate_table`, … | `generate_dashboard` |
| CRUD | 5 | `generate_crud_*` | `generate_crud_module` |
| Planner | 1 | `create_execution_plan` | *(no-op acknowledgement stub)* |

**None are named `execute_*_task`. The naming families are completely disjoint.**

---

## Phase 5 — Failure Stage Classification

| Stage | Status |
|---|---|
| A. Planner | Completes — but emits wrong tool names |
| B. Executor | Completes — passes tool name straight through |
| **C. Dispatcher / Tool Registry** | **FAILS — ToolNotFoundError** |
| D. Tool Execution | Never reached |
| E. File Creation | Never reached |

**Failure Stage: C — Dispatcher / Tool Registry**

---

## Phase 6 — User-Facing Message Source

**File:** `server/services/chat/responder.service.ts`  
**Line:** 121

The message *"The planner set up a frontend UI task but the required coding tool wasn't available"* is **not hardcoded anywhere in the codebase**. It is **LLM-generated**. On run failure, the responder sends this prompt to the LLM:

```ts
`The agent run failed.\nGoal: ${goal}\nError: ${result.error ?? 'Unknown error'}\n
Write a short, helpful 1-sentence explanation for the user.`
```

The LLM receives `ToolNotFoundError: Tool not found: "execute_frontend_task"` plus the task label `"Frontend UI"` and rewrites it as a natural language sentence. The phrasing will vary between runs.

---

## Root Cause — Final Verdict

**One sentence:** The planner builds tool names using `execute_${type}_task` but the registry only contains tools named `generate_*` — these two namespaces have zero overlap, so every coding task fails with `ToolNotFoundError` before any tool runs.

### Evidence

| # | Evidence | File | Line |
|---|---|---|---|
| 1 | Planner emits `execute_${component.type}_task` | `server/agents/planner/planning/task-planner.ts` | 35 |
| 2 | Goal engine produces types: frontend, backend, api, … generic | `server/engine/planning/index.ts` | 11–20 |
| 3 | 46 coding tools registered, all named `generate_*` | `server/tools/coding/registry/register-coding-tools.ts` | 73–127 |
| 4 | Only planner tool is a no-op stub (`create_execution_plan`) | `server/tools/planner/register-planner-tools.ts` | 22–44 |
| 5 | Registry lookup returns `undefined`, throws `ToolNotFoundError` | `server/tools/registry/tool-resolver.ts` | 60 |
| 6 | Executor passes tool name straight to dispatcher, no remapping | `server/agents/executor/execution/step-runner.ts` | 63 |
| 7 | Executor's own `CODING_TOOLS` map exists but is never used in step execution | `server/agents/executor/planning/tool-selection.ts` | 34–44 |

**Confidence: 100%**

---

## What Is NOT the Root Cause

- The LLM API key is correctly configured — this is not an AI connectivity issue
- The tool registry itself works correctly — it accurately reports that the requested tools do not exist
- The executor, dispatcher, and resolver all function as designed
- The 46 coding tools are correctly implemented and registered — they are simply never called because no task ever reaches them
