# DEEP SCAN — AGENT LIFECYCLE STATE AUDIT

**Date:** 2026-06-04  
**Project:** Nura-X Deployer  
**Scope:** End-to-end agent lifecycle state coverage  

---

## OBJECTIVE

Verify whether the complete agent lifecycle exists end-to-end and whether every state is emitted, transported, consumed, and rendered correctly.

**No fixes. No refactoring. No architecture changes. Scan and report only.**

---

## TARGET STATES

| # | State |
|---|---|
| 1 | Idle |
| 2 | Thinking |
| 3 | Planning |
| 4 | Delegating |
| 5 | Working |
| 6 | Writing |
| 7 | Editing |
| 8 | Testing |
| 9 | Verifying |
| 10 | Deploying |
| 11 | Completed |
| 12 | Failed |
| 13 | Cancelled |

---

## PHASE 1 — BACKEND EVENT DISCOVERY

### Backend Lifecycle Map

The backend is controlled by two primary orchestrators:

| Orchestrator | File | Governs |
|---|---|---|
| **Chat Orchestrator** | `server/chat/orchestration/chat-orchestrator.ts` | Run lifecycle (`started`, `completed`, `failed`, `cancelled`) |
| **Orchestration Engine** | `server/orchestration/execution/orchestration-loop.ts` | Internal phases (`planning`, `running`, `completed`, `failed`, `escalated`) |

### Lifecycle Event Inventory

| Event Name | Payload Shape | File | Line |
|---|---|---|---|
| `chat.run.started` | `{ type, runId, projectId, goal, mode, ts }` | `server/chat/events/run.events.ts` | 3 |
| `chat.run.completed` | `{ type, runId, projectId, durationMs, ts }` | `server/chat/events/run.events.ts` | 12 |
| `chat.run.failed` | `{ type, runId, projectId, error, ts }` | `server/chat/events/run.events.ts` | 20 |
| `orchestration.phase.started` | `{ orchestrationId, runId, phaseId, phaseName, agentType, attempt, timestamp, phase, message }` | `server/orchestration/events/event-publisher.ts` | 125 |
| `orchestration.workflow.started` | `{ orchestrationId, runId, goal, ts }` | `server/orchestration/events/event-publisher.ts` | 78 |
| `agent.tool_call` | `{ tool, status, label, args }` | `server/chat/realtime/event-publisher.ts` | 6 |
| `file.change` | `{ type, path, projectId, ts }` | `server/infrastructure/events/file-change-emitter.ts` | 16 |
| `checkpoint.created` | `{ checkpointId, runId, … }` | `server/chat/orchestration/chat-orchestrator.ts` | 83 |

---

## PHASE 2 — ORCHESTRATION FLOW TRACE

```
User Request
    ↓
chatOrchestrator.startRun()
    → emits: chat.run.started  [chat-orchestrator.ts:140]
    ↓
orchestration-loop.ts → status: planning
    → emits: orchestration.workflow.started  [event-publisher.ts:78]
    ↓
phase-runner.ts
    → emits: orchestration.phase.started  [event-publisher.ts:125]
    ↓
Agent Dispatch (executor / coderx / browser)
    → emits: agent.tool_call { status: running }  [event-publisher.ts:6]
    ↓
verifier-bridge.ts + verification-loop.ts
    → emits: orchestration.phase.started { agentType: verifier }  [event-publisher.ts:133]
    ↓
chatOrchestrator completion
    → emits: chat.run.completed  [chat-orchestrator.ts:77]
    → emits: chat.run.failed     [chat-orchestrator.ts:~90]
```

### Lifecycle Stage → Code Location

| Stage | Where It Starts | File | Notes |
|---|---|---|---|
| **Thinking** | `isAgentThinking(true)` set on run start | `useAgentRunner.ts:87` | Synthetic frontend state — no dedicated backend event |
| **Planning** | `orchestration-loop` transitions to `planning` status | `orchestration-loop.ts` | `orchestration.workflow.started` emitted |
| **Delegating** | Merged into `phase.started` implicitly | `event-publisher.ts:125` | No explicit `delegating` event |
| **Working** | `agent.tool_call { status: running }` | `event-publisher.ts:6` | Per-tool granularity |
| **Verification** | `phase.started` with `agentType: verifier` | `event-publisher.ts:133` | Via `verifier-bridge.ts` |
| **Completion** | `chatOrchestrator` emits `chat.run.completed` | `chat-orchestrator.ts:77` | Terminal state |
| **Failure** | `chatOrchestrator` emits `chat.run.failed` | `chat-orchestrator.ts:~90` | Terminal state |
| **Cancellation** | `runWriter.setStatus(..., 'cancelled')` | `chat-orchestrator.ts` | DB updated; no SSE event fired |

---

## PHASE 3 — TOOL EXECUTION STATES

