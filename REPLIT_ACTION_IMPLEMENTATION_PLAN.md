# Replit Action System — Implementation Plan
**Date:** 2026-05-31  
**Status:** Plan only — NO code changes made  
**Prerequisite:** Read `REPLIT_ACTION_GAP_REPORT.md` first

---

## Files Scanned

| File | Lines | Scanned |
|---|---|---|
| `client/src/components/chat/index.tsx` | 133 | ✅ |
| `client/src/components/chat/ChatHeader.tsx` | 77 | ✅ |
| `client/src/components/chat/ChatMessages.tsx` | 143 | ✅ |
| `client/src/components/chat/ChatInput.tsx` | 121 | ✅ |
| `client/src/components/chat/LiveActionBar.tsx` | 92 | ✅ |
| `client/src/components/chat/ToolGroupLine.tsx` | 155 | ✅ |
| `client/src/components/chat/QuestionCard.tsx` | 42 | ✅ |
| `client/src/components/chat/useAgentRunner.ts` | 219 | ✅ |
| `client/src/components/chat/agent-event-handler.ts` | 290 | ✅ |
| `client/src/components/chat/tool-maps.ts` | 244 | ✅ |
| `client/src/components/chat/types.ts` | 26 | ✅ |
| `client/src/components/agent/AgentActionFeed.tsx` | 147 | ✅ |
| `client/src/components/agent/agent-action-types.ts` | 73 | ✅ |
| `client/src/components/diff/FileDiffCard.tsx` | 127 | ✅ |
| `client/src/components/panels/CheckpointCard.tsx` | 154 | ✅ |
| `client/src/components/panels/checkpoint-types.ts` | 17 | ✅ |
| `client/src/realtime/realtime-provider.tsx` | 157 | ✅ |
| `client/src/realtime/realtime-events.ts` | 27 | ✅ |
| `client/src/hooks/useTokenStream.ts` | 61 | ✅ |
| `client/src/hooks/useRunReattach.ts` | 129 | ✅ |
| **Total** | **2,445** | **20 files** |

---

## Files Reused (Do Not Rewrite)

| File | How Reused |
|---|---|
| `chat/LiveActionBar.tsx` | Keep exactly as-is. Extend only if action `content` text needs truncation. |
| `chat/QuestionCard.tsx` | Keep exactly as-is. Already full Replit parity. |
| `chat/ToolGroupLine.tsx` | Becomes the **fallback** renderer in `ActionCardRegistry`. No structural changes. |
| `chat/tool-maps.ts` | Import `TOOL_ICON_MAP`, `TOOL_COLOR_MAP`, `TOOL_EMOJI_MAP`, `TOOL_ANIMATION_MAP` in all new cards. Add entries for new tools only. |
| `chat/useAgentRunner.ts` | Minimal change: add `subscribe("tool.execution", …)` call. |
| `chat/agent-event-handler.ts` | Extend switch block only. Existing cases untouched. |
| `agent/AgentActionFeed.tsx` | Reuse the `ActionRow` visual pattern (connector lines, status dot, pending/running/done) in `ActionTimeline.tsx`. Do NOT import directly — copy the pattern. |
| `diff/FileDiffCard.tsx` | Import directly in `FileWriteCard.tsx`. Do not modify. |
| `panels/CheckpointCard.tsx` | Keep as-is for now. Wire real rollback in a separate pass. |
| `realtime/realtime-provider.tsx` | DO NOT TOUCH. |
| `hooks/useTokenStream.ts` | DO NOT TOUCH. |
| `hooks/useRunReattach.ts` | DO NOT TOUCH. |

---

## Files Created (New)

```
client/src/components/chat/cards/
├── ActionCardRegistry.tsx      ← P0: dispatch function + fallback
├── PlanningCard.tsx            ← P0: plan step list with live state
├── ActionSummaryBar.tsx        ← P0: icon row + counts (replaces raw ToolGroupLine header)
├── ActionTimeline.tsx          ← P0: vertical step timeline (collapsible)
├── ActionGroup.tsx             ← P0: wraps multi-action flush into summary+timeline
├── FileOpenCard.tsx            ← P1: file read/list card
├── FileWriteCard.tsx           ← P1: file write/create card with diff
├── TerminalCard.tsx            ← P1: shell exec with live output
├── PackageCard.tsx             ← P1: package install/uninstall
├── ScreenshotCard.tsx          ← P2: preview screenshot with image
├── GitCard.tsx                 ← P2: git operation card
├── DeployCard.tsx              ← P2: deploy/preview card
├── DatabaseCard.tsx            ← P2: db push/migrate card
└── index.ts                    ← barrel export
```

