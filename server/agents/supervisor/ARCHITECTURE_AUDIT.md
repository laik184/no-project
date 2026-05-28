# NURA-X — FULL SYSTEM ARCHITECTURE AUDIT

> Principal AI Systems Architect Report  
> Scan Targets: `server/orchestration/`, `server/agents/`, `server/tools/`  
> Total files scanned: ~300+ TypeScript files

---

## REPORT 1 — FULL IMPORT GRAPH

### Orchestration Layer
```
orchestrator.ts
  → core/orchestration-context.ts
  → core/orchestration-session.ts
  → core/orchestration-state.ts
  → execution/orchestration-loop.ts
  → telemetry/orchestration-metrics.ts
  → monitoring/failure-monitor.ts
  → monitoring/orchestration-monitor.ts
  → lifecycle/escalation-manager.ts
  → utils/orchestration-utils.ts
  → validation/orchestration-validator.ts

orchestration-loop.ts
  → planning/execution-plan-builder.ts
  → routing/workflow-routing.ts
  → execution/workflow-runner.ts
  → execution/retry-manager.ts
  → lifecycle/lifecycle-manager.ts
  → lifecycle/escalation-manager.ts
  → lifecycle/recovery-coordinator.ts
  → telemetry/orchestration-metrics.ts
  → telemetry/orchestration-logger.ts
  → events/event-publisher.ts
  → monitoring/orchestration-monitor.ts

phase-runner.ts
  → coordination/agent-coordinator.ts    ← directly calls ALL agents
  → core/orchestration-context.ts
  → monitoring/failure-monitor.ts
  → monitoring/orchestration-monitor.ts
  → telemetry/orchestration-metrics.ts
  → events/event-publisher.ts

coordination/agent-coordinator.ts
  → agents/browser/browser-agent.ts      ← cross-layer: orch → agent ✅ (correct)
  → agents/executor/executor-agent.ts    ← cross-layer: orch → agent ✅
  → agents/filesystem/filesystem-agent.ts
  → agents/planner/planner-agent.ts
  → agents/supervisor/supervisor-agent.ts
  → agents/terminal/terminal-agent.ts
  → agents/verifier/verifier-agent.ts

coordination/dispatcher-client.ts (orchestration layer)
  → tools/registry/tool-dispatcher.ts   ✅ correct
  → tools/registry/tool-types.ts        ✅ type import only
```

### Executor Agent (FIXED)
```
executor-agent.ts
  → core/executor-context.ts
  → core/executor-session.ts
  → core/executor-state.ts
  → planning/execution-planner.ts
  → execution/execution-loop.ts
  → validation/execution-validator.ts
  → telemetry/executor-logger.ts + executor-metrics.ts
  → monitoring/failure-monitor.ts + execution-monitor.ts

execution-loop.ts
  → execution/task-executor.ts

task-executor.ts
  → coordination/tool-coordinator.ts    ← plan-time coordination only (NOT execution)
  → execution/step-runner.ts
  → core/executor-state.ts + executor-session.ts

step-runner.ts  [FIXED ✅]
  → coordination/dispatcher-client.ts   ✅ DIRECT — no bypass
  → core/executor-context.ts (toToolContext)
  → execution/retry-manager.ts
  → validation/integrity-validator.ts

coordination/dispatcher-client.ts
  → tools/registry/tool-dispatcher.ts   ✅ correct gateway

coordination/execution-routing.ts       ⚠ ORPHANED — no longer imported by anyone
```

### Browser Agent
```
browser-agent.ts
  → execution/browser-loop.ts

browser-loop.ts
  → tools/browser/session/browser-lifecycle.ts  ❌ DIRECT TOOL IMPORT (V-01)
  → execution/flow-executor.ts
  → coordination/browser-routing.ts
  → coordination/dispatcher-client.ts           ✅ for context building only

flow-executor.ts
  → execution/step-runner.ts

step-runner.ts
  → coordination/dispatcher-client.ts           ✅

validation/state-validator.ts
  → tools/browser/session/browser-context.ts    ❌ DIRECT TOOL IMPORT (V-02)

coordination/dispatcher-client.ts
  → tools/registry/tool-dispatcher.ts           ✅ correct
```

