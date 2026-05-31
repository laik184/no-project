# Replit Action System — Gap Report
**Date:** 2026-05-31  
**Source:** Deep scan of all 11 chat files + 7 adjacent dependencies  
**Status:** Analysis only — NO code changes made

---

## Deep Scan: File-by-File Audit

### `client/src/components/chat/`

---

#### `types.ts` (26 lines)
**Purpose:** Defines the `ChatMessage` discriminated union — the shape of every item in the message list.  
**Who imports it:** `ChatMessages.tsx`, `useAgentRunner.ts`, `agent-event-handler.ts`, `useTokenStream.ts`, `useRunReattach.ts`  
**UI ownership:** None (type-only)  
**Lifecycle stage:** Data model — every render decision depends on this union  
**Replit pattern?** Partially. Has `tool_group`, `diff`, `checkpoint`, `question` — but missing per-type action roles  
**Blocks Replit pattern?** YES — this is the root blocker. Every new card type requires a new union member here  
**Risk:** LOW to add — extending a union is additive and non-breaking  

Current variants:
```
user | agent | tool_group | diff | checkpoint | question
```
Missing variants:
```
plan | terminal | package | screenshot | file_open | file_write_card | git | deploy | database
```

---

#### `ChatMessages.tsx` (143 lines)
**Purpose:** Renders the message list. Dispatches each `ChatMessage` to its renderer. Also renders `ThinkingBubble`, `LiveActionBar`, and the typing indicator based on live state.  
**Who imports it:** `chat/index.tsx` only  
**UI ownership:** Entire scrollable message area. All visual output passes through here.  
**Lifecycle stage:** Render layer — translates state into DOM  
**Replit pattern?** Partially. Has a `role` dispatch switch but only 6 cases. All tool activity collapses to one renderer.  
**Blocks Replit pattern?** YES — the `if (msg.role === "tool_group")` branch must be replaced/extended with a card registry call  
**Risk:** MEDIUM — central file; changes here affect all message rendering  

Currently dispatches:
```
"checkpoint" → CheckpointCard
"diff"       → FileDiffCard (loop)
"question"   → QuestionCard
"tool_group" → ToolGroupLine       ← needs to become renderActionCard()
"agent"      → AgentMarkdown + streaming cursor
"user"       → plain bubble
```

---

#### `ToolGroupLine.tsx` (155 lines)
**Purpose:** Renders a group of completed `AgentStreamItem[]` as a collapsed icon row that expands to a uniform detail panel.  
**Who imports it:** `ChatMessages.tsx` only  
**UI ownership:** All completed tool calls — the entire post-flush action history  
**Lifecycle stage:** Render layer — after flush; history display only  
**Replit pattern?** NO — every tool renders identically. No per-type card layout.  
**Blocks Replit pattern?** YES — this component must become the fallback of a card registry, not the primary renderer  
**Risk:** MEDIUM — heavily used path; must be preserved as fallback and not deleted  

What it renders today:
- Up to 5 icons in a row (collapsed)
- Per-item: icon badge + mono tool chip (Dropdown with docs/run/copy) + content + ✅
- Per-item with `meta.file`: file path row with Dropdown (open in editor / copy path)
- Per-item with `meta.logs`: monospace log block (max 600 chars of raw args JSON)
- NO per-tool-type layout
- NO live output
- NO exit codes
- NO image embeds
- NO progress bars
- NO inline primary CTAs

---

#### `LiveActionBar.tsx` (92 lines)
**Purpose:** Two exports: `ThinkingBubble` (animated brain + dots) and `LiveActionBar` (in-flight action status bar). Both appear below the message list, above the input.  
**Who imports it:** `ChatMessages.tsx` only  
**UI ownership:** The single in-flight status region. Shows only the LATEST active action.  
**Lifecycle stage:** Live state — rendered while `activeAction !== null`  
**Replit pattern?** YES — correct pattern. Single in-flight bar with tool-specific color+animation+emoji.  
**Blocks Replit pattern?** NO — keep as-is. Extend `meta` fields shown if desired.  
**Risk:** LOW — self-contained, no structural changes needed  

---

