# Replit-Style Action System Audit
**Date:** 2026-05-31  
**Scope:** `client/src/components/chat/` × `server/chat/`  
**Purpose:** Document current architecture, identify gaps, and map a concrete path to Replit-style per-action type cards.

---

## 1. Executive Summary

Nura-X already has a functional action-display system: tool calls are collected into an `inflight` Map and flushed as `tool_group` messages rendered by `ToolGroupLine`. A `LiveActionBar` shows the in-flight action. The system handles 20+ event types. However, it renders every action the same way — a collapsed icon row that expands to a uniform detail panel. Replit-style action cards mean each action type (`shell_exec`, `file_write`, `package_install`, `preview_screenshot`, etc.) has a bespoke card with its own layout, inline affordances, and live output. That capability is entirely absent. The gap is architectural — the data is there, the rendering pipeline is not differentiated enough.

---

## 2. Current Frontend Architecture

### 2.1 File Map

| File | Lines | Role |
|---|---|---|
| `chat/index.tsx` | 133 | `ChatPanel` — top-level shell, wires props |
| `chat/ChatHeader.tsx` | 77 | Header bar + `ChatHistoryPanel` drawer |
| `chat/ChatMessages.tsx` | 143 | Message list, dispatches to per-role renderers |
| `chat/ChatInput.tsx` | ~90 | Textarea + send/stop buttons |
| `chat/LiveActionBar.tsx` | 92 | Two components: `ThinkingBubble` + `LiveActionBar` |
| `chat/ToolGroupLine.tsx` | 155 | Collapsed icon row → expandable detail panel |
| `chat/QuestionCard.tsx` | ~80 | Clarification question card with option buttons |
| `chat/useAgentRunner.ts` | 219 | Coordinator hook: run lifecycle, subscriptions, state |
| `chat/agent-event-handler.ts` | 290 | Pure factory for the event `switch` block (per-run) |
| `chat/tool-maps.ts` | 244 | `TOOL_ICON_MAP`, `TOOL_COLOR_MAP`, `TOOL_EMOJI_MAP`, `TOOL_ANIMATION_MAP` |
| `chat/types.ts` | 26 | `ChatMessage` union type + `QuestionData` |

### 2.2 ChatMessage Union Type

```ts
type ChatMessage =
  | { role: "user";       content: string;                        time: string }
  | { role: "agent";      content: string; isStreaming?: boolean; time: string }
  | { role: "tool_group"; actions: AgentStreamItem[];             time: string }
  | { role: "diff";       diffs: FileDiff[];                      time: string }
  | { role: "checkpoint"; checkpoint: CheckpointData;            time: string }
  | { role: "question";   question: QuestionData;                 time: string }
```

Only 6 discriminated variants. Every tool action collapses into `tool_group` — there is no per-tool-type role (e.g., no `"terminal"`, `"package"`, `"screenshot"` roles).

### 2.3 AgentStreamItem Shape (from `AgentActionFeed.ts`)

```ts
interface AgentStreamItem {
  type:    "action";
  tool:    string;         // e.g. "shell_exec", "file_write"
  content: string;         // human-readable label
  status:  "running" | "done" | "error";
  meta?: {
    logs?: string;         // up to 600 chars of args/output
    file?: string;         // file path hint
  };
}
```

The `meta.logs` field is populated with `JSON.stringify(e.payload?.args, null, 2).slice(0, 600)` — raw args only, never live output, never stdout/stderr lines.

### 2.4 Tool Coverage in `tool-maps.ts`

36 tools with icon/color/emoji/animation mappings across 12 categories:

| Category | Tools |
|---|---|
| File | `file_list`, `file_read`, `file_write`, `file_delete`, `file_search`, `file_replace` |
| Shell | `shell_exec` |
| Package | `package_install`, `package_uninstall`, `detect_missing_packages` |
| Server | `server_start`, `server_stop`, `server_restart`, `server_logs` |
| Preview | `preview_url`, `preview_screenshot` |
| Secrets | `env_read`, `env_write` |
| Git | `git_status`, `git_add`, `git_commit`, `git_clone`, `git_push`, `git_pull` |
| Database | `db_push`, `db_migrate` |
| Deploy | `deploy_publish` |
| Test/Debug | `test_run`, `debug_run`, `monitor_check` |
| Browser | `browser_eval` |
| Network/Auth/Security | `api_call`, `search_web`, `auth_login`, `package_audit` |
| Agent Control | `task_complete`, `agent_message`, `agent_question` |
| Virtual | `analysis.think` (not a real backend tool) |