**Modified files (minimal, targeted):**
```
client/src/components/chat/types.ts             ← add "plan" role + extend AgentStreamItem meta
client/src/components/chat/ChatMessages.tsx     ← add "plan" role dispatch + tool_group→ActionGroup
client/src/components/chat/agent-event-handler.ts ← plan.created→PlanCard, tool.execution handler
client/src/components/chat/useAgentRunner.ts    ← add tool.execution subscription
```

---

## Architecture Decisions

### Decision 1: ActionCardRegistry as a pure function, not a component

`renderActionCard(tool, item, onOpenFile)` returns `ReactNode`. It is NOT a React component. This keeps it zero-overhead — no wrapper div, no context, no props drilling indirection.

```ts
// cards/ActionCardRegistry.tsx
export function renderActionCard(
  tool: string,
  item: AgentStreamItem,
  onOpenFile?: (path: string) => void,
): ReactNode
```

**Why:** Components require keys, wrappers, and reconciliation overhead. A function that returns JSX is simpler to integrate into `ToolGroupLine` and `ActionGroup`.

---

### Decision 2: Normalise tool names at the registry boundary

The backend emits snake_case (`shell_exec`, `file_write`). `TOOL_META` uses dot.notation (`shell.exec`, `file.write`). The registry normalises at entry:

```ts
function normaliseTool(raw: string): string {
  return raw.replace(/_/g, ".");   // shell_exec → shell.exec
}
```

This fires once per `renderActionCard()` call. All card components receive normalized tool names. No changes to tool-maps.ts or agent-action-types.ts.

---

### Decision 3: ActionGroup replaces the current tool_group message role

The `role: "tool_group"` message currently renders via `ToolGroupLine`. Post-implementation, `ChatMessages.tsx` renders `tool_group` via `<ActionGroup>` which:
1. If group has 1 item: renders `renderActionCard()` directly (no group wrapper)
2. If group has 2–3 items: renders `ActionSummaryBar` (icon row) + inline cards collapsed
3. If group has 4+ items: renders `ActionSummaryBar` + `ActionTimeline` (collapsible)

`ToolGroupLine` remains intact as the fallback inside `ActionCardRegistry` for unmapped tools.

---

### Decision 4: PlanningCard is a first-class message role

`plan.created` currently pushes a `role: "agent"` markdown message. Post-implementation it pushes `role: "plan"` with structured data. `ChatMessages.tsx` dispatches `role === "plan"` to `PlanningCard`.

The plan data shape stored in the message:
```ts
{
  role: "plan";
  plan: {
    phases: number;
    complexity: string;
    appType: string;
    steps: { id: string; title: string; status: "pending" | "running" | "done" | "error" }[];
    risks: string[];
  };
  time: string;
}
```

Steps are updated via a new `plan.step.update` backend event (see backend section). The frontend stores steps in the message list (immutable by role) — updates arrive via a mutation that finds the `role: "plan"` message by `runId` and patches step status.

---

### Decision 5: TerminalCard gets its own message slot

A `shell_exec` action that runs should not be buried in a `tool_group` flush. Strategy:
- When `agent.tool_call` fires with `tool === "shell_exec"`, it goes into `inflight` as usual.
- When `tool.execution` topic fires `{ type: "tool.completed", tool: "shell_exec", exitCode, stdout }`, the inflight item is upgraded and immediately flushed as a single-item group.
- `renderActionCard("shell_exec", item)` → `TerminalCard` with stdout lines + exit code.

This requires the `tool.execution` SSE topic to carry completion payloads. See Backend Plan.

---

### Decision 6: Extend AgentStreamItem.meta — do not create new types

Rather than creating a new type per card, extend the existing `meta` field:

```ts
meta?: {
  // Existing
  duration?: string;
  progress?: number;
  logs?: string;
  file?: string;
  // New
  stdout?: string[];       // terminal output lines
  exitCode?: number;       // terminal exit state
  imageUrl?: string;       // screenshot card
  packageNames?: string[]; // package card
  lineCount?: number;      // file open card
  url?: string;            // preview / deploy card
  commitHash?: string;     // git card
  branch?: string;         // git card
}
```

**Why:** Avoids a discriminated union explosion. All fields are optional. Cards only read the fields they care about.

---

### Decision 7: No LOC limit violations — pre-calculated

Every new file is designed under 250 LOC before writing begins:

| File | Estimated LOC | Design Approach |
|---|---|---|
| `ActionCardRegistry.tsx` | ~80 | Switch + normaliser + fallback |
| `PlanningCard.tsx` | ~140 | Step list + status dots + collapse |
| `ActionSummaryBar.tsx` | ~90 | Icon row + count badges |
| `ActionTimeline.tsx` | ~160 | Vertical step list (reuse ActionRow concept) |
| `ActionGroup.tsx` | ~100 | Dispatch to 1/few/many strategy |
| `FileOpenCard.tsx` | ~80 | Icon + filename + lang badge + CTA |
| `FileWriteCard.tsx` | ~130 | Header + collapsed FileDiffCard |
| `TerminalCard.tsx` | ~180 | Command + output scroll + exit badge |
| `PackageCard.tsx` | ~100 | Package list + status badge |
| `ScreenshotCard.tsx` | ~90 | Image + URL + CTA |
| `GitCard.tsx` | ~80 | Operation + hash + branch + files |
| `DeployCard.tsx` | ~80 | URL link + status badge |
| `DatabaseCard.tsx` | ~80 | Operation + tables + duration |

Modified files will remain under their current line counts (additions offset by removing the `role: "tool_group"` branch from `ChatMessages.tsx` and inlining into `ActionGroup`).

---

## Implementation Order

### Stage 1: Data Foundation (Zero visual change)
**Goal:** Extend types without breaking anything. The UI looks identical after Stage 1.

**Step 1.1 — Extend `AgentStreamItem.meta`**  
File: `client/src/components/agent/agent-action-types.ts`  
Add: `stdout`, `exitCode`, `imageUrl`, `packageNames`, `lineCount`, `url`, `commitHash`, `branch`  
Risk: None (additive only)

**Step 1.2 — Extend `ChatMessage` union**  
File: `client/src/components/chat/types.ts`  
Add: `role: "plan"` variant with `plan: PlanData`  
Risk: Low (additive; existing variants untouched)

**Step 1.3 — Add `PlanData` interface**  
File: `client/src/components/chat/types.ts`  
New interface with steps array + run-level metadata

---

### Stage 2: Core Registry (Zero visual change for existing tools)
**Goal:** Build the dispatch infrastructure. All existing tools continue rendering via `ToolGroupLine` fallback.

**Step 2.1 — Create `ActionCardRegistry.tsx`**  
- `normaliseTool(raw)` helper
- `renderActionCard(tool, item, onOpenFile)` function
- Initially: all tools → fallback (ToolGroupLine item renderer extracted)
- No visual change to existing output

**Step 2.2 — Create `ActionGroup.tsx`**  
- Accepts `actions: AgentStreamItem[]` and `onOpenFile`
- Strategy: 1 item → direct card; 2–3 → summary + inline; 4+ → summary + timeline
- Renders `ActionSummaryBar` (P3, initially just a count badge)

**Step 2.3 — Update `ChatMessages.tsx`**  
- `role === "tool_group"` → `<ActionGroup actions={msg.actions} onOpenFile={onOpenFile} />`
- Visual output identical to current `ToolGroupLine` (since registry falls back)

**Step 2.4 — Add `role: "plan"` dispatch in `ChatMessages.tsx`**  
- `role === "plan"` → `<PlanningCard plan={msg.plan} />` (card not yet built, stub with agent bubble)
- Update `agent-event-handler.ts`: `plan.created` pushes `role: "plan"` instead of `role: "agent"`

---

### Stage 3: P0 Cards (Visual impact: PlanningCard)
**Goal:** First visible Replit-style card — the Planning card.

**Step 3.1 — Create `PlanningCard.tsx`**  
- Props: `plan: PlanData`
- Renders: title row, step list (pending/running/done/error per step), progress bar
- Each step: connector line + status dot + emoji + label (reuse `AgentActionFeed` visual language)
- Expandable: collapsed shows current step + progress; expanded shows all steps

**Step 3.2 — Wire `plan.step.update` event** (see Backend Plan)  
- `agent-event-handler.ts`: new `"plan.step.update"` case
- Finds the `role: "plan"` message in state and patches the step status
- Uses `setMessages(prev => prev.map(m => m.role === "plan" ? patch(m) : m))`

**Step 3.3 — Create `ActionSummaryBar.tsx`**  
- Icon row (up to 5 tool icons) + "N actions" count
- Running/failed/done badges
- Click to expand `ActionTimeline`