#### `QuestionCard.tsx` (42 lines)
**Purpose:** Renders the agent's clarification question with option buttons. Mutates to "Answered" state after selection.  
**Who imports it:** `ChatMessages.tsx` only  
**UI ownership:** `role === "question"` messages  
**Lifecycle stage:** Interaction — blocks run continuation until answered  
**Replit pattern?** YES — fully Replit-style. Interactive card, answered state, clear CTA.  
**Blocks Replit pattern?** NO  
**Risk:** LOW — do not touch  

---

#### `agent-event-handler.ts` (290 lines)
**Purpose:** Pure factory function `buildAgentHandler()` — builds the SSE event handler for a specific `runId`. Contains the full `switch(e.eventType)` block. Called once per `runAgent()`.  
**Who imports it:** `useAgentRunner.ts` only  
**UI ownership:** None (logic only) — drives state via setters  
**Lifecycle stage:** Event processing — converts raw SSE events into React state updates  
**Replit pattern?** Partial — handles 22 event types well. Missing tool completion, tool error, live output, per-step plan updates.  
**Blocks Replit pattern?** NO — but needs extension for new event types  
**Risk:** MEDIUM — core event routing; extension is safe; existing cases must not be disturbed  

Currently handled events:
```
agent.stream.start / agent.token / agent.stream.end
agent.thinking / agent.retry
agent.replanning / agent.context_compressed / agent.continuation
agent.tool_call
recovery.started / recovery.completed / recovery.failed
plan.created / plan.progress
phase.started / phase.completed / phase.failed
file.written / diff.queued / file.diff
agent.question / agent.question.answered
agent.message
```

NOT handled (dropped silently):
```
tool.execution topic (subscribed in realtime but never wired)
shell.output / tool.completed / tool.error (backend events not yet emitted)
plan.step.update (backend event not yet emitted)
```

---

#### `useAgentRunner.ts` (219 lines)
**Purpose:** Coordinator hook. Manages run lifecycle: POST /api/run → subscribe topics → handle lifecycle completion. Delegates token streaming to `useTokenStream`, recovery to `useRunReattach`, and event logic to `buildAgentHandler`.  
**Who imports it:** `chat/index.tsx` only  
**UI ownership:** None (logic only)  
**Lifecycle stage:** Run lifecycle — start, wire, teardown  
**Replit pattern?** Partial — subscribes only `"agent"`, `"checkpoint"`, `"lifecycle"` topics. The `"tool.execution"` topic is registered in `realtime-events.ts` but never subscribed here.  
**Blocks Replit pattern?** NO — needs a 4th `subscribe("tool.execution", ...)` call  
**Risk:** MEDIUM — any change to subscription setup needs care  

---

#### `tool-maps.ts` (244 lines)
**Purpose:** Four lookup tables: `TOOL_ICON_MAP`, `TOOL_COLOR_MAP`, `TOOL_EMOJI_MAP`, `TOOL_ANIMATION_MAP`. Maps 36 tool names to visual identity.  
**Who imports it:** `ToolGroupLine.tsx`, `LiveActionBar.tsx`  
**UI ownership:** None (data only)  
**Lifecycle stage:** Visual identity layer  
**Replit pattern?** YES — correct per-tool visual identity. This is the foundation for card styling.  
**Blocks Replit pattern?** NO — all new cards will import from here  
**Risk:** LOW — additive only; no changes needed to existing entries  

**CRITICAL NAMING DISCREPANCY FOUND:**  
`tool-maps.ts` uses `snake_case`: `file_read`, `file_write`, `shell_exec`, `package_install`  
`agent-action-types.ts` uses `dot.notation`: `file.read`, `file.write`, `shell.exec`, `package.install`  
These two systems are disconnected. `AgentActionFeed.tsx` uses dot.notation. The chat system uses snake_case. Any new card registry must normalise to one convention before dispatch.

---

#### `ChatInput.tsx` (121 lines)
**Purpose:** Textarea + send/stop button + file upload popup.  
**Who imports it:** `chat/index.tsx` only  
**UI ownership:** Bottom input bar  
**Lifecycle stage:** Input — user entry point  
**Replit pattern?** Partial. Has stop button. No per-action cancel buttons.  
**Blocks Replit pattern?** NO  
**Risk:** LOW — do not touch for action card work  