Animation styles: `spin`, `pulse`, `bounce`, `flash`, `ping`, `shake`.

---

## 3. Current Rendering Pipeline

```
SSE / WebSocket
      │
      ▼
useAgentRunner
  ├── subscribe("agent", buildAgentHandler({…}))
  ├── subscribe("checkpoint", …)
  └── subscribe("lifecycle", …)
              │
              ▼
      agent-event-handler.ts
         switch(e.eventType)
              │
      ┌───────┼────────────────────────────┐
      ▼       ▼                            ▼
  setMessages  setActiveAction         flushGroup()
  (push msg)   (LiveActionBar)          (inflight→tool_group)
              │
              ▼
        ChatMessages.tsx
     ┌─────────────────────────────────────┐
     │ role === "user"       → bubble      │
     │ role === "agent"      → markdown    │
     │ role === "tool_group" → ToolGroupLine│
     │ role === "diff"       → FileDiffCard│
     │ role === "checkpoint" → CheckpointCard│
     │ role === "question"   → QuestionCard│
     └─────────────────────────────────────┘
```

### 3.1 tool_group Flush Triggers

`flushGroup()` (which moves `inflight` → `tool_group` message) is called on:
- `agent.replanning` (limitReached branch)
- `recovery.started` and `recovery.completed`
- `file.diff` (always before the diff card)
- `agent.question` (always)
- `agent.message` (always)
- lifecycle `completed` / `failed` / `cancelled` (always)
- `task_complete` tool call (always)

Between flush points, all tool call items accumulate in `inflight` and the last one drives `LiveActionBar`.

### 3.2 ToolGroupLine Rendering

**Collapsed state:** up to 5 tool icons in a row + count/label string + `ChevronDown`.  
**Expanded state:** per-item rows with icon badge + tool chip (monospace) + content + `CheckCircle2`. Items with `meta.file` show a file path row below the content. Each tool chip is a `DropdownMenu` with: View tool docs, View agents inventory, Open source file (if meta.file), Run via backend, Copy tool name.  
**No per-tool-type card layout.** Every item in every `tool_group` renders identically.

### 3.3 LiveActionBar Rendering

Single in-flight status bar above the input. Shows: animated icon + tool name monochip + "Working" label + content text. Animation style per `TOOL_ANIMATION_MAP`. Switches to `ThinkingBubble` when `tool === "analysis.think"`.

---

## 4. Handled Agent Event Types

All handled in `buildAgentHandler` in `agent-event-handler.ts`:

| Event | Frontend Effect |
|---|---|
| `agent.stream.start` | `startStream()` + clears thinking/typing/activeAction |
| `agent.token` | `pushToken(tok)` → streamed into current agent message |
| `agent.stream.end` | `finalizeStream()` |
| `agent.thinking` | `setIsAgentThinking(true)` + `setActiveAction({tool:"analysis.think"})` |
| `agent.retry` | `setActiveAction({tool:"agent.retry", …})` |
| `agent.replanning` | thinking=true; if limitReached → flush+message; else → activeAction |
| `agent.context_compressed` | `setActiveAction({tool:"plan.compress", …})` |
| `agent.continuation` | `setActiveAction({tool:"plan.continue", …})` |
| `agent.tool_call` | `inflight.set(key, item); setActiveAction(item)` — skips if status done/error |
| `recovery.started` | flush + `setIsAgentThinking(true)` + activeAction |
| `recovery.completed` | flush + summary message |
| `recovery.failed` | flush + error message |
| `plan.created` | flush + markdown plan message (plain agent bubble, NOT a plan card) |
| `plan.progress` | `setActiveAction({tool:"plan.phase", …})` |
| `phase.started` | `inflight.set(key, item)` + setActiveAction |
| `phase.completed` | update inflight item to `status:"done"` + setActiveAction(null) |
| `phase.failed` | update inflight item to `status:"error"` + setActiveAction(null) |
| `file.written` | `inflight.set(key, {tool:"file_write", status:"done"})` |
| `diff.queued` | `inflight.set(key, {tool:"patch.queue", status:"done"})` |
| `file.diff` | flush inflight → tool_group; push diff message |
| `agent.question` | flush + push question card |
| `agent.question.answered` | update question card `answered` field + thinking state |
| `agent.message` | finalize stream + flush + push agent message |

Also handled in `useAgentRunner` directly:
- `checkpoint` topic / `stable` eventType → toast notification
- `lifecycle` topic → run teardown + summary message + CheckpointCard