### CoderX Agent
```
coderx-agent.ts → execution/coding-loop.ts

coding-loop.ts
  → execution/task-executor.ts
  → planning/* (code-planner, implementation-planner, execution-plan-builder)
  → reasoning/* (task-analyzer, dependency-analyzer, decision-engine)

step-runner.ts
  → coordination/coding-routing.ts              ⚠ ROUTING BYPASS (V-04)

coordination/coding-routing.ts
  → coordination/dispatcher-client.ts           ✅ (but reached via extra hop)

coordination/dispatcher-client.ts
  → tools/registry/tool-dispatcher.ts           ✅ correct
```

### Filesystem Agent
```
filesystem-agent.ts → execution/filesystem-loop.ts

step-runner.ts
  → coordination/filesystem-routing.ts
  → operations/read,write,patch,delete,search-operation.ts
  → each calls coordination/dispatcher-client.ts ✅ (3 hops — justified for complex ops)

coordination/dispatcher-client.ts
  → tools/registry/tool-dispatcher.ts           ✅ correct
```

### Terminal Agent
```
terminal-agent.ts
  → execution/terminal-runner.ts
  → execution/execution-loop.ts
  → execution/step-runner.ts

step-runner.ts
  → coordination/execution-routing.ts           ⚠ ROUTING BYPASS (V-05)

execution-routing.ts
  → coordination/tool-coordinator.ts

tool-coordinator.ts
  → coordination/dispatcher-client.ts::dispatchTool()  ✅ (3 hops total)

coordination/dispatcher-client.ts
  → tools/registry/tool-dispatcher.ts           ✅ correct
  ⚠ ALSO adds own telemetry before forwarding (duplicate metrics — V-07)
```

### Verifier Agent
```
verifier-agent.ts
  → execution/verification-runner.ts
  → execution/verification-loop.ts
  → execution/step-runner.ts

step-runner.ts
  → coordination/verification-routing.ts        ⚠ ROUTING BYPASS (V-06)

verification-routing.ts → tool-coordinator.ts

tool-coordinator.ts
  → coordination/dispatcher-client.ts           ✅ (3 hops total)

types/verifier.types.ts
  → tools/verifier/lib/verifier-types.ts        ❌ Agent types depend on tool lib (V-03)
```

### Supervisor Agent
```
supervisor-agent.ts
  → execution/supervision-loop.ts
  → execution/task-runner.ts
  → coordination/supervision-routing.ts
  → coordination/dispatcher-client.ts (resultError helper)

coordination/dispatcher-client.ts
  → tools/registry/tool-dispatcher.ts           ✅ correct
  ⚠ adds own telemetry (V-07)
```

### Planner Agent
```
planner-agent.ts
  → execution/planning-loop.ts

planning-loop.ts
  → coordination/agent-coordinator.ts
  → engine/planning/index.ts                    ⚠ CROSS-LAYER: agent → engine (V-11)

coordination/agent-coordinator.ts
  → coordination/planning-routing.ts
  → coordination/dispatcher-client.ts           ✅ direct
```

### Tool Registry Layer
```
tool-dispatcher.ts
  → tool-resolver.ts
  → tool-metrics.ts
  → tool-security.ts
  → tool-registry.ts                            ✅ correct downward chain

tool-loader.ts
  → filesystem/index.ts, terminal/index.ts, verifier/index.ts
  → browser/index.ts, coding/index.ts
  → tool-registry.ts::sealRegistry()

tool-registry.ts
  → tool-metadata.ts
  → tool-metrics.ts
```

---

## REPORT 2 — FULL EXECUTION CALL GRAPH

