# NURA X — Full System Verification & Agentic Audit Report

**Classification:** Internal Forensic Audit  
**System:** NURA X Autonomous AI IDE  
**Date:** 2026-05-19  
**Audit Scope:** Agent loop architecture, tool orchestration, planning, memory, recovery, and autonomy scoring  

---

## PREAMBLE

This document is a forensic-level operational breakdown of the NURA X agent system. It does not protect any image or generalize claims. Every assertion is traced back to a specific file, function, or observable behavior in the codebase. Claims without evidence are explicitly labeled as such.

---

## 1. INTENT PARSING

### What Actually Happens

When the user sends a message, it enters the system at `server/chat/index.ts` via the WebSocket handler. The `chatOrchestrator` receives the raw string and passes it to `RunController` (`server/chat/run/controller.ts`).

**Decomposition mechanism:**

```
User goal (raw string)
    → needsPlanning(goal)          [server/chat/run/controller.ts:47]
    → true  → executePlannedRun()  [multi-phase pipeline]
    → false → executeDirectRun()   [flat tool-loop]
```

`needsPlanning()` is a heuristic function that inspects the goal for keywords indicating complexity (e.g., "build", "create full", "deploy", "add authentication"). It is not an LLM call — it is a pattern-match gate.

**Evidence of structured task decomposition:**

For planned runs, `runPlannerAgent()` calls `task-decomposer.agent.ts` which prompts the LLM to output a structured JSON plan:

```
server/agents/intelligence/planning/planner/PlannerBoss/core/agents/task-decomposer.agent.ts:56
```

The output is an ordered array of atomic tasks with dependency edges. Each task has:
- `id` — unique identifier
- `description` — executable objective
- `dependsOn[]` — blocking predecessors
- `toolHint` — suggested tool category

**Honest assessment:** Intent parsing is partially real. The routing decision is a dumb keyword heuristic. The actual decomposition into subtasks is LLM-driven and produces a real dependency graph, but the quality of that graph is only as good as the LLM's output. There is no formal type system or constraint solver validating the plan.

---

## 2. PLANNING ENGINE

### Two-Track Architecture

NURA X operates two distinct execution tracks:

**Track A — ReAct Tool Loop (unplanned):**  
Used for simple, single-step goals. No explicit plan is generated. The LLM decides each next action from accumulated context. Entry: `runAgentLoop()` in `server/agents/core/tool-loop/tool-loop.agent.ts`.

**Track B — 9-Phase Deterministic Pipeline (planned):**  
Used for complex goals. Phases execute in fixed sequence:

| Phase | Module |
|-------|--------|
| 1. Safety Check | `server/agents/core/pipeline/stages/safety-check/` |
| 2. Routing | `server/agents/core/pipeline/stages/routing/` |
| 3. Decision | `server/agents/core/pipeline/stages/decision/` |
| 4. Planning | `server/agents/core/pipeline/stages/planning/` |
| 5. Validation | `server/agents/core/pipeline/stages/validation/` |
| 6. Generation | `server/agents/core/pipeline/stages/generation/` |
| 7. Execution | `server/agents/core/pipeline/stages/execution/` |
| 8. Recovery | `server/agents/core/pipeline/stages/recovery/` |
| 9. Memory | `server/agents/core/pipeline/stages/memory/` |

**Dependency ordering:** In Track B, each phase gate is sequential — a phase cannot start until the prior phase resolves. In Track A, task ordering within the loop is implicit (left to the LLM).

**Plan adaptation after failure:**  
- In Track A: The error is fed back as an `[OBSERVATION]` block. The LLM revises the next tool call. No formal re-planning occurs — it is reactive adjustment.
- In Track B: Phase 8 (Recovery) is invoked. It reclassifies the error and may replay a prior phase. Evidence: `server/agents/core/recovery/orchestrator.ts:83`.

**Honest assessment:** Track B has real dependency ordering. Track A's "planning" is emergent from LLM reasoning, not a formal planner. The adaptation after failure is genuine for classification + retry, but the LLM choosing the next step is not deterministic replanning.

---

## 3. TOOL ORCHESTRATION

### Tool Registry

49 tools are loaded across 15 categories at startup:

```
[tool-registry] Loaded 49 tools across 15 categories
```