---

#### `ChatHeader.tsx` (77 lines)
**Purpose:** Header bar with Agent label, realtime status dot, history toggle, new chat button. Also exports `ChatHistoryPanel`.  
**Who imports it:** `chat/index.tsx` only  
**UI ownership:** Top bar + history slide-in panel  
**Lifecycle stage:** Navigation  
**Replit pattern?** No — no action summary bar in header  
**Blocks Replit pattern?** NO  
**Risk:** LOW — do not touch for action card work  

---

#### `chat/index.tsx` — `ChatPanel` (133 lines)
**Purpose:** Top-level composition shell. Owns the `useAgentRunner` instance, history/prompts queries, new chat screen state, and prop routing.  
**Who imports it:** The workspace layout (CenterPanel or similar)  
**UI ownership:** Full chat column layout  
**Lifecycle stage:** Composition — wires everything together  
**Replit pattern?** Partial  
**Blocks Replit pattern?** NO  
**Risk:** LOW — changes only needed if `ActionSummaryBar` is added to the header region  

---

### Adjacent Dependencies

| File | Lines | Role | Reusable? | Notes |
|---|---|---|---|---|
| `agent/AgentActionFeed.tsx` | 147 | Vertical timeline action feed (separate widget) | YES | Has `ActionRow` with pending/running/done states and connector lines — reuse pattern for `ActionTimeline` |
| `agent/agent-action-types.ts` | 73 | `AgentStreamItem` type + `TOOL_META` map | YES | Uses dot.notation tool names vs chat's snake_case |
| `diff/FileDiffCard.tsx` | 127 | File diff viewer with +/- lines | YES — keep as-is | Needs Accept/Reject buttons only |
| `panels/CheckpointCard.tsx` | 154 | Checkpoint with rollback/preview/change | YES — keep as-is | Rollback is UI-only stub; needs real API |
| `panels/checkpoint-types.ts` | 17 | `CheckpointData` + static `ACTION_STEPS` | YES | `ACTION_STEPS` is hardcoded — not dynamic |
| `realtime/realtime-provider.tsx` | 157 | Single SSE EventSource with topic dispatch | MUST NOT TOUCH | C6 recovery, exponential backoff, stable subscribe |
| `realtime/realtime-events.ts` | 27 | Topic registry | EXTEND ONLY | `tool.execution` topic exists but unused in chat |
| `hooks/useTokenStream.ts` | 61 | RAF-buffered token streaming | MUST NOT TOUCH | Clean, stable, no changes needed |
| `hooks/useRunReattach.ts` | 129 | C6 page-refresh recovery | MUST NOT TOUCH | Fragile — do not modify |

---

## Replit Pattern Mapping

### 🧠 Thinking
**Status:** EXISTS — partial  
**Current:** `ThinkingBubble` (animated brain + 3 dots) shown when `activeAction.tool === "analysis.think"`. Also shown in `LiveActionBar` for non-thinking tools.  
**Missing:** No thinking content — just "Analyzing request and planning steps". Replit shows the actual reasoning step label.  
**File owner:** `LiveActionBar.tsx`  
**Gap:** Minor — add `content` text from `agent.thinking` payload to `ThinkingBubble`  

---

### 📋 Planning
**Status:** PARTIAL — no card  
**Current:** `plan.created` event → plain markdown agent bubble. Text: `"**Execution Plan** · N phases\n\n1. Phase title\n2. Phase title"`. No visual step list. No step state tracking.  
**Missing:** PlanningCard with: step list, current step indicator, progress bar, completed/failed/running state per step, live updates as phases execute  
**File owner:** Would be new `cards/PlanningCard.tsx`  
**Backend gap:** `plan.step.update` event does not exist. Only `plan.created` (initial list) and `plan.progress` (percent) exist.  
**Gap:** CRITICAL — requires new card + new backend event  

---