**Not handled / silently dropped:** any event where `e.runId !== runId` (correct dedup), plus all backend `chat.*` domain events (they do not reach the frontend — they stay on the internal bus).

---

## 5. Current Backend Event Architecture

### 5.1 Server-Side Chat Module (64 files across 14 subdirectories)

```
server/chat/
├── orchestration/   chat-orchestrator, conversation/session/turn/stream managers
├── realtime/        sse-manager, websocket-manager, connection-registry,
│                    heartbeat-manager, event-publisher
├── events/          chat.events, run.events, stream.events, question.events, timeline.events
├── types/           event.types, run.types, question.types, message.types, chat.types
├── context/         context-loader, context-builder, context-cache, context-window
├── timeline/        run-timeline, timeline-manager, tool-timeline, event-timeline, timeline-publisher
├── persistence/     run-store, message-store, conversation-store, chat-store, attachment-store
├── questions/       clarification-manager, ambiguity-detector, question-manager, answer-manager
├── messages/        message-builder, user/assistant/system-message, message-validator
├── schemas/         Zod validation for run, question, chat, attachment
├── api/             Express routes: run, question, history, chat, attachment
├── controllers/     run/question/history/chat/attachment controllers
├── attachments/     upload-handler, image/file-processor, attachment-validator, attachment-manager
└── streams/         sse-utils
```

### 5.2 Internal Event Type Taxonomy

**Transport layer** (`event.types.ts`): `ChatEventType` union with 15 values:  
`chat.message.created|updated`, `chat.stream.started|token|ended`, `chat.run.started|completed|failed|cancelled`, `chat.question.asked|answered`, `chat.attachment.uploaded`, `chat.timeline.event`, `chat.turn.started|completed`

**Domain event structs**: `StreamStartedEvent`, `StreamTokenEvent`, `StreamEndedEvent`, `RunStartedEvent`, `RunCompletedEvent`, `RunFailedEvent`, `ChatMessageCreatedEvent`, `ChatMessageUpdatedEvent`, `QuestionAskedEvent`, `QuestionAnsweredEvent`.

**All events publish via:** `eventPublisher.publish(event)` → `bus.emit('agent.event', event)` → infrastructure bus fan-out → SSE to connected clients.

### 5.3 Run Lifecycle

```
POST /api/run
  → chatOrchestrator.startRun()
      1. conversationManager.create()
      2. runManager.register()
      3. sessionManager.open()
      4. turnManager.start()
      5. messageBuilder.buildUser()
      6. eventPublisher.publish(RunStartedEvent)         ← SSE: lifecycle topic
      7. messageBuilder.buildSystem()
      8. clarificationManager.maybeAskClarification()   ← may fire: agent.question
      9. streamManager.open()                           ← SSE: agent.stream.start
     10. contextLoader.loadForRun()
     11. void orchestrate({…}).then(completeRun|failRun) ← background; returns ChatRun
  ← HTTP 200: { ok: true, data: { runId } }

Background:
  orchestrate() fires agent events live as work proceeds
  → completeRun() → RunCompletedEvent → SSE lifecycle: "completed"
  → failRun()     → RunFailedEvent    → SSE lifecycle: "failed"

POST /api/run/:id/cancel
  → chatOrchestrator.cancelRun()
  → SSE lifecycle: "cancelled"

POST /api/chat/answer
  → answerManager → resume blocked clarificationManager
```

### 5.4 Token Streaming

`streamManager.append(runId, token)` publishes `StreamTokenEvent` → bus → SSE.  
Frontend: `agent.stream.start` → `startStream()` (RAF-buffered); `agent.token` → `pushToken(tok)`; `agent.stream.end` → `finalizeStream()`.  
Token buffering uses `useTokenStream` which batch-flushes tokens via `requestAnimationFrame`.

---

## 6. Gap Analysis vs. Replit-Style Action Cards

### 6.1 What Replit Does (reference model)

Replit's agent chat renders different card types per action:
- **Terminal card**: monospace scrollable output window, live-streaming lines, exit-code badge, copy button
- **File write card**: filename + language badge + collapsible diff/content preview, "Open in editor" link
- **Package install card**: package name(s) + progress bar or spinner + installed/failed badge
- **Browser/screenshot card**: inline rendered image thumbnail + URL + "Open in browser" link
- **Plan card**: vertical step-list with check/pending/error state per step, percentage progress bar
- **Search card**: result count + query string + expandable snippet list
- **Database card**: affected rows + query text (truncated) + duration
- **Deploy card**: deploy URL + status badge (live/error)