Source: `server/tools/orchestrator.ts` — `unifiedRegistry`. All tools are registered with:
- Name + description (fed to LLM)
- JSON schema for parameters (validated at call time)
- Permission tier (read / write / destructive)

### How Tool Selection Works

The LLM receives the full tool list in the system prompt as a `TOOL_REFERENCE` block (`tool-loop.agent.ts:105`). It returns a `tool_calls` array in its response. The orchestrator:

1. Looks up the tool by name in the registry
2. Validates parameters against the JSON schema
3. Executes the tool function
4. Appends a structured `[OBSERVATION]` block to the message history

**Concrete evidence of observation-driven decisions (the T4 fix):**

```typescript
// server/agents/core/tool-loop/tool-call.executor.ts:62
const executionObserver = buildObservation({
  toolName,
  result,
  runtimeHealth,
  errorClassification,
  consoleOutput
});
messages.push({ role: "tool", content: executionObserver });
```

This means after every tool call, the LLM sees:
- What the tool returned
- Whether the runtime is healthy (checked live)
- What class of error occurred if it failed

**WHY tool was selected → WHAT changed:** This is observable in the message history appended during a run. Each turn, the LLM sees the prior observation and changes its next action. This is verifiable by inspecting `agent_events` rows in the database for a given `run_id`.

**Pre-run file reads:** The system prompt builder (`system-prompt.agent.ts`) issues file-read tool calls before any agent action when the goal involves existing code. This is confirmed by the tool sequence in `agent_events`.

**Honest assessment:** Tool orchestration is real. The LLM genuinely selects tools based on observations. However, the LLM can and does hallucinate tool parameters or call tools in suboptimal order — there is no formal verifier ensuring the tool sequence is optimal before execution.

---

## 4. MEMORY AND CONTEXT SYNCHRONIZATION

### Short-Term Context (Within a Run)

Maintained as an in-memory array of messages (`ToolMessage[]`) passed on every LLM call. Includes:
- System prompt (capabilities, project state, tool reference)
- All prior tool calls and their observations
- User goal

**Context window management:** A `context-compressor.ts` module at `server/agents/core/tool-loop/continuation/context-compressor.ts` summarizes earlier turns when the token count approaches the model's limit. This is a real truncation/summarization step, not simple sliding window drop.

### Long-Term Memory (Across Runs)

Pipeline at `server/agents/core/memory/orchestrator.ts`:

```
Raw agent events
    → Deduplication
    → Scoring (relevance weight)
    → Filtering (noise removal)
    → Classification (pattern | fact | preference)
    → Writing to persistent store
```

On the next run, memory is retrieved via similarity search and injected into `memoryContext` in `AgentLoopInput`.

**What is actually persisted:** Lessons learned from prior runs (e.g., "this project uses ESM imports — never use require()"), not raw conversation logs. The `agent_events` table in PostgreSQL stores the full event stream for each run.

**What is NOT synchronized in real time:** The agent does not continuously watch the file system during a run. File state is read on demand when a file-read tool is called. If an external process modifies a file mid-run, the agent won't know unless it re-reads.

**Honest assessment:** Short-term context is fully synchronized within a run. Long-term memory is real but the retrieval is keyword/similarity-based, not semantic understanding. The system can forget patterns if they don't score high enough in the filtering step.

---

## 5. AGENTIC LOOP DETECTION

### The ReAct Loop — Verified Structure

```
THINK  →  The LLM receives [system prompt + tool reference + all observations so far]
           and reasons about the next action (internal chain-of-thought in the response).

ACT    →  LLM emits tool_calls[]. The executor calls the tool.

OBSERVE →  executionObserver builds a structured block:
            [OBSERVATION]
            - tool: shell_exec
            - exit_code: 1
            - stderr: "Cannot find module './foo'"
            - runtime_health: degraded
            - error_class: ImportError
            [/OBSERVATION]

REFLECT → The observation is appended to the message array.
           On the next LLM call, it sees what went wrong.

RETRY  →  LLM decides to either:
           a) Fix the import and retry the command
           b) Read the package.json to understand the module tree
           c) Escalate to the recovery orchestrator

VALIDATE → On terminal tool call (task_complete), runVerificationEngine() fires:
            - TypeScript check
            - Runtime health probe
            - Preview stability check
           If verification fails, the loop does NOT terminate — it re-enters THINK.
```