### 📖 Open File
**Status:** PARTIAL — no dedicated card  
**Current:** `file_read` tool → `agent.tool_call` event → `inflight` item → flushed to `ToolGroupLine` row with file path link  
**Missing:** FileOpenCard with filename, language badge, line count, "Open in editor" as primary CTA  
**File owner:** Would be new `cards/FileOpenCard.tsx`  
**Gap:** HIGH — card layout missing; data available  

---

### 📂 Read File (list/search)
**Status:** PARTIAL — no dedicated card  
**Current:** `file_list` / `file_search` → `ToolGroupLine` row  
**Missing:** Dedicated card showing matched files count, search pattern, results  
**File owner:** Would be handled by `FileOpenCard.tsx` or generic fallback  
**Gap:** MEDIUM  

---

### 📝 Create File
**Status:** PARTIAL — no dedicated card  
**Current:** `file_write` (new file) → `file.written` event → `inflight` with `meta.file` → `ToolGroupLine` row, then `file.diff` → `FileDiffCard`  
**Missing:** FileWriteCard showing: filename, language badge, line count, diff preview inline, "Open in editor" CTA  
**File owner:** Would be new `cards/FileWriteCard.tsx`  
**Gap:** HIGH  

---

### ✏️ Edit File
**Status:** PARTIAL — `FileDiffCard` exists but separate from action flow  
**Current:** `diff.queued` → `inflight` row, then `file.diff` triggers flush + separate `FileDiffCard`. Card has: filename, +/- line counts, expandable diff table, copy button. NO accept/reject buttons.  
**Missing:** Accept/Reject/Apply buttons on `FileDiffCard`. Integration with FileWriteCard for combined action+diff card.  
**File owner:** `diff/FileDiffCard.tsx`  
**Gap:** MEDIUM — add buttons  

---

### 📦 Package Install
**Status:** PARTIAL — no dedicated card  
**Current:** `package_install` → `agent.tool_call` → `inflight` → `ToolGroupLine` row  
**Missing:** PackageCard with: package name(s), install progress spinner, installed count badge, failure badge, npm output snippet  
**File owner:** Would be new `cards/PackageCard.tsx`  
**Backend gap:** No output streaming from `package_install`  
**Gap:** HIGH  

---

### ⚡ Terminal Command
**Status:** PARTIAL — no dedicated card, NO live output  
**Current:** `shell_exec` → `agent.tool_call` → inflight item with `meta.logs = JSON.stringify(args).slice(0,600)`. Args only, no stdout.  
**Missing:** TerminalCard with: command text, live stdout lines, exit code badge, scrollable output, copy button  
**File owner:** Would be new `cards/TerminalCard.tsx`  
**Backend gap:** No `shell.output` event. No exit code on completion. `agent.tool_call` status:"done"/"error" is silently dropped by handler (line 129 of `agent-event-handler.ts`).  
**Gap:** CRITICAL — requires new card + new backend events  

---

### 📸 Screenshot
**Status:** PARTIAL — no image displayed  
**Current:** `preview_screenshot` → `ToolGroupLine` row with `Camera` icon  
**Missing:** ScreenshotCard with: inline `<img>` embed, URL below, "Open in browser" link  
**File owner:** Would be new `cards/ScreenshotCard.tsx`  
**Backend gap:** `preview_screenshot` tool does not pass `imageUrl` in payload  
**Gap:** HIGH  

---

### 🧪 Testing
**Status:** PARTIAL — no dedicated card  
**Current:** `test_run` → `ToolGroupLine` row  
**Missing:** Test results card with: pass count, fail count, test names, error snippets  
**File owner:** Would be new `cards/TestCard.tsx` or handled by `TerminalCard`  
**Gap:** MEDIUM  

---

### 🔄 Fixing (Recovery)
**Status:** PARTIAL — recovery messages only  
**Current:** `recovery.started` → flush + `activeAction` with text. `recovery.completed` → agent message. `recovery.failed` → agent message.  
**Missing:** Visual recovery card with step count, error type, attempt/maxAttempts progress  
**File owner:** Would extend `agent-event-handler.ts` + new `cards/RecoveryCard.tsx`  
**Gap:** MEDIUM  

---

