# CHECKPOINT PRE-IMPLEMENTATION AUDIT

**Scan scope:** `client/src/components/chat/` + `server/chat/` only  
**Date:** 2026-05-31  

---

## 1. FILES SCANNED

### Frontend — `client/src/components/chat/`
| File | Purpose |
|---|---|
| `types.ts` | ChatMessage union + CheckpointData import |
| `agent-event-handler.ts` | SSE event switch — NO checkpoint.created case |
| `useAgentRunner.ts` | Hook coordinating run lifecycle — has checkpoint topic sub |
| `ChatMessages.tsx` | Renders all message roles including checkpoint |
| (all other files) | Action cards, input, headers — no checkpoint involvement |

### Supporting files scanned
| File | Purpose |
|---|---|
| `client/src/components/panels/CheckpointCard.tsx` | Existing chat-inline checkpoint UI |
| `client/src/components/panels/checkpoint-types.ts` | CheckpointData type definition |
| `client/src/components/panels/CheckpointPanel.tsx` | Sidebar panel, uses use-checkpoints hook |
| `client/src/hooks/use-checkpoints.ts` | TanStack Query hooks for /api/checkpoints/* |
| `client/src/components/diff/FileDiffCard.tsx` | FileDiff type + diff renderer |
| `server/chat/index.ts` | Chat module bootstrap, route registration |
| `server/chat/events/run.events.ts` | Run event factories |
| `server/chat/events/timeline.events.ts` | Timeline event factories |
| `server/chat/constants/event.constants.ts` | CHAT_EVENT, BUS_EVENT, CHAT_TOPIC constants |
| `server/chat/realtime/event-publisher.ts` | Wraps bus.emit('agent.event', ...) |
| `server/chat/orchestration/chat-orchestrator.ts` | completeRun — no checkpoint step |
| `server/chat/controllers/run-controller.ts` | Run CRUD controller |
| `server/chat/persistence/run-store.ts` | Run DB reads |
| `server/chat/api/run-start.router.ts` | POST /api/run route |
| `server/chat/api/chat.routes.ts` | /api/chat/* routes |
| `server/chat/types/event.types.ts` | TypeScript event interfaces |
| `server/chat/timeline/timeline-publisher.ts` | Timeline event publisher |
| `server/infrastructure/events/sse/sse-manager.ts` | SSE fan-out; bus.on('checkpoint',...) is wired |
| `server/infrastructure/realtime/stream-topics.ts` | TOPIC.CHECKPOINT = 'checkpoint' |
| `server/infrastructure/index.ts` | Exports bus, db, safeWriteFile, safeDeleteFile |
| `server/infrastructure/checkpoints/safe-fs.util.ts` | safeWriteFile, safeDeleteFile, safeBackup |
| `server/memory/checkpoints/checkpoint-store.ts` | Memory snapshot store (file-based, UNRELATED) |
| `shared/schema.ts` | Drizzle schema — NO agent_checkpoints table |

---

## 2. EXISTING CHECKPOINT ARCHITECTURE

### Frontend

**`types.ts`** (line 34)  
`role: "checkpoint"` is already defined in the `ChatMessage` union. It carries `checkpoint: CheckpointData`.

**`CheckpointData`** (`panels/checkpoint-types.ts`)  
```ts
interface CheckpointData {
  checkpointId: string;
  label:        string;
  description:  string;
  time:         string;
  filesChanged: number;
}
```
Missing: `runId`, `createdFiles[]`, `modifiedFiles[]`, `deletedFiles[]`

**`CheckpointCard.tsx`** (`panels/`)  
Full-featured UI: collapse/expand toggle, Rollback button, View Preview, Change button.  
⚠️ Rollback is **100% local UI state** — `setRevertState("reverted")` after a timeout. No API call.  
⚠️ Changes panel is a static `ACTION_STEPS` list — not real file diffs.

**`useAgentRunner.ts`** (lines 151-161, 186-199)  
Two checkpoint-related flows:

1. **checkpoint topic subscription** (line 151): only handles `eventType === "stable"` — shows a toast. **No handler for `checkpoint.created`.**

2. **lifecycle completion** (line 186-199): on `status === "completed"`, pushes a `role: "checkpoint"` message with:
   - `checkpointId: cp-${Date.now()}` — **fake ID, not persisted**
   - `filesChanged: 0` — **hardcoded**
   - No `runId`, no file lists

**`ChatMessages.tsx`** (line 63-66): renders `role: "checkpoint"` via `CheckpointCard` — correct.

### Backend

**SSE routing** (`infrastructure/events/sse/sse-manager.ts`, line 52-55):
```ts
bus.on(TOPIC.CHECKPOINT, (payload) => {
  broadcastToTopic(TOPIC.CHECKPOINT, payload, projectId, undefined);
});
```
✅ Infrastructure is wired. To emit a checkpoint SSE event: `bus.emit('checkpoint', payload)`.

**`event.constants.ts`**: `BUS_EVENT.CHECKPOINT = 'checkpoint'` and `CHAT_TOPIC.CHECKPOINT = 'checkpoint'` exist but are unused in the chat module.

**`chat-orchestrator.ts` `completeRun`**: Publishes `makeRunCompletedEvent` → goes to `agent.event` bus → fans to `agent` SSE topic. **No checkpoint creation, no checkpoint SSE emission.**

**`eventPublisher`**: Always emits to `'agent.event'` bus key → fans to `agent` topic only. Cannot reach `checkpoint` topic. Must use `bus.emit('checkpoint', ...)` directly.

**`use-checkpoints.ts`** (frontend hook): calls `/api/checkpoints/:pid` and `/api/checkpoints/:pid/:id/rollback` — **these routes DO NOT EXIST in server/chat/ or anywhere on the backend.**

**`server/memory/checkpoints/`**: File-based memory snapshot store. **Completely unrelated** to chat run checkpoints — do not touch.

---

## 3. EXISTING CHAT EVENT FLOW

```
User types msg
  → useAgentRunner.runAgent()
    → POST /api/run → runId
    → subscribe("agent", handler)      ← all agent events
    → subscribe("checkpoint", handler) ← only "stable" events handled
    → subscribe("lifecycle", handler)  ← lifecycle complete events

Agent runs (server)
  → chatOrchestrator.startRun()
    → orchestrate()
      → [tool calls, file writes, LLM calls]
    → chatOrchestrator.completeRun()
      → eventPublisher.publish(makeRunCompletedEvent()) → agent.event bus → agent topic
      ← NO checkpoint event emitted

Lifecycle event
  → frontend lifecycle handler fires
    → pushes role: "checkpoint" message with fake data
```

---

## 4. EXISTING SSE FLOW

```
Server side:
  bus.emit('agent.event', payload)   → sse-manager → TOPIC.AGENT topic
  bus.emit('run.lifecycle', payload) → sse-manager → TOPIC.LIFECYCLE topic
  bus.emit('checkpoint', payload)    → sse-manager → TOPIC.CHECKPOINT topic ✅ (wired, unused)

Client side:
  GET /api/chat/stream?topics=agent,lifecycle,checkpoint
  realtime-provider subscribe("agent", cb)      → agent topic events
  realtime-provider subscribe("lifecycle", cb)  → lifecycle topic events
  realtime-provider subscribe("checkpoint", cb) → checkpoint topic (only "stable" handled)
```

---

## 5. CURRENT CHECKPOINT HANDLERS

| Location | What it handles | Status |
|---|---|---|
| `useAgentRunner.ts:151` | `subscribe("checkpoint")` — `stable` events | Toast only, no message push |
| `useAgentRunner.ts:186` | lifecycle `completed` | Creates fake checkpoint message |
| `CheckpointCard.tsx:21` | Rollback click | UI state only, no API call |
| `CheckpointCard.tsx:31` | Changes click | Flips a boolean, no data |
| Backend | None | No handler, no storage |

---

## 6. MISSING PIECES

| # | Missing Piece | Impact |
|---|---|---|
| 1 | `agent_checkpoints` DB table | Cannot persist checkpoints |
| 2 | `server/chat/types/checkpoint.types.ts` | No typed contract |
| 3 | `server/chat/events/checkpoint.events.ts` | No event factories |
| 4 | `server/chat/persistence/checkpoint-store.ts` | No DB CRUD for checkpoints |
| 5 | `server/chat/controllers/checkpoint-controller.ts` | No request handling |
| 6 | `server/chat/api/checkpoint.routes.ts` | No routes (use-checkpoints hook 404s) |
| 7 | `completeRun` checkpoint step | No checkpoint created on run complete |
| 8 | `bus.emit('checkpoint', ...)` in completeRun | No SSE event reaches frontend |
| 9 | `checkpoint.created` handler in `useAgentRunner.ts` | Frontend ignores real events |
| 10 | `CheckpointData` extended fields | No runId, no file lists in frontend |
| 11 | Real rollback API call in `CheckpointCard` | Rollback is a UI stub |
| 12 | `client/src/components/chat/checkpoints/` folder | All 6 requested components missing |
| 13 | Real file snapshot storage | Cannot perform real rollback |

---

## 7. RECOMMENDED INSERTION POINTS

| Change | File | Where |
|---|---|---|
| New schema table | `shared/schema.ts` | After `deploymentSecrets` block |
| New checkpoint constants | `server/chat/constants/event.constants.ts` | Add to CHAT_EVENT block |
| New types | `server/chat/types/checkpoint.types.ts` | New file |
| New events | `server/chat/events/checkpoint.events.ts` | New file |
| New persistence | `server/chat/persistence/checkpoint-store.ts` | New file |
| New controller | `server/chat/controllers/checkpoint-controller.ts` | New file |
| New routes | `server/chat/api/checkpoint.routes.ts` | New file |
| Emit checkpoint in completeRun | `server/chat/orchestration/chat-orchestrator.ts` | After `eventPublisher.publish(makeRunCompletedEvent(...))` |
| Register routes | `server/chat/index.ts` | After `questionRoutes` registration |
| Extend CheckpointData | `client/src/components/panels/checkpoint-types.ts` | Add optional fields |
| Handle checkpoint.created | `client/src/components/chat/useAgentRunner.ts` | Replace `stable`-only handler |
| Real rollback call | `client/src/components/panels/CheckpointCard.tsx` | `handleRevertClick` confirm branch |
| New chat/checkpoints/ folder | `client/src/components/chat/checkpoints/` | 6 new files |

---

## 8. CONCLUSION

The checkpoint system has a **strong skeleton** on the frontend (type, render, SSE topic subscription) but is **completely hollow** on the backend (no table, no routes, no events). The SSE bus IS wired for the checkpoint topic — it just has nothing to publish. Implementation should follow the insertion points above without rewriting existing plumbing.