**Loop bounds:** `maxSteps` defaults to 25 iterations. After 25 steps, the run is force-terminated and marked `failed`. This prevents infinite loops but also means sufficiently complex tasks are artificially cut off.

**Honest assessment:** The THINK→ACT→OBSERVE→REFLECT→RETRY→VALIDATE cycle is genuinely implemented. It is not simulated. Each step has real code behind it. The limitation is that REFLECT is done entirely by the LLM — there is no symbolic reasoner verifying the LLM's reflection is correct.

---

## 6. FAILURE RECOVERY TEST

### Layer 1 — Transient Retry (Network / Rate Limit)

```typescript
// server/agents/core/tool-loop/retry.ts
withRetry(fn, {
  maxAttempts: 3,
  backoff: exponential_with_jitter,
  retryOn: [429, 503, NetworkError]
})
```

This wraps every LLM API call. On a 429, it waits and retries automatically without the agent loop restarting.

### Layer 2 — Tool Error as Observation

If `shell_exec` returns exit code 1, the error output is fed back into the loop as an observation. The LLM then diagnoses and corrects. This is the most common recovery path and works reliably for well-understood errors (missing packages, wrong paths, syntax errors).

### Layer 3 — Systemic Recovery Orchestrator

At `server/agents/core/recovery/orchestrator.ts:83`:

```
Error detected (exit from tool-loop with failure)
    → ErrorClassifier.classify(error)      → Category: [IMPORT | RUNTIME | BUILD | NETWORK | ...]
    → RecoveryPlanner.plan(category)       → Strategy: [retry | rollback | patch | escalate]
    → SafetyGuard.validate(strategy)       → Ensures fix doesn't cause more damage
    → Apply strategy
    → Re-enter tool-loop
```

### Layer 4 — Pre-Run Checkpoint + Rollback

Before any agent loop starts, a checkpoint is taken (git commit SHA + file snapshot stored in `checkpoints` table). If the agent causes unrecoverable damage, the user can trigger a rollback to this checkpoint.

**Evidence of context-aware diagnosis:**  
The `error_class` in the observation block changes the LLM's diagnosis path. An `ImportError` triggers a package check. A `SyntaxError` triggers a file re-read and patch. A `RuntimeCrash` triggers the crash-responder which invokes the autonomous-debug agent. These are distinct paths, not a generic retry.

**Honest assessment:** Failure recovery is multi-layered and real. Layer 2 (observation loop) is the most effective. Layer 3 (recovery orchestrator) is the most complex but also the most likely to fail on novel error patterns the classifier hasn't seen. Layer 4 (rollback) is a safety net, not an autonomous fix.

---

## 7. PREVIEW VALIDATION

### What the Verification Engine Checks

`runVerificationEngine()` is called after every terminal tool call before a run is marked complete. It runs:

1. **TypeScript diagnostics** — checks for type errors in modified files
2. **Runtime health probe** — polls the project's running process via `observation-controller`
3. **Port availability** — verifies the project's server is listening on the expected port
4. **Preview stability** — the `preview-proxy` confirms the process returns HTTP 200

If any check fails, the loop re-enters at THINK with the failure observation injected.

**What it does NOT do:**
- It does not visually render the UI and compare pixels
- It does not click buttons or interact with forms
- It does not validate responsive layout breakpoints
- It does not run browser-based JavaScript tests

**Honest assessment:** Runtime and type verification are real and observable. Visual/interaction validation does not exist. The system knows the server is up but cannot verify that a button is correctly positioned or a form submits correctly. This is a genuine limitation.

---

## 8. AUTONOMY SCORE

