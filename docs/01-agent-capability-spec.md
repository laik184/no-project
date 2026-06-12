# Agent Capability Spec 🔥

> How NURAX AI agents are structured, what each one can do, and how they collaborate to build software autonomously.

---

## Overview

NURAX uses a **multi-tier agent hierarchy**. No single agent does everything — each has a single, clearly bounded responsibility. Agents do not directly touch the filesystem, shell, or network. All side effects flow through the central **Tool Registry** via a `dispatch()` call.

```
User Prompt
    │
    ▼
Chat Orchestrator          ← routes intent: chat vs. build
    │
    ▼
Supervisor Agent           ← validates context, owns lifecycle
    │
    ▼
Planner Agent              ← decomposes goal → ExecutionPlan
    │
    ▼
Orchestration Loop         ← executes plan in ordered "waves"
    ├── CoderX Agent       ← writes / patches code
    ├── Executor Agent     ← runs tasks, dispatches tools
    ├── Terminal Agent     ← shell commands (security-gated)
    ├── Filesystem Agent   ← complex I/O orchestration
    └── Browser Agent      ← UI automation & visual testing
    │
    ▼
Verifier Agent             ← typecheck → build → runtime QA
```

---

## Tier 0 — Chat Orchestrator

**File:** `server/chat/orchestration/chat-orchestrator.ts`

The system's entry point. Receives every user message and decides:

| Intent detected | Route |
|---|---|
| Question / explanation | Lightweight conversational LLM |
| Build / fix / create | Full orchestration engine (Supervisor → ...) |

It also mounts WebSocket routes and bootstraps the real-time SSE bridge so the frontend receives live agent-action events.

---

## Tier 1 — Supervisor Agent

**File:** `server/agents/supervisor/supervisor-agent.ts`

The top-level authority for a single agent run. Responsibilities:

- Validates the incoming request and session context
- Triggers **memory reflection** before work begins (recalls past decisions, bug patterns, lessons learned)
- Delegates to the Orchestration Loop
- Monitors the session lifecycle (start → running → done / error)
- Performs final result validation before returning output to the user
- Emits `session.*` events to the EventBus

**Key input:** `OrchestrationContext` (runId, projectId, sandboxRoot, goal)  
**Key output:** `SupervisorResult` (success, artifacts, summary)

---

## Tier 2 — Planner Agent

**File:** `server/agents/planner/planner-agent.ts`  
**Engine:** `server/agents/planner/engine/index.ts`

Converts a free-text goal into a structured `ExecutionPlan` — an ordered list of tasks with declared dependencies.

How it works:

1. Calls `buildMemoryContext()` to recall relevant architecture decisions
2. Uses a **rule-based keyword engine** (not a raw LLM prompt) to classify the request into task domains (`frontend`, `api`, `database`, `auth`, `styling`, …)
3. Applies dependency rules — e.g., `frontend` always depends on `api`, `api` always depends on `database`
4. Emits the plan as an ordered wave structure that the Orchestration Loop executes

> The Planner is deliberately deterministic: keyword maps + dependency rules beat an LLM "think out loud" for structured planning, making plans reproducible and fast.

---

## Tier 3 — Execution Specialists

### CoderX Agent

**File:** `server/agents/coderx/coderx-agent.ts`

The primary code-writing specialist. Runs a **multi-step coding loop**:

1. Reads the current file structure via filesystem tools
2. Recalls memory context for this project
3. Calls the CodeGen LLM (strict JSON contract — see Prompt Contract doc)
4. Writes/patches files via the Tool Registry
5. Loops if the verifier reports errors (up to a configured retry ceiling)

Specialises in: React components, Express routes, Drizzle schema, auth flows, CRUD modules.

### Executor Agent

**File:** `server/agents/executor/executor-agent.ts`

General-purpose task runner for non-coding steps. Handles:

- Tool dispatch with retry management
- Running npm scripts, package installs, database migrations
- Monitoring execution progress and surfacing errors upward
- Delegating sub-tasks to Terminal or Filesystem agents

### Terminal Agent

Wraps all shell execution. Enforces:

- Command allow-list / deny-list (security gating)
- Working directory scoping to `sandboxRoot`
- Timeout enforcement per command
- Output capture and structured error reporting

### Filesystem Agent

Handles complex, multi-step I/O orchestration:

- Atomic multi-file writes
- Recursive directory operations
- File watching and change detection via `chokidar`
- Conflict detection before destructive operations

### Browser Agent

**Tools registered:** 27 (see Tool Registry doc)

Drives a headless Playwright instance for:

- Visual regression testing
- UI interaction automation (click, fill, select)
- Screenshot capture for verification
- Performance metrics collection
- Accessibility checks

---

## Tier 4 — Verifier Agent

**File:** `server/agents/verifier/verifier-agent.ts`

The QA gate. Runs three ordered verification phases:

| Phase | What it checks | Tool used |
|---|---|---|
| `typecheck` | TypeScript compilation errors | `runTypecheck` |
| `build` | Vite/esbuild production build | `runBuild` |
| `runtime` | Server health + crash detection | `checkServerHealth`, `detectRuntimeCrash` |

If any phase fails, the Verifier emits structured error objects that CoderX uses to self-correct (triggering another coding loop iteration).

---

## Cross-Cutting Concerns

### EventBus

All agents emit typed events to `TypedEventBus` (`server/infrastructure/events/bus.ts`). An SSE adapter bridges these events to the frontend in real time — this is what powers the "Agent Action Feed" UI.

### OrchestrationContext

Passed down the entire hierarchy. Contains:

```typescript
{
  runId: string;        // unique per agent run
  projectId: number;    // DB project ID
  sandboxRoot: string;  // isolated filesystem path
  memoryContext: string; // recalled memory injected as context
  goal: string;         // original user intent
}
```

### Memory Integration

Before any significant work, agents call `buildMemoryContext(projectId)` which returns a string of relevant past decisions, known failure patterns, and architecture lessons. This string is injected directly into agent prompts.

---

## Agent Lifecycle (single run)

```
1. validate        — check inputs, session, permissions
2. recall memory   — buildMemoryContext → inject into prompt
3. plan            — Planner produces ExecutionPlan
4. execute waves   — CoderX / Executor run in dependency order
5. verify          — Verifier checks typecheck + build + runtime
6. reflect         — save new lessons to memory
7. close session   — emit final event, return result
```