**Step 3.4 — Create `ActionTimeline.tsx`**  
- Vertical ordered list of all actions in a group
- Per-item: status dot + icon + tool chip + content + duration badge
- Collapsible with chevron

---

### Stage 4: P1 Cards (Visual impact: file/terminal/package cards)
**Goal:** Most common actions get bespoke cards.

**Step 4.1 — FileOpenCard**  
- Triggers on: `file_read`, `file_list`, `file_search`  
- Map in registry: `file.read | file.list | file.search → FileOpenCard`  
- Shows: `FileText` icon + filename + language badge + line count (if `meta.lineCount`) + "Open" CTA button

**Step 4.2 — FileWriteCard**  
- Triggers on: `file_write`, `file_replace`, `file.create`  
- Shows: `FileCode` icon + filename + language badge + status badge (created/modified) + collapsed `FileDiffCard`  
- **Design challenge:** The diff data currently arrives as a separate `file.diff` event, not inside the tool action's meta. Options:  
  a. Thread the diff into the tool item's `meta` when `diff.queued` fires (preferred)  
  b. Keep diff as a separate message but link to the preceding FileWriteCard (complex)  
  **Decision: Option A** — when `diff.queued` fires, find the latest `file_write` inflight item for that path and add `meta.diff` to it. `file.diff` still flushes the group, but now the diff is embedded in the FileWriteCard.

**Step 4.3 — TerminalCard**  
- Triggers on: `shell_exec`  
- Shows: command text (from meta.logs parsed as args.command) + stdout scroll area + exit code badge  
- Live mode: while `status === "running"`, renders a mini terminal with animated cursor  
- Requires: `tool.execution` events with stdout + exitCode (see Backend Plan)

**Step 4.4 — PackageCard**  
- Triggers on: `package_install`, `package_uninstall`, `detect_missing_packages`  
- Shows: `Package` icon + package name list (from `meta.packageNames`) + count badge + status (installing/installed/failed)

---

### Stage 5: P2 Cards
**Goal:** Cover remaining tool types.

**Step 5.1 — ScreenshotCard**  
- Triggers on: `preview_screenshot`  
- Shows: `<img src={meta.imageUrl}>` with fallback skeleton + URL chip + "Open" CTA

**Step 5.2 — GitCard**  
- Triggers on: `git_commit`, `git_push`, `git_pull`, `git_clone`, `git_add`  
- Shows: `GitBranch` icon + operation badge + commit hash (if `meta.commitHash`) + branch (if `meta.branch`) + files count

**Step 5.3 — DeployCard**  
- Triggers on: `deploy_publish`, `preview_url`  
- Shows: `Globe` icon + URL as clickable link + status badge (live/pending/error) + "Open" CTA

**Step 5.4 — DatabaseCard**  
- Triggers on: `db_push`, `db_migrate`  
- Shows: `Database` icon + operation type + tables affected + duration badge

---

### Stage 6: P3 Analytics
**Goal:** Add run-level summary and per-card timing.

**Step 6.1 — ActionSummaryBar enrichment**  
- Wire actual run-level action counts from `useAgentRunner` state
- Show: running count (animated dot) + failed count (red badge) + done count (green)

**Step 6.2 — Duration badges**  
- `meta.duration` already in `AgentStreamItem` — never populated. Wire backend to include duration in `tool.completed` payload.

**Step 6.3 — Run metrics in CheckpointCard**  
- Real `filesChanged` count (track via `file.written` events in `useAgentRunner`)
- Real rollback API call: `POST /api/run/:checkpointId/restore`

---

## Backend Plan

### Backend Change 1: `tool.execution` SSE topic
**File:** Somewhere in `server/agents/executor/` or the tool execution layer  
**What:** Emit events on the `tool.execution` SSE topic (already registered in `realtime-events.ts`) for tool lifecycle.

Event shapes needed:
```ts
// When tool starts executing
{ eventType: "tool.started",   runId, tool, args, ts }

// When tool completes successfully
{ eventType: "tool.completed", runId, tool, exitCode?: number, duration: number, ts }

// When tool fails
{ eventType: "tool.error",     runId, tool, error: string, exitCode?: number, duration: number, ts }

// For shell_exec: one per stdout/stderr line
{ eventType: "shell.output",   runId, tool: "shell_exec", line: string, stream: "stdout"|"stderr", ts }
```

**Why `tool.execution` topic:** Separate from `agent` topic to avoid polluting the main event stream. Frontend subscribes specifically for this.

---

### Backend Change 2: `plan.step.update` event
**File:** Plan execution layer (wherever phase completion is tracked)  
**What:** Emit on the `agent` topic (existing) when a plan step changes state.