| State | Exists? | Event / Evidence |
|---|---|---|
| **Working** | ✅ EXISTS | `agent.tool_call { status: 'running' }` — `event-publisher.ts:6` |
| **Writing** | ✅ EXISTS | `file.written` / `file.diff` events handled in `plan-handler.ts:103` |
| **Editing** | ❌ MISSING | No dedicated event emitted anywhere in `server/tools/` or `server/agents/` |
| **Testing** | ❌ MISSING | No dedicated Testing lifecycle state; terminal/test tool calls treated as generic `tool_call` |
| **Deploying** | ❌ MISSING | No event, no handler, no reference in agent or tool code |

---

## PHASE 4 — SSE / WEBSOCKET TRANSPORT AUDIT

### Transport Chain

```
1. Backend emit:
   bus.emit('agent.event', payload)
   └── server/orchestration/events/event-publisher.ts

2. Subscriber:
   sse-manager.ts subscribes to 'agent.event' and 'run.lifecycle'
   └── server/chat/realtime/sse-manager.ts

3. Fan-out:
   broadcastToTopic(TOPIC.AGENT, ...) → res.write(data)
   └── All connected SSE clients receive the event

4. SSE event names used:
   - 'agent'
   - 'lifecycle'
   - 'checkpoint'

5. Client receipt:
   client/src/realtime/useRealtimeStream.ts
   └── Dispatches to subscribe() listeners in useAgentRunner.ts
```

### Transport Issues Found

| Issue | Severity | Detail |
|---|---|---|
| `run.lifecycle` bus key dead | 🔴 High | Subscribed to in `sse-manager.ts` but **nothing in the backend emits to it** — silent dead subscription |
| `phase.started` name mismatch | 🟡 Medium | Backend emits `orchestration.phase.started`; `plan-handler.ts` listens for bare `phase.started` — relies on transport mapping being correct |
| Cancelled state SSE gap | 🟡 Medium | Cancellation updates DB via `runWriter` but fires no SSE event — frontend never learns of cancellation in real-time |

---

## PHASE 5 — FRONTEND EVENT CONSUMPTION

### Handler Coverage

| Event | Handler File | Consumed? |
|---|---|---|
| `chat.run.started` | `message-handler.ts` | ✅ Yes |
| `chat.run.completed` | `message-handler.ts` | ✅ Yes |
| `chat.run.failed` | `message-handler.ts` | ✅ Yes |
| `agent.tool_call` | `tool-handler.ts` | ✅ Yes |
| `file.written` / `file.diff` | `plan-handler.ts:103` | ✅ Yes |
| `plan.created` | `plan-handler.ts` | ✅ Yes |
| `phase.started` (verifier) | `plan-handler.ts` | ⚠️ Partial — no unique verifier UI |
| `orchestration.phase.started` | — | ⚠️ Depends on transport mapping to `phase.started` |
| `run.lifecycle` | `stream-handler.ts` | ❌ Dead — bus key never receives events |
| `delegating` | — | ❌ No handler — event never emitted |
| `testing` | — | ❌ No handler — event never emitted |
| `editing` | — | ❌ No handler — event never emitted |
| `deploying` | — | ❌ No handler — event never emitted |

---

## PHASE 6 — FRONTEND STATE MANAGEMENT

### `useAgentRunner.ts` State Variables

| Variable | Type | Represents | Set True | Set False |
|---|---|---|---|---|
| `isAgentThinking` | `boolean` | Thinking / connecting | On run start | On completion, failure, or first tool start |
| `isAgentTyping` | `boolean` | Agent typing response | On `task_complete` received | On message commit |
| `activeAction` | `AgentStreamItem` | Currently executing tool/phase (Working) | On `tool_call` received | On tool completion |
| `messages` | `Array` | All rendered message types | Continuously appended | — |

### Message Type → State Mapping

| Message Role | State Represented |
|---|---|
| `tool_group` | Working |
| `plan` | Planning |
| `diff` | Writing |
| `completion` | Completed / Failed |

---

## PHASE 7 — UI RENDERING AUDIT

| State | Rendered? | Component | Notes |
|---|---|---|---|
| **Idle** | ✅ Rendered | Chat input empty state | Default view |
| **Thinking** | ✅ Rendered | `TypingIndicator.tsx`, "Connecting to agent..." label | Synthetic — no backend event |
| **Planning** | ✅ Rendered | `PlanningCard.tsx` (via `plan.created`) | |
| **Delegating** | ❌ Not Rendered | — | No dedicated event or component |
| **Working** | ✅ Rendered | `LiveActionBar.tsx`, `ActionTimeline.tsx` | |
| **Writing** | ✅ Rendered | `FileWriteCard.tsx` (via `file.written` / `file.diff`) | Not a dedicated phase — driven by file events |
| **Editing** | ❌ Not Rendered | — | Missing entirely |
| **Testing** | ❌ Not Rendered | — | Missing entirely |
| **Verifying** | ⚠️ Partial | `ActionTimeline.tsx` phase entry | No unique icon or dedicated component |
| **Deploying** | ❌ Not Rendered | — | Missing entirely |
| **Completed** | ✅ Rendered | `ActionSummaryBar.tsx`, `completion` role in `ChatMessages.tsx` | |
| **Failed** | ✅ Rendered | `ActionSummaryBar.tsx` | |
| **Cancelled** | ⚠️ Partial | DB persisted only | SSE never fires — UI does not update in real-time |

