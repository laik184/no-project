# REAL SPECIALIST EXECUTION LIFECYCLE
**Date:** 2026-05-24  
**Scope:** Full end-to-end execution lifecycle from API request → LLM call → DAG completion

---

## Complete Execution Flow (Post-Fix)

```
POST /api/orchestration/runs
  { runId, projectId, goal, mode: "planned"|"dag"|"swarm"|"quantum" }
  │
  ▼
executeOrchestration()                          [orchestration-engine.ts]
  │  phases: analyze → plan → route → execute → verify → reflect → score → learn
  │
  ▼
routeExecution(ctx, state)                      [execution-router.ts]
  │  mode: "planned" | "dag"  → executeDAG()
  │  mode: "swarm"            → executeSwarm() → SpecialistDispatcher
  │  mode: "quantum"          → executeQuantum() → runQuantum()
  │  mode: "tool-loop"        → executePlanned() → runAgentLoop() (direct)
  │
  ▼
builderBridge.executeWithDAG({ runId, projectId, plan })   [builder-bridge.ts]
  │
  ▼
runDagGraph(graph)                              [dag-execution-coordinator.ts]
  │  1. validateGraph()
  │  2. graphStateStore.register()
  │  3. createNodeExecutor({ runId, projectId })
  │  4. runGraph(graph, { executor, nodeTimeoutMs: 120s, graphTimeoutMs: 900s })
  │
  ▼
runGraph(graph, opts)                           [graph-engine.ts]
  │  Wave-based parallel execution:
  │  while (!isGraphComplete) {
  │    wave = getNextWave(graph)            ← nodes with all deps satisfied
  │    runParallelBatch(wave, executor)     ← parallel within wave
  │  }
  │
  ▼
createNodeExecutor()                            [node-executor.ts]
  │  node.type === "tool"   → executeTool()
  │  node.type === "agent"  → dispatchAgent()
  │  node.type === "verify" → dispatchVerify()
  │
  ▼  ← CRITICAL FIX AREA ────────────────────────────────────────────────────
  │
dispatchAgent(node, runId, projectId)           [node-executor.ts]
  │  key = `${runId}:${node.id}`
  │  promise = agentPromiseRegistry.register(key, 120_000)
  │  bus.emit("agent.event", { eventType: "dag.agent.execute", payload: { promiseKey: key, goal } })
  │  await promise  ← waits here
  │
  │  ← BEFORE FIX: waited 5 min, resolved { timedOut: true }, continued with garbage
  │
bus.on("agent.event")                           [dag-agent-executor.ts]  ← NEW
  │  filter: event.eventType === "dag.agent.execute"
  │  void executeAgent(event)  ← fire and forget
  │
executeAgent(event)                             [dag-agent-executor.ts]  ← NEW
  │  bus.emit "dag.agent.started"
  │  result = await runAgentLoop({               [tool-loop.agent.ts]
  │    projectId, runId: `${runId}:${nodeId}`,
  │    goal,             ← from node args
  │    maxSteps: 25,
  │    signal: AbortController.signal
  │  })
  │  bus.emit "dag.agent.completed" | "dag.agent.failed"
  │  agentPromiseRegistry.resolve(promiseKey, result)  ← unblocks dispatchAgent
  │
  ▼  ← BACK IN dispatchAgent ────────────────────────────────────────────────
  │
await promise resolves with real result
  │
node marked "completed" with real LLM output
  │
  ▼
Next wave of DAG nodes execute (if any)
  │
  ▼
emitExecutionCompleted()
  │
orchestration-engine continues → verify → reflect → score → learn phases
```

---

## runAgentLoop() Internals                     [tool-loop.agent.ts]

```
runAgentLoop({ projectId, runId, goal, maxSteps, signal })
  │
  ▼
for step in range(maxSteps):
  │
  ├─ hallucination gate check                  [hallucination-gate.ts]
  │    signals = detectFakeDependencies() + detectNonexistentFiles()
  │              + detectFakeCompletion() + detectRepeatedStrategy()
  │    if shouldBlock → trigger reflection → change strategy
  │
  ├─ LLM call (OpenRouter)                     [llm-client.ts]
  │    model: LLM_MODEL (default: openai/gpt-oss-120b:free)
  │    system: tool definitions + project context
  │    user: goal + step history
  │
  ├─ tool execution                            [execute-tool.ts]
  │    security gate check (unless skipSecurity)
  │    file/shell/browser/memory tools
  │
  ├─ hallucination re-check on output
  │
  └─ if stopReason (goal_achieved | max_steps | error) → break
  │
return AgentLoopResult { success, steps, summary, stopReason }
```

---

## AgentPromiseRegistry Lifecycle

```
register(key, timeoutMs)
  │  new Promise((resolve, reject) => { ... })
  │  setTimeout(timeoutMs) → reject(Error("dag_agent_timeout"))  ← FAIL-CLOSED (fixed)
  │  handles.set(key, { resolve, reject, timer })
  │  return promise
  │
resolve(key, value)
  │  clearTimeout(timer)
  │  handles.delete(key)
  │  resolve(value)
  │
reject(key, error)
  │  clearTimeout(timer)
  │  handles.delete(key)
  │  reject(error)
```

---

## Boot Sequence — DAG Executor Wiring

```
server startup
  │
  ▼
main.ts
  ├─ runtimeStore.init()
  ├─ contextRegistry.startSweeper()
  ├─ initOrchestration()              [orchestration/index.ts]
  │    ├─ initExecutionTelemetry()
  │    ├─ initRuntimeSync()
  │    ├─ startLifecycleTracking()
  │    ├─ previewOrchestrator.init()
  │    ├─ recoveryOrchestrator.init()
  │    ├─ orchestratorHub.init()
  │    ├─ initDagExecutors()          ← NEW — subscribes bus event handlers
  │    │    ├─ bus.on("agent.event") → dag.agent.execute handler
  │    │    └─ bus.on("agent.event") → dag.verify.execute handler
  │    └─ distributedOrchestrationWiring.wire()
  ├─ wireCoordinationSSE()
  └─ express server listen :3001
```

---

## Telemetry Events Emitted Per DAG Node Execution

| Event Channel | Event Type | Source | Consumers |
|---|---|---|---|
| `agent.event` | `dag.agent.execute` | node-executor.ts | dag-agent-executor (NEW), SSE clients |
| `agent.event` | `dag.agent.started` | dag-agent-executor | SSE clients, AgentView |
| `agent.event` | `dag.agent.completed` | dag-agent-executor | SSE clients, AgentView |
| `agent.event` | `dag.agent.failed` | dag-agent-executor | SSE clients, AgentView |
| `agent.event` | `dag.verify.execute` | node-executor.ts | dag-verify-executor (NEW), SSE clients |
| `agent.event` | `dag.verify.started` | dag-verify-executor | SSE clients, AgentView |
| `agent.event` | `dag.verify.completed` | dag-verify-executor | SSE clients, AgentView |
| `agent.event` | `dag.verify.failed` | dag-verify-executor | SSE clients, AgentView |
| `runtime.verified` | — | verificationBridge | recovery-orchestrator, preview-orchestrator |

---

## Quantum Path (Also Fixed)

The `quantum` execution mode re-enters the DAG path via:
```
runQuantum() → spawnAndSubmit() → runPath() → builderBridge.executeWithDAG()
```

Since `builderBridge.executeWithDAG()` → `runGraph()` → `createNodeExecutor()` → `dispatchAgent()`, the quantum execution path was also broken before this fix and is now fully functional.