### 🚀 Preview / Deploy
**Status:** PARTIAL — no dedicated card  
**Current:** `preview_url` / `deploy_publish` → `ToolGroupLine` row  
**Missing:** PreviewCard/DeployCard with: URL as clickable link, "Open in browser" CTA, status badge (live/error)  
**File owner:** Would be new `cards/DeployCard.tsx`  
**Gap:** MEDIUM  

---

### ❓ Question
**Status:** FULLY EXISTS — Replit parity  
**Current:** `QuestionCard` with question text, option buttons, answered state  
**Missing:** Nothing  
**File owner:** `chat/QuestionCard.tsx`  
**Gap:** NONE  

---

### ✅ Complete
**Status:** EXISTS — partial parity  
**Current:** `CheckpointCard` with: checkpoint number, description, latest badge, expand (files changed, time, label), rollback/view/change buttons in panel  
**Missing:** Real rollback API call (currently UI-only stub). Real `filesChanged` count (hardcoded 0 from `useAgentRunner`). Dynamic `ACTION_STEPS` (currently hardcoded static list).  
**File owner:** `panels/CheckpointCard.tsx`  
**Gap:** MEDIUM  

---

### ❌ Failed
**Status:** PARTIAL — agent text message only  
**Current:** `recovery.failed` and lifecycle `"failed"` both produce plain agent text messages  
**Missing:** Distinct error card with: error type, truncated error message, "Retry" button, "View logs" CTA  
**File owner:** Would be new `cards/ErrorCard.tsx` or extend agent bubble styling  
**Gap:** LOW  

---

## P0 — Critical Missing Features

### P0.1: ActionCardRegistry
**What:** A dispatch function `renderActionCard(tool, item, onOpenFile)` that maps tool names to dedicated card components. Falls back to `ToolGroupLine` item for unmapped tools.  
**Why critical:** Without this, all other cards are orphaned — there is no routing to them.  
**Location:** New `client/src/components/chat/cards/ActionCardRegistry.tsx`  
**Dependencies:** All card components, `tool-maps.ts`, `ToolGroupLine.tsx`  
**Complexity:** LOW — just a switch/lookup returning JSX  
**Risk:** LOW — additive; `ToolGroupLine` becomes the fallback  

**Blocking issue:** Two tool name conventions must be normalised here:  
- Backend emits snake_case: `shell_exec`, `file_write`, `package_install`  
- `TOOL_META` uses dot.notation: `shell.exec`, `file.write`, `package.install`  
The registry must accept both and normalize.

---

### P0.2: PlanningCard
**What:** A card for `plan.created` that renders a step list with per-step status (pending/running/done/error), current phase highlight, and progress.  
**Why critical:** Plans are currently invisible — rendered as plain markdown. This is the most visually distinctive gap vs. Replit.  
**Location:** New `client/src/components/chat/cards/PlanningCard.tsx`  
**Dependencies:** New `role: "plan"` in `types.ts`. New `plan.step.update` backend event. `agent-event-handler.ts` change for `plan.created`.  
**Complexity:** MEDIUM — new card + new message role + needs backend event  
**Risk:** MEDIUM  

---

