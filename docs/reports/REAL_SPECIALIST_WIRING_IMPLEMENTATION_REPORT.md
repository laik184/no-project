# REAL SPECIALIST WIRING IMPLEMENTATION REPORT
**Date:** 2026-05-24  
**Status:** COMPLETE

---

## Implementation Overview

Four critical production gaps in the DAG/planned execution architecture have been resolved. The implementation follows the existing architectural patterns (bus pub/sub, promise-registry handshake, bridge delegates) and introduces no new dependencies.

---

## Module 1: `server/engine/execution/dag-agent-executor.ts` (NEW)

**Purpose:** Subscribe to `dag.agent.execute` bus events and resolve the DAG promise by running a real agent loop.

**Design decisions:**
- Fire-and-forget dispatch (bus handler returns immediately, agent runs async)
- One `AbortController` per dispatch for per-node cancellation propagation
- Full telemetry lifecycle: `dag.agent.started` → `dag.agent.completed` / `dag.agent.failed`
- Idempotent init (`_wired` guard prevents double-subscription)
- Resolves on success, rejects on error (fail-closed)

**Key contract:**
```
bus "dag.agent.execute" → runAgentLoop({ projectId, runId, goal, maxSteps: 25 }) → agentPromiseRegistry.resolve/reject
```

---

## Module 2: `server/engine/execution/dag-verify-executor.ts` (NEW)

**Purpose:** Subscribe to `dag.verify.execute` events and resolve via `verificationBridge.verify()`.

**Design decisions:**
- Defaults to `["runtime_healthy"]` check if no checks specified in node args
- Fail-closed: verification failure rejects the promise (node fails, retry can fire)
- Passes through `port`, `timeoutMs`, `checks` from the node's `args` payload
- Emits telemetry: `dag.verify.started` → `dag.verify.completed` / `dag.verify.failed`

---

## Module 3: `server/engine/execution/dag-executor-wiring.ts` (NEW)

**Purpose:** Single boot-time entry point aggregating both executor inits.

**Design decisions:**
- Returns a `DagWiringReport` for health-check logging in `initOrchestration()`
- Re-exports both `init*` and `isWired*` helpers for external introspection
- Idempotent: calling multiple times is safe

---

## Fix 4: `server/engine/execution/agent-promise-registry.ts`

**Change:** `setTimeout` handler changed from `resolve({ timedOut: true })` to `reject(new Error("dag_agent_timeout:..."))`

**Why this matters:** The old code made the DAG's `executeNode()` wrapper believe the node completed successfully (no thrown error). The new code causes the node to be marked `"failed"`, which triggers:
1. Node retry (up to `maxRetries` configured on the graph)
2. If retries exhausted: rollback plan activation
3. Proper error propagation to dependent nodes (they get skipped, not corrupted data)

---

## Fix 5: `server/agents/generation/code-gen/agents/code-writer.agent.ts`

**Change:** Re-layered error handling into three categories:

| Error Category | Before | After |
|---|---|---|
| LLM/network/API error | ❌ Silent → placeholder | ✅ Throw — caller retries |
| Missing API key | ❌ Silent → placeholder | ✅ Throw — surface immediately |
| JSON parse error (with fallback paths) | ❌ Silent → placeholder | ✅ Skeleton + `console.warn` |
| JSON parse error (no fallback paths) | ❌ Silent → placeholder | ✅ Throw with message |
| LLM returns empty files array | ❌ Silent → placeholder | ✅ Throw with message |

**Skeleton vs placeholder distinction:** Skeleton files now contain a comment that explicitly identifies them as `// [code-writer] JSON parse fallback` so they cannot be silently merged.

---

## Boot Sequence After Fix

```
main.ts
  └─ initOrchestration()   [server/orchestration/index.ts]
       ├─ initExecutionTelemetry()
       ├─ initRuntimeSync()
       ├─ startLifecycleTracking()
       ├─ previewOrchestrator.init()
       ├─ recoveryOrchestrator.init()
       ├─ orchestratorHub.init()
       ├─ initDagExecutors()              ← NEW
       │    ├─ initDagAgentExecutor()     ← subscribes bus "dag.agent.execute"
       │    └─ initDagVerifyExecutor()    ← subscribes bus "dag.verify.execute"
       └─ distributedOrchestrationWiring.wire()
```

---

## Validation

TypeScript compilation: no new errors introduced.

Functional test path:
1. POST `/api/orchestration/runs` with `mode: "planned"` or `mode: "dag"`
2. DAG builds graph with "agent" type nodes
3. `node-executor.ts` emits `dag.agent.execute`
4. `dag-agent-executor.ts` subscriber fires → `runAgentLoop()` → real LLM call
5. `agentPromiseRegistry.resolve(promiseKey, result)`
6. DAG node completes with real output
7. Downstream nodes receive real data
8. Graph completes — `stopReason: "complete"` (not timeout)