```ts
{ eventType: "plan.step.update", runId, stepId: string, status: "running"|"done"|"error", ts }
```

**Where to emit:** When `phase.started` fires, also emit `plan.step.update` with `status: "running"`. When `phase.completed` fires, emit `plan.step.update` with `status: "done"`. When `phase.failed`, emit with `status: "error"`.

**Why separate from phase events:** Phase events are structural (inflight management). Step updates are UI state (PlanningCard patches). They serve different purposes.

---

### Backend Change 3: Enrich `agent.tool_call` payload
**File:** Wherever `agent.tool_call` is emitted  
**What:** Add structured fields to the payload so card components have something to show.

For `shell_exec`:
```ts
payload: { tool: "shell_exec", args: { command: string }, label, status }
```

For `package_install`:
```ts
payload: { tool: "package_install", args: { packages: string[] }, label, status }
```

For `preview_screenshot`:
```ts
payload: { tool: "preview_screenshot", args: {}, result: { imageUrl: string, url: string }, status }
```

For file operations:
```ts
payload: { tool: "file_write", args: { path: string, lineCount?: number }, label, status }
```

---

## Risk Assessment

| Item | Risk | Mitigation |
|---|---|---|
| `ActionCardRegistry` routing | LOW | Falls back to `ToolGroupLine` for every unmapped tool |
| `ChatMessages.tsx` `tool_group` change | MEDIUM | `ActionGroup` uses same `ToolGroupLine` fallback; identical output until new cards are wired |
| `plan.created` → `role: "plan"` migration | MEDIUM | Both `agent-event-handler.ts` and `ChatMessages.tsx` change in same commit; risk is rendering regression on plan events |
| Tool name normalisation | MEDIUM | snake_case→dot.notation has edge cases (`file.written`, `patch.queue` virtual names that don't appear in TOOL_META) |
| `file.diff` + `FileWriteCard` co-location | HIGH | Threading diff data into inflight item requires careful ordering; if `diff.queued` fires after the inflight item is already flushed, the link is lost |
| `TerminalCard` live output | HIGH | Requires backend changes; frontend card must handle both modes (no-output and streaming-output) gracefully |
| `CheckpointCard` real rollback | HIGH | Requires API route and checkpoint persistence — out of scope for this implementation phase |
| `AgentStreamItem.meta` extension | LOW | All new fields are optional; existing code reading `meta.logs` and `meta.file` is unaffected |
| LOC limits | LOW | All files pre-calculated under 250 lines |

---

## Implementation Rules

1. **Deep scan before each stage** — re-read the target file before editing
2. **One feature at a time** — complete + verify each step before the next
3. **Fallback first** — the registry fallback must work before any card is wired
4. **No file > 250 LOC** — pre-calculate before writing
5. **No rewriting working components** — only extend or wrap
6. **Preserve existing functionality** — all current event handlers stay unchanged
7. **Type-safe at every boundary** — no `any` in new code
8. **All new components get `data-testid` attributes**
9. **CSS animations via `<style>` tags** (existing pattern; no Tailwind animation classes for complex keyframes)
10. **Tool name normalisation happens once** — in `ActionCardRegistry`, not in each card

---

## Expected Replit Parity

### Before (current state)
- Thinking: ✅ 100%
- Planning: 20% (plain text)
- File operations: 30% (filename link only)
- Terminal: 10% (args only, no output)
- Package: 20% (running state only)
- Screenshot: 5% (icon only)
- Question: ✅ 100%
- Checkpoint/Complete: 60% (stub rollback)
- Recovery/Failed: 30% (text only)
- Git/DB/Deploy: 10% (icon row only)

**Overall estimate: ~28%**

---

### After P0 + Stage 1–3
- Thinking: ✅ 100%
- Planning: ✅ 90% (live step updates)
- File operations: 30% (unchanged until P1)
- Terminal: 10% (unchanged until P1+backend)
- Package: 20% (unchanged until P1)
- Screenshot: 5% (unchanged until P2)
- Question: ✅ 100%
- Checkpoint: 60% (unchanged)
- Action grouping: ✅ 85%

**Overall estimate: ~48%**

---

### After P1 + Stage 4
- File operations: ✅ 85%
- Terminal: 70% (card exists; full output needs backend)
- Package: ✅ 80%
- Git/Deploy: 15% (not yet)

**Overall estimate: ~67%**

---

### After P2 + Stage 5
- Screenshot: ✅ 80% (needs imageUrl from backend)
- Git: ✅ 75%
- Deploy: ✅ 80%
- Database: ✅ 75%

**Overall estimate: ~82%**

---

### After P3 + Stage 6
- Duration badges: ✅
- Run metrics: ✅
- Real rollback: ✅ (if backend work done)
- ActionSummaryBar: ✅

**Overall estimate: ~92%**

---

## Target Directory Structure

```
client/src/components/chat/
├── index.tsx                        KEEP — minimal change if ActionSummaryBar added
├── ChatHeader.tsx                   KEEP — no change
├── ChatMessages.tsx                 MODIFY — add "plan" dispatch, tool_group → ActionGroup
├── ChatInput.tsx                    KEEP — no change
├── LiveActionBar.tsx                KEEP — no change
├── ToolGroupLine.tsx                KEEP — becomes fallback in registry
├── QuestionCard.tsx                 KEEP — no change
├── useAgentRunner.ts                MODIFY — add tool.execution subscription
├── agent-event-handler.ts          MODIFY — extend switch block only
├── tool-maps.ts                     KEEP — additive entries only
├── types.ts                         MODIFY — add "plan" role + extend meta
└── cards/
    ├── index.ts                     NEW — barrel exports
    ├── ActionCardRegistry.tsx       NEW — renderActionCard() dispatch
    ├── ActionGroup.tsx              NEW — 1/few/many strategy wrapper
    ├── ActionSummaryBar.tsx         NEW — icon row + count badges
    ├── ActionTimeline.tsx           NEW — vertical step list
    ├── PlanningCard.tsx             NEW — plan step list with live state
    ├── FileOpenCard.tsx             NEW — file read/list card
    ├── FileWriteCard.tsx            NEW — file write with diff
    ├── TerminalCard.tsx             NEW — shell output card
    ├── PackageCard.tsx              NEW — package install card
    ├── ScreenshotCard.tsx           NEW — screenshot with image
    ├── GitCard.tsx                  NEW — git operation card
    ├── DeployCard.tsx               NEW — deploy/preview card
    └── DatabaseCard.tsx             NEW — db operation card
```

---

## Quick Reference: What Triggers What

```
SSE event                →  Frontend handling              →  Card component
─────────────────────────────────────────────────────────────────────────────
plan.created             →  push role:"plan"               →  PlanningCard
plan.step.update (new)   →  patch role:"plan" steps        →  PlanningCard (live)

agent.tool_call
  shell_exec             →  inflight + activeAction        →  TerminalCard (on flush)
  file_write             →  inflight + activeAction        →  FileWriteCard (on flush)
  file_read              →  inflight + activeAction        →  FileOpenCard (on flush)
  package_install        →  inflight + activeAction        →  PackageCard (on flush)
  preview_screenshot     →  inflight + activeAction        →  ScreenshotCard (on flush)
  git_*                  →  inflight + activeAction        →  GitCard (on flush)
  deploy_publish         →  inflight + activeAction        →  DeployCard (on flush)
  db_push/migrate        →  inflight + activeAction        →  DatabaseCard (on flush)
  [any other]            →  inflight + activeAction        →  ToolGroupLine (fallback)

tool.execution (new sub)
  tool.completed         →  update inflight meta (exitCode,duration)  →  card shows result
  tool.error             →  update inflight meta (error,exitCode)      →  card shows error
  shell.output           →  append to inflight meta.stdout             →  TerminalCard live

file.diff                →  flush group → ActionGroup      →  ActionGroup + diff message

agent.question           →  flush → role:"question"        →  QuestionCard (unchanged)
lifecycle.completed      →  flush → role:"checkpoint"      →  CheckpointCard (unchanged)
```

---

## Checklist Before Starting Implementation

- [ ] Read `REPLIT_ACTION_GAP_REPORT.md` fully
- [ ] Read `REPLIT_ACTION_IMPLEMENTATION_PLAN.md` fully (this file)
- [ ] Re-read `client/src/components/chat/types.ts` (current state)
- [ ] Re-read `client/src/components/agent/agent-action-types.ts` (current meta shape)
- [ ] Re-read `client/src/components/chat/ChatMessages.tsx` (current dispatch)
- [ ] Re-read `client/src/components/chat/agent-event-handler.ts` (current switch cases)
- [ ] Confirm `tool.execution` SSE topic is wired on backend before implementing TerminalCard
- [ ] Start with Stage 1 (types extension) — zero visual change gate
- [ ] Verify app still builds after each stage before proceeding