| Capability | Score /100 | Evidence / Reasoning |
|---|---|---|
| **Planning** | 62 | Track B pipeline is real and ordered. Track A planning is emergent/LLM-driven. `needsPlanning()` gate is a keyword heuristic. |
| **Tool Usage** | 78 | 49 tools, schema-validated, observation-driven selection. LLM can and does make suboptimal tool choices. |
| **Runtime Awareness** | 71 | Active health monitoring via `observation-controller`. Port probing is live. No visual/browser-level awareness. |
| **Memory Persistence** | 55 | PostgreSQL-backed event store is real. Long-term pattern memory exists. Retrieval quality depends on similarity scoring which is imperfect. |
| **Self-Correction** | 68 | Observation loop drives real correction. Recovery orchestrator adds a second layer. Correction is only as good as the LLM's reasoning about the observation. |
| **Context Synchronization** | 70 | Full within-run sync. Cross-run sync via memory pipeline. External file changes mid-run are invisible to the agent unless re-read. |
| **Multi-Step Reasoning** | 65 | ReAct loop is genuine multi-step. maxSteps=25 cap is a hard ceiling. Context compressor introduces information loss on very long runs. |
| **True Autonomy** | 60 | Can complete complex tasks end-to-end without human intervention. Fails on truly novel error patterns. Requires a well-specified goal to perform well. |
| **Fake Simulation Risk** | 22 | Low. The tool execution path is real code calling real processes. Hallucination risk exists at the LLM reasoning layer, not the execution layer. |

---

## 9. HALLUCINATION DETECTION

### Where the System is Genuinely Autonomous

- **Tool execution:** When the LLM calls `shell_exec`, a real child process runs. The exit code and stdout/stderr are real. This cannot be faked.
- **File operations:** `read_file` and `write_file` interact with the actual sandbox filesystem (`server/infrastructure/sandbox/sandbox.util.ts`). All operations are strictly scoped to `.sandbox/<projectId>/`.
- **Database persistence:** `agent_events`, `chat_messages`, `tool_executions` are written to PostgreSQL in real time. The event log is a verifiable audit trail.
- **Runtime health checks:** The `observation-controller` polls actual process PIDs. Port availability is checked with real socket probes.

### Where Pattern-Matching Replaces Reasoning

- **`needsPlanning()` gate:** This is regex-level keyword matching, not intent understanding. A complex goal with unusual wording might be routed to the wrong track.
- **Error classification:** The `ErrorClassifier` matches error strings to known categories. Novel error messages that don't match any known pattern will be misclassified and trigger the wrong recovery strategy.
- **Memory retrieval:** Retrieved memories are similarity-matched, not semantically understood. A memory about "ESM imports in React" might incorrectly influence a Node.js-only task.

### Where the System Simulates Reasoning Instead of Verifying

- **Visual validation:** The system reports preview stability based on HTTP 200 status only. It does not know whether the rendered page is correct, broken-looking, or completely blank with a 200 status.
- **Plan quality:** After `task-decomposer.agent.ts` generates a plan, no formal verifier checks whether the plan is actually coherent or completable. The LLM grades its own plan.
- **Context compression:** When `context-compressor.ts` summarizes earlier turns, the summary is LLM-generated. The LLM decides what to keep. Critical details from earlier turns can be silently dropped.

---

## 10. FINAL VERDICT

**Question:** Is NURA X a real agentic execution system or a conversational illusion with partial tool orchestration?

**Answer based on observable evidence only:**

NURA X is a **real agentic system with genuine tool execution and multi-layer failure recovery, operating within the constraints of LLM-driven reasoning**.

It is **not** a conversational illusion. Tools execute real processes. Files are genuinely modified. Databases store real event logs. The ReAct loop produces measurable, verifiable side effects in the filesystem and runtime.

It is **not** fully autonomous in the sense of a formal AI agent with symbolic planning, constraint verification, or logical proof of correctness. The planning layer is LLM-based and therefore probabilistic. Self-correction requires the LLM to correctly interpret observations, which fails on novel situations.

**The most accurate description:**

> A hybrid system: deterministic tool execution infrastructure wrapped around probabilistic LLM reasoning. The infrastructure layer is robust and verifiable. The reasoning layer is capable but fallible, with recovery mechanisms that handle the common failure modes and degrade gracefully on the rest.

**Strongest capabilities:** Tool execution, runtime observation, database-backed event logging, multi-layer failure recovery.

**Genuine weaknesses:** Visual validation (non-existent), plan verification (trusts the LLM), memory retrieval quality (similarity-based, not semantic), context loss on long runs (compressor drops information).

**Fake simulation risk:** Low at the execution layer. Moderate at the reasoning layer (LLM can reason incorrectly about what it observed). Zero at the data persistence layer.

---

*This report was generated from direct inspection of the NURA X source tree, workflow logs, and database schema. All file paths and function references are verifiable in the codebase.*