Each card is visually distinct, renders live output (not just args), and has inline action buttons specific to its type.

### 6.2 Gap Table

| Feature | Current State | Replit Target | Gap |
|---|---|---|---|
| Per-type card layout | ❌ All use same `ToolGroupLine` row | ✅ Bespoke per type | Critical |
| Terminal card with live stdout | ❌ Only arg JSON in `meta.logs` | ✅ Streaming output lines | Critical |
| File write: diff/content preview | ❌ File path link only | ✅ Inline diff snippet | High |
| Package install progress | ❌ Single "running" spinner | ✅ Progress + installed count | High |
| Screenshot inline image | ❌ Tool chip only | ✅ `<img>` embed in card | High |
| Plan card with step list | ❌ Renders as plain markdown agent bubble | ✅ Visual step checklist | High |
| Plan step completion tracking | ❌ `plan.progress` → activeAction only (not persisted) | ✅ Per-step check/pending state | High |
| Tool start / complete / error events | ❌ Only `agent.tool_call` with status field | ✅ Separate start/complete/error events | Medium |
| Live tool output streaming | ❌ Not streamed; only final args | ✅ Progressive output lines | Critical |
| Inline "Open file ↗" per card | ❌ Inside expand panel only | ✅ Primary CTA on card | Medium |
| Checkpoint rollback button | ⚠️ Present in `CheckpointCard` but stub (filesChanged: 0) | ✅ Real restore action | Medium |
| Diff card "Accept/Reject" | ❌ FileDiffCard renders diff only | ✅ Accept/reject buttons | Medium |
| Message type: `"terminal"` role | ❌ Does not exist | ✅ First-class message type | High |
| Message type: `"package"` role | ❌ Does not exist | ✅ First-class message type | High |
| Message type: `"plan"` role | ❌ Does not exist | ✅ First-class message type | High |
| Message type: `"screenshot"` role | ❌ Does not exist | ✅ First-class message type | Medium |
| Tool output attached to `meta.logs` | ⚠️ max 600 chars; only args | ✅ Full stdout + stderr | High |
| Stop button per running action | ❌ Only global stop | ✅ Per-action cancel | Low |
| Retry button on failed action | ❌ None | ✅ Retry CTA on error cards | Low |

### 6.3 Structural Gaps (code-level)

**Backend events missing:**
- `tool.output` or `shell.stdout` event — there is no event type for streaming shell output lines. The only output path is `meta.logs` = serialized args. To show live terminal output, `shell_exec` needs to emit stdout lines as SSE events.
- `tool.complete` / `tool.error` events — `agent.tool_call` conflates start/complete/error via a `status` field. The frontend ignores `status: "done"` and `status: "error"` (explicit break at line 129 of `agent-event-handler.ts`). Completed tool state is never surfaced.
- `plan.step.started` / `plan.step.completed` events — only `plan.created` (list) and `plan.progress` (percent) exist; there is no event that updates an individual step's state.

**Frontend missing:**
- No `CardRegistry` / `renderActionCard(tool, item)` dispatch function. Currently `ToolGroupLine` is one monomorphic component — it would need to be refactored into a card factory.
- No per-type card components: `TerminalCard`, `FileWriteCard`, `PackageCard`, `ScreenshotCard`, `PlanCard`.
- `ChatMessage` union does not have `role: "terminal"`, `"plan"`, `"package"`, `"screenshot"` variants.
- `AgentStreamItem.meta` only has `logs?: string` and `file?: string` — no `stdout?: string[]`, `exitCode?: number`, `imageUrl?: string`, `packageName?: string`, `installCount?: number`.

---

## 7. What Is Already Close to Replit-Style

These pieces are solid and require extension not rewrite:

| What | Why it's already close |
|---|---|
| `TOOL_ICON_MAP` / `TOOL_COLOR_MAP` / `TOOL_ANIMATION_MAP` | Per-tool visual identity already exists — just not applied to bespoke cards |
| `ToolGroupLine` expand panel | Per-item icon badge, color theming, file path row, dropdown actions — the chrome is right |
| `LiveActionBar` | Correct pattern: single in-flight status; already uses per-tool color+animation+emoji |
| `QuestionCard` | Correct Replit-style interaction card with multi-choice options and answered state |
| `FileDiffCard` | Correct type of card; just needs Accept/Reject buttons |
| `CheckpointCard` | Correct pattern; needs real restore functionality |
| `agent.tool_call` inflight Map | Correct accumulator for grouping — the flush granularity just needs to be finer |
| `buildAgentHandler` factory | Clean separation from hook logic; adding new event cases is low-friction |
| `eventPublisher.publish()` | Single publish point for all backend events — easy to add new event factories |