```
User Request (Chat)
  │
  ▼
chatOrchestrator → bus event
  │
  ▼
orchestrator.ts::runOrchestration()
  │  validate → buildContext → createSession → runOrchestrationLoop
  ▼
orchestration-loop.ts::runOrchestrationLoop()
  │  buildExecutionPlan → orderWorkflows → loop
  ▼
workflow-runner.ts::runWorkflow()
  │
  ▼
phase-runner.ts::runPhase()
  │  retry wrapper → publishPhaseStarted → dispatchPhaseToAgent
  ▼
agent-coordinator.ts::dispatchPhaseToAgent()
  │  switch(agentType)
  ├──────────────────────────────────────────────────────────────────┐
  │                                                                  │
  ▼  (executor path)                                    (browser path)
executor-agent.ts::runExecutorAgent()           browser-agent.ts::runBrowserLoop()
  │  validate → context → plan → session                │
  ▼                                                     ▼
execution-loop.ts::runExecutionLoop()          browser-loop.ts
  │  task sequence loop                                  │
  ▼                                             ❌ launchBrowser() ← DIRECT TOOL CALL
task-executor.ts::executeTask()                         │
  │  coordinateTask() → build RuntimeStep               ▼
  ▼                                             flow-executor.ts → step-runner.ts
step-runner.ts::runStep()                               │
  │  assertTransition → markRunning → withRetry          ▼
  ▼                                             dispatcher-client.ts ✅
dispatcher-client.ts::execute()                         │
  │  ← SOLE GATEWAY ✅                                   ▼
  ▼                                             tool-dispatcher.ts ✅
tool-dispatcher.ts::dispatch()
  │  resolvePermissions → withRetry → withTimeout
  ├─ recordMetric()
  ├─ recordAudit()
  ▼
tool-registry.ts::getTool()
  ▼
tool.handler(input, context)   ← PRIMITIVE EXECUTION
```

**CoderX execution path (routing bypass):**
```
step-runner.ts
  ↓
coding-routing.ts::routeCodingTask()   ⚠ extra hop
  ↓
dispatcher-client.ts::execute()
  ↓
tool-dispatcher.ts::dispatch()
```

**Terminal/Verifier execution path (2 extra hops):**
```
step-runner.ts
  ↓
execution-routing.ts / verification-routing.ts   ⚠ hop 1
  ↓
tool-coordinator.ts::coordinateX()               ⚠ hop 2
  ↓
dispatcher-client.ts::dispatchTool()
  ↓
tool-dispatcher.ts::dispatch()
```

---

## REPORT 3 — CURRENT SYSTEM LIFECYCLE

### Boot Sequence
```
main.ts
  1. express server starts
  2. runtimeManager.init()         ← load persisted process state
  3. runtimeStore.init()           ← aggregated runtime state
  4. initMemory()                  ← debug recovery memory
  5. observationController.start() ← file + port watchers
  6. initExecutionHistory()
  7. startRecoveryManager()
  8. initOrchestration()
  9. loadAllTools()                ← registers 168 tools, seals registry ✅
 10. initializePlanner()           ← registers event handlers only
 11. initializeExecutor()          ← registers event handlers only
```
Tools registered and sealed BEFORE agents initialize. ✅

### Request Lifecycle (Current)
```
1. User submits goal via Chat
2. chatOrchestrator fires bus event
3. orchestrator.ts picks up → builds OrchestrationContext
4. planning-loop → engine/planning/index.ts (AI analysis) → ExecutionPlan
5. Each phase → agent-coordinator dispatches correct agent
6. Agent runs internal loop → each step goes through dispatcher-client → tool-dispatcher
7. Results aggregated → phase complete → next phase
8. Orchestration complete → response returned
```

### Retry Lifecycle (Current — PROBLEMATIC)
```
Tool call attempt 1
  → agent retry-manager catches failure → delay → attempt 2  (agent level)
  → inside each attempt: tool-dispatcher also retries (tool level)
  
Result: 3 agent attempts × 2 tool attempts = up to 6 actual tool calls per step ⚠
```

### Telemetry Lifecycle (Current — SPLIT)
```
Per tool call (terminal/verifier/supervisor/planner agents):
  1. Agent dispatcher-client records metric BEFORE dispatch
  2. tool-dispatcher records metric AFTER execution
  3. Agent logger records step event separately

Result: 2 metric records per tool call for 4 agents ⚠
```

### Browser Session Lifecycle (Current — VIOLATION)
```
browser-loop.ts directly calls:
  launchBrowser() ← from tools/browser/session/browser-lifecycle.ts
  ...steps via dispatcher ✅
  closeBrowser()  ← from tools/browser/session/browser-lifecycle.ts

No timeout enforcement, no metrics, no audit on session lifecycle ❌
```

---

## REPORT 4 — IDEAL SYSTEM LIFECYCLE

