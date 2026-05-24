# REAL SPECIALIST WIRING XRAY REPORT
**Date:** 2026-05-24  
**Session:** Production-grade parallel specialist swarm execution — deep audit  
**Scope:** Full codebase XRAY of all DAG/planned execution paths

---

## Executive Summary

Three production-critical gaps were discovered during an ULTRA-DEEP XRAY scan of the Nura-X specialist execution architecture. All three gaps affect the core DAG/planned execution path — the backbone of every non-tool-loop orchestration run. Without these fixes, every DAG mode execution either silently times out or returns fake success.

---

## GAP-001 — CRITICAL: `dispatchAgent()` Promise Never Auto-Resolved

### Location
`server/engine/execution/node-executor.ts` → `dispatchAgent()`

### Root Cause
The function follows a "promise handshake" pattern:
1. Registers a promise via `agentPromiseRegistry.register(key)` (line ~138)
2. Emits `bus.emit("agent.event", { eventType: "dag.agent.execute", payload: { promiseKey: key, goal, ... } })`
3. Awaits the registered promise

**The subscriber side was MISSING.** No module subscribed to `"dag.agent.execute"` events and called `runAgentLoop()`. The `subscription-manager.ts` fans all `"agent.event"` events to SSE clients only — it does NOT execute any agents.

### Resolution Path
The only automatic resolution before this fix was:
- **5-minute timeout** → `resolve({ timedOut: true })` (fake success — DAG node "completed" with no work done)
- **Manual HTTP** → `POST /api/dag/agents/:key/resolve` (unreachable in automated runs)

### Blast Radius
Every execution mode that creates "agent" type DAG nodes:
- `planned` mode via `builderBridge.executeWithDAG()`
- `dag` mode via `runDagFromPlan()`
- `swarm` mode via `specialist-wave-runner.ts`
- `quantum` mode via `quantum-runner.ts → builderBridge.executeWithDAG()`

All four execution modes were broken.

---

## GAP-002 — CRITICAL: `dispatchVerify()` Promise Never Auto-Resolved

### Location
`server/engine/execution/node-executor.ts` → `dispatchVerify()`

### Root Cause
Identical pattern to GAP-001. Emits `"dag.verify.execute"` event, awaits promise. No subscriber existed to call `verificationBridge.verify()`.

### Effect
All DAG "verify" type nodes either:
- Timed out and auto-resolved as fake-pass
- Were silently skipped

---

## GAP-003 — CRITICAL: AgentPromiseRegistry Timeout = Fake Success

### Location
`server/engine/execution/agent-promise-registry.ts`

### Root Cause
The 5-minute timeout guard called `resolve({ timedOut: true })` instead of `reject(new Error(...))`.

**Impact**: The DAG's `executeNode()` wrapper received a result object (not a thrown error), so it classified the node as **"completed"** with output `{ timedOut: true }`. The rollback and retry systems never fired. Downstream nodes that depended on the timed-out agent received `{ timedOut: true }` as their input — corrupting all subsequent DAG execution.

---

## GAP-004 — HIGH: CodeWriterAgent Silent Exception Swallow

### Location
`server/agents/generation/code-gen/agents/code-writer.agent.ts`

### Root Cause
The `write()` method had a broad `catch {}` that swallowed ALL exceptions:
- LLM API errors (4xx, 5xx)
- Network failures
- Missing API key errors
- JSON parse errors

Any failure silently returned `export const placeholder = "Generated fallback for ${path}"` stub code — indistinguishable from real output to the DAG.

---

## System Wiring Gaps (Pre-Fix)

| Event Type | Publisher | Subscriber (BEFORE) | Subscriber (AFTER) |
|---|---|---|---|
| `dag.agent.execute` | `node-executor.ts:dispatchAgent` | ❌ NONE | ✅ `dag-agent-executor.ts` |
| `dag.verify.execute` | `node-executor.ts:dispatchVerify` | ❌ NONE | ✅ `dag-verify-executor.ts` |
| `dag.agent.started` | `dag-agent-executor.ts` | — | ✅ SSE → clients |
| `dag.agent.completed` | `dag-agent-executor.ts` | — | ✅ SSE → clients |
| `dag.verify.started` | `dag-verify-executor.ts` | — | ✅ SSE → clients |
| `dag.verify.completed` | `dag-verify-executor.ts` | — | ✅ SSE → clients |

---

## Affected Execution Modes

| Mode | Before Fix | After Fix |
|---|---|---|
| `tool-loop` | ✅ Real (no DAG nodes) | ✅ Real |
| `planned` | ❌ 5-min timeout → fake success | ✅ Real runAgentLoop() |
| `dag` | ❌ 5-min timeout → fake success | ✅ Real runAgentLoop() |
| `swarm` | ❌ 5-min timeout → fake success | ✅ Real runAgentLoop() |
| `quantum` | ❌ 5-min timeout → fake success | ✅ Real runAgentLoop() |