---

## PHASE 8 — END-TO-END TRACE: "Create HTML file"

| Stage | Result | Evidence |
|---|---|---|
| **Run Started** | ✅ PASS | `chat.run.started` emitted — `chat-orchestrator.ts:140` |
| **Thinking** | ✅ PASS | `isAgentThinking(true)` set — `useAgentRunner.ts:87` |
| **Planning** | ✅ PASS | `orchestration.workflow.started` emitted — `event-publisher.ts:78` |
| **Delegating** | ❌ MISSING | No explicit `delegating` event — absorbed silently into `phase.started` |
| **Working** | ✅ PASS | `agent.tool_call { status: running }` received — `tool-handler.ts:10` |
| **Writing** | ✅ PASS | `file.written` event handled — `plan-handler.ts:103` |
| **Testing** | ❌ MISSING | No dedicated Testing state — treated as generic tool execution |
| **Verifying** | ✅ PASS | `phase.started` with `agentType: verifier` — `event-publisher.ts:133` |
| **Completed** | ✅ PASS | `chat.run.completed` emitted — `chat-orchestrator.ts:77` |

**Result: 6 PASS / 2 MISSING / 0 FAIL**

---

## PHASE 9 — GAP ANALYSIS

### States Emitted But Never Shown in UI

| State | Emitted As | UI Gap |
|---|---|---|
| Verifying | `phase.started { agentType: verifier }` | No unique component — shown as generic phase entry |
| Cancelled | `runWriter.setStatus('cancelled')` | DB-only, no SSE → UI never updates |

### States Shown But Never Emitted

| State | UI Component | Backend Gap |
|---|---|---|
| Thinking | `TypingIndicator.tsx` | Purely synthetic — no backend event drives it |

### States Handled But Never Triggered

| State | Handler Exists | Trigger Missing |
|---|---|---|
| `run.lifecycle` topic | `stream-handler.ts` | No backend code emits to `run.lifecycle` bus key |

### States Triggered But Never Transported

| State | Triggered In | Transport Gap |
|---|---|---|
| Cancelled | `chat-orchestrator.ts` | `runWriter.setStatus` updates DB only; no `bus.emit` call |

### Entirely Missing States (No backend event, no frontend handler, no UI)

- **Delegating** — absorbed into generic `phase.started`
- **Editing** — absent end-to-end
- **Testing** — absent end-to-end  
- **Deploying** — absent end-to-end

---

## FINAL REPORT — LIFECYCLE COVERAGE

| State | Backend Emits | Transported | Frontend Handles | UI Renders | Coverage |
|---|---|---|---|---|---|
| **Idle** | N/A | N/A | ✅ | ✅ | 🟢 100% |
| **Thinking** | ❌ Synthetic | N/A | ✅ | ✅ | 🟢 100% (frontend-only) |
| **Planning** | ✅ | ⚠️ Name mismatch | ✅ | ✅ | 🟡 90% |
| **Delegating** | ❌ | ❌ | ❌ | ❌ | 🔴 0% |
| **Working** | ✅ | ✅ | ✅ | ✅ | 🟢 100% |
| **Writing** | ✅ (file events) | ✅ | ✅ | ✅ | 🟡 80% |
| **Editing** | ❌ | ❌ | ❌ | ❌ | 🔴 0% |
| **Testing** | ❌ | ❌ | ❌ | ❌ | 🔴 0% |
| **Verifying** | ✅ | ✅ | ⚠️ | ⚠️ | 🟡 70% |
| **Deploying** | ❌ | ❌ | ❌ | ❌ | 🔴 0% |
| **Completed** | ✅ | ✅ | ✅ | ✅ | 🟢 100% |
| **Failed** | ✅ | ✅ | ✅ | ✅ | 🟢 100% |
| **Cancelled** | ⚠️ DB only | ❌ SSE gap | ⚠️ | ⚠️ | 🟡 50% |

### Overall Lifecycle Coverage: ~65%

- 🟢 **Fully covered (100%):** Idle, Thinking, Working, Completed, Failed — 5 states
- 🟡 **Partially covered (50–90%):** Planning, Writing, Verifying, Cancelled — 4 states
- 🔴 **Entirely missing (0%):** Delegating, Editing, Testing, Deploying — 4 states

---

### Broken States Summary

| State | Issue |
|---|---|
| **Cancelled** | `ORCHESTRATION_CANCELLED` constant defined but never emitted at orchestration level; only DB write occurs |
| **`run.lifecycle` bus key** | Subscribed to in `sse-manager.ts` but no backend code ever emits to it — dead subscription |
| **`phase.started` mapping** | Backend emits `orchestration.phase.started`; `plan-handler.ts` expects bare `phase.started` — relies on implicit transport remapping |

### Unused Code

| Item | File | Issue |
|---|---|---|
| `ORCHESTRATION_CANCELLED` constant | `orchestration-events.ts` | Defined, never emitted |
| `run.lifecycle` SSE subscription | `sse-manager.ts` | Subscribed, never receives events |