### Ideal Layering Contract
```
Layer              | Owns                                    | Forbidden
─────────────────────────────────────────────────────────────────────────
Orchestration      | workflow sequencing, phase ordering,    | tool execution,
                   | agent selection, escalation             | session management
─────────────────────────────────────────────────────────────────────────
Agent              | workflow execution, session, context,   | tool-registry access,
                   | planning, state, high-level retry       | primitive execution,
                   |                                         | direct tool imports
─────────────────────────────────────────────────────────────────────────
Dispatcher Client  | normalize call → forward to dispatcher, | telemetry recording,
                   | build ToolExecutionContext               | retry logic, timeout
─────────────────────────────────────────────────────────────────────────
Tool Dispatcher    | permission, timeout, retry,             | agent knowledge,
                   | metrics, audit                          | orchestration
─────────────────────────────────────────────────────────────────────────
Tool Registry      | registration, lookup, sealing           | execution, dispatch
─────────────────────────────────────────────────────────────────────────
Tool               | primitive execution only                | agent/orch references
```

### Ideal Execution Flow
```
Orchestrator
  → Agent
    → Loop
      → Step Runner
        → Dispatcher Client (thin pass-through)
          → Tool Dispatcher (owns: timeout, retry, metrics, audit)
            → Tool Registry (owns: lookup)
              → Tool (owns: primitive execution)
```

### Ideal Dispatcher-Client Contract
- One consistent function name across ALL agents: `executeTool(name, input, context)`
- Zero telemetry inside dispatcher-client (tool-dispatcher already handles it)
- Zero retry inside dispatcher-client (belongs in tool-dispatcher OR agent retry-manager — not both)
- Only responsibility: build context + call `dispatch()`

### Ideal Browser Session Lifecycle
```
browser-loop.ts
  → executeTool('browser_launch', input, ctx)   ← via dispatcher-client ✅
  → executeFlow(...)                            ← via dispatcher-client ✅
  → executeTool('browser_close', input, ctx)    ← via dispatcher-client ✅
```

---

## REPORT 5 — ARCHITECTURE VIOLATIONS

| # | Violation | Severity | File | Root Cause | Runtime Impact |
|---|---|---|---|---|---|
| V-01 | Direct tool import in agent loop | 🔴 CRITICAL | `browser/execution/browser-loop.ts:9` | `launchBrowser`/`closeBrowser` imported directly from tool layer | No timeout, no metrics, no audit on browser session lifecycle |
| V-02 | Direct tool import in agent validation | 🔴 HIGH | `browser/validation/state-validator.ts:8` | `hasSession` from `tools/browser/session/browser-context.ts` | Tight coupling to tool internal state |
| V-03 | Agent types depend on tool lib types | 🟠 HIGH | `verifier/types/verifier.types.ts` | Imports from `tools/verifier/lib/verifier-types.ts` | Tool type changes break agent contract |
| V-04 | CoderX routing bypass | 🟠 MEDIUM | `coderx/execution/step-runner.ts:17` | Calls `coding-routing.ts` instead of `dispatcher-client` directly | Extra indirection; coordination re-run |
| V-05 | Terminal routing chain too deep | 🟡 MEDIUM | `terminal/execution/step-runner.ts` | 3-hop chain to dispatcher | Coordination called twice per step |
| V-06 | Verifier routing chain too deep | 🟡 MEDIUM | `verifier/execution/step-runner.ts` | 3-hop chain to dispatcher | Same as V-05 |
| V-07 | Duplicate telemetry in 4 agents | 🟡 MEDIUM | terminal/verifier/supervisor/planner dispatcher-clients | Agent dispatcher-client AND tool-dispatcher both record metrics | Inflated metric counters; misleading dashboards |
| V-08 | Dual retry systems active simultaneously | 🟡 MEDIUM | All agents + `tool-dispatcher.ts` | Agent retry wraps tool-level retry | Up to 6× actual calls per step |
| V-09 | Orphaned execution-routing.ts | 🟢 LOW | `executor/coordination/execution-routing.ts` | No longer imported after step-runner fix | Dead code; maintenance confusion |
| V-10 | Inconsistent dispatcher-client API | 🟢 LOW | All 8 agent dispatcher-clients | 4 different function names | Cognitive overhead; harder to enforce patterns |
| V-11 | Planner imports from engine layer | 🟢 LOW | `planner/execution/planning-loop.ts` | Cross-boundary: agent imports engine utilities | Planning logic split across 2 layers |

---

## REPORT 6 — OWNERSHIP MATRIX