### P0.3: Timeline System
**What:** `ActionTimeline.tsx` — a vertical step list (inspired by `AgentActionFeed`'s `ActionRow` pattern) that shows all actions in a run with connector lines, timestamps, and per-step expand.  
**Why critical:** Without a timeline, the action history is a flat collapsed icon row — no narrative of what happened.  
**Location:** New `client/src/components/chat/cards/ActionTimeline.tsx`  
**Dependencies:** `AgentActionFeed.tsx` patterns (reuse `ActionRow` concept). Existing `tool-maps.ts`.  
**Complexity:** MEDIUM  
**Risk:** LOW — new component, no changes to existing  

---

### P0.4: Action Grouping
**What:** Smarter `flushGroup()` strategy. Currently all inflight items flush together into a single `tool_group`. Need to support: (a) single-item groups routed directly to their card type, (b) multi-item groups with a summary bar + expandable timeline.  
**Why critical:** Single `file_write` items should be `FileWriteCard`, not a 1-item `ToolGroupLine`.  
**Location:** `useAgentRunner.ts` (flushGroup logic) + `ChatMessages.tsx` (dispatch)  
**Complexity:** MEDIUM — change to `flushGroup` + new `tool_group` variants or per-item dispatch  
**Risk:** MEDIUM — central dispatch path  

---

### P0.5: Action Status Lifecycle
**What:** Frontend handling of `tool.completed` and `tool.error` events so cards can show final state (exit code, duration, success/fail badge). Currently `status: "done"` in `agent.tool_call` is explicitly dropped.  
**Why critical:** Without completion events, cards are stuck in "running" state and never show their result.  
**Location:** `agent-event-handler.ts` (add handler), `server/` (add events)  
**Backend required:** `tool.completed` / `tool.error` events on `tool.execution` SSE topic  
**Complexity:** MEDIUM  
**Risk:** MEDIUM  

---

## P1 — Important Missing Cards

### P1.1: FileOpenCard
**What:** Card for `file_read` and `file_list` actions. Shows: filename chip, language badge, line count (from meta), "Open in editor" as primary CTA button.  
**Location:** `client/src/components/chat/cards/FileOpenCard.tsx`  
**Dependencies:** `ActionCardRegistry`, `tool-maps.ts` (colors), `onOpenFile` prop  
**Complexity:** LOW — simple layout card  
**Risk:** LOW  
**Data needed:** `meta.file` (already populated), `meta.lineCount` (new field needed)  

---

### P1.2: FileWriteCard
**What:** Card for `file_write` actions. Shows: filename, language badge, +/- line counts, mini diff preview (reuse `FileDiffCard` collapsed), "Open" CTA.  
**Location:** `client/src/components/chat/cards/FileWriteCard.tsx`  
**Dependencies:** `ActionCardRegistry`, `FileDiffCard`, `tool-maps.ts`  
**Complexity:** MEDIUM — needs diff data threaded to the card  
**Risk:** MEDIUM — diff arrives via separate `file.diff` event; card and diff must be co-located or linked  
**Key challenge:** Currently diff and the file_write action are separate message items (tool_group then diff). FileWriteCard needs the diff inlined.  

---

### P1.3: TerminalCard
**What:** Card for `shell_exec`. Shows: command string, scrollable monospace output (live-streaming lines), exit code badge (0 = green, non-0 = red), duration, copy button.  
**Location:** `client/src/components/chat/cards/TerminalCard.tsx`  
**Dependencies:** `ActionCardRegistry`, new `meta.stdout: string[]`, new `meta.exitCode: number`, new `shell.output` backend events  
**Complexity:** HIGH — requires backend output streaming + new event handling  
**Risk:** HIGH — backend changes required  

---

### P1.4: PackageCard
**What:** Card for `package_install` / `package_uninstall`. Shows: package name(s) list, install status badge, count installed/failed.  
**Location:** `client/src/components/chat/cards/PackageCard.tsx`  
**Dependencies:** `ActionCardRegistry`, `meta.packageNames: string[]`, `meta.installStatus`  
**Complexity:** MEDIUM — needs better payload from backend  
**Risk:** MEDIUM  

---

## P2 — Secondary Cards

### P2.1: ScreenshotCard
**What:** Card for `preview_screenshot`. Shows: inline image (`<img>`), URL text, "Open in browser" link.  
**Location:** `client/src/components/chat/cards/ScreenshotCard.tsx`  
**Dependencies:** `meta.imageUrl: string` (new field), `meta.url: string`  
**Complexity:** LOW  
**Risk:** LOW — frontend only once imageUrl is in payload  

### P2.2: GitCard
**What:** Card for `git_commit`, `git_push`, `git_pull`, `git_clone`. Shows: operation, commit hash/message, branch, changed file count.  
**Location:** `client/src/components/chat/cards/GitCard.tsx`  
**Complexity:** LOW  
**Risk:** LOW  

### P2.3: DeployCard
**What:** Card for `deploy_publish`. Shows: deployed URL as clickable link, live/error status badge, "Open" CTA.  
**Location:** `client/src/components/chat/cards/DeployCard.tsx`  
**Complexity:** LOW  
**Risk:** LOW  

### P2.4: DatabaseCard
**What:** Card for `db_push`, `db_migrate`. Shows: operation type, affected tables/migrations, duration.  
**Location:** `client/src/components/chat/cards/DatabaseCard.tsx`  
**Complexity:** LOW  
**Risk:** LOW  

---

## P3 — Analytics & Observability

### P3.1: ActionSummaryBar
**What:** Compact row showing run-level stats: `🧠 📖 📝 ⚡ → N actions · M running · K failed · J done`. Shown in `LiveActionBar` zone or as a persistent header during a run.  
**Location:** `client/src/components/chat/cards/ActionSummaryBar.tsx`  
**Complexity:** LOW  
**Risk:** LOW  

### P3.2: Run Metrics
**What:** After run completes, show: total actions, total files changed, total tokens, duration.  
**Location:** Extend `CheckpointCard` or new `RunSummaryCard`  
**Complexity:** LOW  
**Risk:** LOW  

### P3.3: Performance Badges
**What:** Per-card duration badge (e.g. "243ms") on completed tool cards.  
**Location:** Extend `AgentStreamItem.meta` with `duration?: string`  
**Note:** `meta.duration` already exists in `agent-action-types.ts` but is never populated  
**Complexity:** LOW  
**Risk:** LOW  

---

## Critical Bugs Found During Scan

### Bug 1: tool.execution topic is dead
`realtime-events.ts` registers `TOPIC.TOOL_EXECUTION = "tool.execution"`. `RealtimeProvider` subscribes to all `ALL_TOPICS` on the SSE stream. But `useAgentRunner.ts` never calls `subscribe("tool.execution", …)`. Any events on this topic are parsed by the SSE layer but thrown away. This is the correct channel for P0.5 status lifecycle events.

### Bug 2: tool.completed / tool.error silently dropped
In `agent-event-handler.ts` line 129:
```ts
if (status === "done" || status === "error") break;
```
Completion events from `agent.tool_call` are explicitly discarded. Card status never transitions from "running" to "done" in the inflight Map.

### Bug 3: AgentStreamItem name collision
`AgentActionFeed.tsx` imports `AgentStreamItem` from `./agent-action-types` (dot.notation tools, `meta.progress?: number`). The chat system imports `AgentStreamItem` from `@/components/agent/AgentActionFeed` which re-exports from `agent-action-types`. They are the same type — but `tool-maps.ts` uses snake_case keys that will never match `TOOL_META`'s dot.notation keys. Cards must resolve this.

### Bug 4: CheckpointCard filesChanged always 0
In `useAgentRunner.ts` line 192:
```ts
filesChanged: 0,
```
The actual changed file count is not tracked. `CheckpointCard` always shows "0 files changed".

### Bug 5: CheckpointCard rollback is a stub
`handleRevertClick()` in `CheckpointCard.tsx` only calls `setRevertState("reverted")`. No API call. No actual rollback.

---

## Current vs Target Parity

| Category | Actions | Current | Target | Gap |
|---|---|---|---|---|
| Thinking | 1 | ✅ | ✅ | None |
| Planning | 1 | 20% | 100% | PlanningCard + backend events |
| File Operations | 4 | 30% | 100% | FileOpenCard + FileWriteCard |
| Terminal | 1 | 10% | 100% | TerminalCard + backend streaming |
| Package | 2 | 20% | 100% | PackageCard |
| Screenshot | 1 | 5% | 100% | ScreenshotCard + imageUrl |
| Testing | 1 | 20% | 100% | TerminalCard or TestCard |
| Recovery | 3 | 40% | 100% | RecoveryCard |
| Preview/Deploy | 2 | 15% | 100% | DeployCard |
| Question | 1 | 100% | 100% | None |
| Complete | 1 | 60% | 100% | Real rollback API |
| Failed | 1 | 30% | 100% | ErrorCard |
| Git | 6 | 10% | 100% | GitCard |
| Database | 2 | 10% | 100% | DatabaseCard |

**Estimated current Replit parity: ~25%**  
**Estimated target after P0+P1: ~70%**  
**Estimated target after P0+P1+P2: ~90%**