---

## 8. Recommended Action Plan

### Phase 1 — Extend the data model (no visual changes)

1. **Add `meta` fields to `AgentStreamItem`:**
   - `stdout?: string[]` — shell/server log output lines
   - `exitCode?: number` — for terminal cards
   - `imageUrl?: string` — for screenshot cards
   - `packageNames?: string[]` — for package cards
   - `stepList?: { id: string; title: string; status: "pending"|"running"|"done"|"error" }[]` — for plan cards

2. **Add backend events:**
   - `shell.output` — emitted per stdout/stderr line from `shell_exec`
   - `tool.completed` / `tool.error` — explicit completion counterparts to `agent.tool_call` start
   - `plan.step.update` — per-step state change (pending → running → done/error)

3. **Extend `ChatMessage` union:**
   Add `role: "plan"` and `role: "terminal"` variants carrying their domain data.

### Phase 2 — Card registry + per-type components

4. **Create `renderActionCard(tool, item, onOpenFile): ReactNode`** dispatch function in a new `chat/cards/` directory. Falls back to the current `ToolGroupLine` row for unmapped tools.

5. **Implement priority cards first:**
   - `TerminalCard` — monospace box, `meta.stdout` lines, exit code badge, copy button
   - `FileWriteCard` — filename + language badge + mini diff block, "Open" link
   - `PlanCard` (standalone message, not inside `tool_group`) — vertical step list, checkmarks, progress %
   - `PackageCard` — package names + install status badge

6. **Implement secondary cards:**
   - `ScreenshotCard` — `<img>` with fallback, URL, "Open in browser"
   - `GitCard` — commit hash, changed files count
   - `DeployCard` — deploy URL + live/error badge

### Phase 3 — Wire up live output

7. **`shell_exec` tool** needs to emit `shell.output` events (one per stdout line) during execution. `buildAgentHandler` handles them by finding the inflight terminal item and appending to `meta.stdout[]`.

8. **`TerminalCard`** renders `meta.stdout` progressively — new lines animate in via `useEffect` on the array.

---

## 9. Files Requiring Change (by priority)

| File | Change Type |
|---|---|
| `client/src/components/chat/types.ts` | Add `plan` and `terminal` roles to `ChatMessage` union |
| `client/src/components/agent/AgentActionFeed.ts` | Extend `AgentStreamItem.meta` with typed fields |
| `client/src/components/chat/agent-event-handler.ts` | Add handlers for `shell.output`, `tool.completed`, `plan.step.update` |
| `client/src/components/chat/ChatMessages.tsx` | Add `role === "plan"` dispatch to `PlanCard` |
| `client/src/components/chat/tool-maps.ts` | No change needed |
| `client/src/components/chat/ToolGroupLine.tsx` | Refactor to call `renderActionCard` per item |
| `client/src/components/chat/cards/` (new dir) | `TerminalCard`, `FileWriteCard`, `PackageCard`, `PlanCard`, `ScreenshotCard` |
| `server/chat/events/` | New `shell.events.ts` with `shell.output` factory |
| `server/chat/types/event.types.ts` | Add `chat.shell.output`, `chat.tool.completed`, `chat.plan.step.update` to `ChatEventType` |
| Agent executor (`server/agents/executor/` or `server/agents/coder/`) | Emit `shell.output` per stdout line during `shell_exec` |

---

## 10. Non-Issues / Do Not Touch

- **`server/chat/orchestration/chat-orchestrator.ts`** — clean 10-step lifecycle, no changes needed for action cards.
- **`server/chat/realtime/event-publisher.ts`** — single `bus.emit('agent.event', …)` point is correct; new events just need new factory functions, not a different publisher.
- **`useAgentRunner.ts`** — coordinator is clean; the `inflight` Map + `flushGroup()` pattern is correct and extensible.
- **`LiveActionBar.tsx`** — keep as-is; it correctly shows in-flight status. Only extend with richer `meta` display if desired.
- **`QuestionCard.tsx`** — already Replit-style; no changes needed.
- **`CheckpointCard.tsx`** — card chrome is correct; needs real `filesChanged` count and restore endpoint, not a visual redesign.