| Subsystem | Current Owner | Correct Owner | Verdict |
|---|---|---|---|
| Browser session lifecycle (launch/close) | `browser-loop.ts` calls tool directly | Should route through dispatcher-client | ❌ WRONG |
| Browser tool execution (click/screenshot) | `browser/dispatcher-client` → tool-dispatcher | Same | ✅ CORRECT |
| Terminal execution | step-runner → 3 hops → dispatcher | step-runner → dispatcher directly | ⚠ OVER-LAYERED |
| File operations | step-runner → routing → operations → dispatcher | Acceptable for multi-step ops | ✅ ACCEPTABLE |
| Coding generation | step-runner → coding-routing → dispatcher | step-runner → dispatcher directly | ⚠ BYPASS |
| Verification execution | step-runner → 3 hops → dispatcher | step-runner → dispatcher directly | ⚠ OVER-LAYERED |
| Tool dispatch (core) | `tool-dispatcher.ts` | Same | ✅ CORRECT |
| Tool metrics | tool-dispatcher + 4 agent clients | tool-dispatcher only | ⚠ SPLIT |
| Tool audit | `tool-dispatcher.ts` | Same | ✅ CORRECT |
| Tool retry | tool-dispatcher + every agent retry-manager | Both layers (different scopes) — but must not compound | ⚠ DUAL |
| Planning logic | planner-agent + engine/planning | planner-agent owns; engine provides utilities | ⚠ SPLIT |
| Agent activation | orchestration/agent-coordinator | Same | ✅ CORRECT |
| Tool registration | tool-loader → tool-registry | Same | ✅ CORRECT |
| Registry sealing | loadAllTools() in main.ts | Same | ✅ CORRECT |

---

## REPORT 7 — FINAL ARCHITECTURE SCORECARD

| Dimension | Score | Notes |
|---|---|---|
| Layering | 6/10 | Solid core chain broken by V-01, V-04, V-05, V-06, V-11 |
| Orchestration purity | 8/10 | Clean workflow/agent separation. agent-coordinator correctly owns activation. |
| Registry purity | 9/10 | Only tool definitions. Sealed after boot. Centralized loading. |
| Dispatcher discipline | 6/10 | tool-dispatcher is clean. Undermined by 4 agents adding telemetry + inconsistent API |
| Ownership purity | 5/10 | Browser lifecycle violation is serious. Dual telemetry. Agent types depend on tool types. |
| Execution isolation | 7/10 | Most agents isolated via dispatcher-client. Browser breaks isolation for session management. Executor now fully clean. |
| Lifecycle clarity | 6/10 | Boot sequence clean. Dual retry creates ambiguity. Browser lifecycle outside tool contract. |
| Runtime stability | 7/10 | Core dispatch chain never-throws. Registry sealed. Browser bypass has no audit trail. |
| Coupling | 5/10 | V-01, V-02, V-03 create tight agent-to-tool coupling. Inconsistent API increases surface. |
| Scalability | 7/10 | Parallel orchestration fabric exists. Run-scoped isolation implemented. Dual retry risky under load. |
| Maintainability | 6/10 | Consistent agent pattern mostly followed. Broken by orphaned file, inconsistent names, 4 non-standard dispatcher-clients. |

**Overall Score: 66/110 (60%)**

---

## PRIORITY FIX PLAN

| Priority | Fix | Target File(s) | Closes |
|---|---|---|---|
| P1 🔴 | Remove direct `launchBrowser`/`closeBrowser` imports — route through dispatcher-client | `browser/execution/browser-loop.ts` | V-01 |
| P2 🟠 | Fix CoderX step-runner to call dispatcher-client directly | `coderx/execution/step-runner.ts` | V-04 |
| P3 🟡 | Fix terminal step-runner to call dispatcher-client directly | `terminal/execution/step-runner.ts` | V-05 |
| P4 🟡 | Fix verifier step-runner to call dispatcher-client directly | `verifier/execution/step-runner.ts` | V-06 |
| P5 🟡 | Remove agent telemetry from 4 dispatcher-clients (tool-dispatcher handles it) | 4x `coordination/dispatcher-client.ts` | V-07 |
| P6 🟠 | Move shared types out of tool lib into agent types | `verifier/types/verifier.types.ts` | V-03 |
| P7 🟢 | Delete orphaned execution-routing.ts | `executor/coordination/execution-routing.ts` | V-09 |
| P8 🟢 | Normalize dispatcher-client API to `executeTool()` across all 8 agents | All `coordination/dispatcher-client.ts` | V-10 |
