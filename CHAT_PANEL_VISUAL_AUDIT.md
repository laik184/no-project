# CHAT_PANEL_VISUAL_AUDIT.md

## Files Scanned

### client/src/components/chat/
- `index.tsx` — ChatPanel root, layout shell
- `ChatHeader.tsx` — header bar + chat history panel
- `ChatMessages.tsx` — message list, avatar bubbles, typing indicator
- `ChatInput.tsx` — textarea, send button, file upload popup
- `LiveActionBar.tsx` — ThinkingBubble + LiveActionBar (live tool indicator)
- `ActionGroup.tsx` — routes tool_group messages to SummaryBar / Timeline
- `QuestionCard.tsx` — agent clarification questions
- `ToolGroupLine.tsx` — fallback line for unmapped tools (dropdown detail)
- `useAgentRunner.ts` — run lifecycle, completion message emission
- `agent-event-handler.ts` — SSE event dispatch
- `tool-maps.ts` — TOOL_ICON_MAP, TOOL_COLOR_MAP, TOOL_ANIMATION_MAP, TOOL_EMOJI_MAP
- `types.ts` — ChatMessage union, PlanData, QuestionData

### client/src/components/chat/cards/
- `ActionCardRegistry.tsx` — routes tool → specific card component
- `ActionSummaryBar.tsx` — collapsed header for a tool group (count badges)
- `ActionTimeline.tsx` — expandable list with search for 4+ actions
- `FileOpenCard.tsx` — file.read / file.list card
- `FileWriteCard.tsx` — file.write / patch.queue card
- `TerminalCard.tsx` — shell.exec card with replay
- `PlanningCard.tsx` — execution plan card
- `PackageCard.tsx` — package.install card
- `GitCard.tsx` — git.* card
- `DatabaseCard.tsx` — db.push / db.migrate card
- `DeployCard.tsx` — deploy.publish card
- `ScreenshotCard.tsx` — preview.screenshot card
- `index.ts` — barrel export

### client/src/components/chat/checkpoints/
- `CheckpointTimelineItem.tsx` — chat-inline checkpoint row (collapsed + panels)
- `CheckpointDetailsPanel.tsx` — expanded checkpoint detail
- `CheckpointRollbackDialog.tsx` — rollback confirm UI
- `CheckpointChangesPanel.tsx` — file diff list
- `CheckpointUtils.ts` — formatRelativeTime, triggerLabel
- `index.ts` — barrel export

### client/src/components/panels/
- `CheckpointCard.tsx` — thin wrapper → delegates to CheckpointTimelineItem
- `CheckpointPanel.tsx` — full checkpoint history sidebar panel
- `checkpoint-types.ts` — CheckpointData type

---

## Component Hierarchy

```
ChatPanel (index.tsx)
├── ChatHeader (ChatHeader.tsx)
│   ├── [icon] Sparkles — purple gradient w/ glow
│   ├── [text]  "Agent"
│   └── RealtimeStatusDot
├── ChatHistoryPanel (ChatHeader.tsx)  — shown when showHistoryPanel
└── ChatMessages (ChatMessages.tsx)
    ├── [new-chat screen] MessageSquarePlus icon
    ├── [per message]
    │   ├── user  → bubble (purple tinted bg + border)
    │   ├── agent → AgentMarkdown + stream cursor (#7c8dff)
    │   ├── tool_group → ActionGroup
    │   │   ├── ActionSummaryBar (ActionSummaryBar.tsx)
    │   │   ├── ActionTimeline   (ActionTimeline.tsx)
    │   │   └── renderActionCard → FileWriteCard | TerminalCard | FileOpenCard
    │   │                        | PackageCard | GitCard | DatabaseCard
    │   │                        | DeployCard | ScreenshotCard
    │   │                        | ToolGroupLine (fallback)
    │   ├── diff       → FileDiffCard
    │   ├── checkpoint → CheckpointCard → CheckpointTimelineItem
    │   ├── question   → QuestionCard
    │   └── plan       → PlanningCard
    ├── ThinkingBubble (LiveActionBar.tsx) — analysis.think
    └── LiveActionBar  (LiveActionBar.tsx) — any other live tool
ChatInput (ChatInput.tsx)
├── textarea
├── [+] popup (Upload File / Upload Photo)
├── AgentsButton
└── Send / Stop buttons
```

---

## Color Sources

### Purple / Violet palette (all to be removed/replaced)

| Location | Value | Purpose |
|---|---|---|
| `ChatHeader.tsx` L19 | `linear-gradient(135deg, #7c8dff 0%, #a78bfa 100%)` | Icon bg |
| `ChatHeader.tsx` L19 | `boxShadow: "0 0 8px rgba(124,141,255,0.45)"` | Icon glow |
| `ChatHeader.tsx` L64 | `linear-gradient(135deg, #7c8dff 0%, #a78bfa 100%)` | Active history left bar |
| `ChatHeader.tsx` L61 | `rgba(124,141,255,0.07)` | Active history row bg |
| `ChatMessages.tsx` L93 | `linear-gradient(135deg, #7c8dff 0%, #a78bfa 100%)` | Agent message avatar |
| `ChatMessages.tsx` L105 | `background: "#7c8dff"` | Stream cursor |
| `ChatMessages.tsx` L111 | `rgba(124,141,255,0.18)` bg + `rgba(124,141,255,0.28)` border | User bubble |
| `ChatMessages.tsx` L134 | `linear-gradient(135deg, #7c8dff 0%, #a78bfa 100%)` + glow | Typing avatar |
| `ChatMessages.tsx` L138-143 | `rgba(124,141,255,0.07)` bg + `rgba(167,139,250,0.95)` text + `#a78bfa` dots | Typing bubble |
| `ChatInput.tsx` L54-55 | `rgba(124,141,255,0.4)` border + `rgba(124,141,255,0.08)` glow | Busy input |
| `ChatInput.tsx` L81 | `text-[#7c8dff]` | Upload icon |
| `ChatInput.tsx` L89 | `text-[#a78bfa]` | Photo icon |
| `ChatInput.tsx` L110 | `linear-gradient(135deg, #7c8dff 0%, #a78bfa 100%)` + glow | Send button |
| `LiveActionBar.tsx` L13 | `rgba(167,139,250,0.22)` glow | la-glow-pulse |
| `LiveActionBar.tsx` L32 | `linear-gradient(135deg, #a78bfa 0%, #7c8dff 100%)` | ThinkingBubble avatar |
| `LiveActionBar.tsx` L36-43 | `rgba(167,139,250,0.07/0.2)` bg/border + `#a78bfa` text/dots | ThinkingBubble card |
| `QuestionCard.tsx` L12 | `rgba(124,141,255,0.07)` bg + `rgba(124,141,255,0.2)` border | Card container |
| `QuestionCard.tsx` L15 | `color: "#a78bfa"` | HelpCircle icon |
| `QuestionCard.tsx` L31 | `rgba(124,141,255,0.12)` bg + `rgba(124,141,255,0.28)` border | Option buttons |
| `PlanningCard.tsx` L34 | `rgba(124,141,255,0.05)` bg + `rgba(124,141,255,0.18)` border | Card container |
| `PlanningCard.tsx` L41-42 | `rgba(124,141,255,0.15)` bg + `rgba(124,141,255,0.25)` border + `#7c8dff` icon | ListChecks |
| `PlanningCard.tsx` L11/63 | `#7c8dff` | running step / progress bar |
| `ActionSummaryBar.tsx` L78 | `#7c8dff` | running badge color |
| `FileWriteCard.tsx` L150-164 | `rgba(124,141,255,0.04/0.18/0.1/0.22)` + `#7c8dff` | patch variant colors |
| `CheckpointTimelineItem.tsx` L94 | `rgba(124,141,255,0.07/0.18/0.2/0.4)` + `#7c8dff` | Changes button |

### Green / success (keep — already on-brand)
- `CheckpointTimelineItem` — `rgba(74,222,128,...)` / `#4ade80` ✓
- `TerminalCard` — `rgba(163,230,53,...)` / `#a3e635` ✓
- `FileWriteCard` (non-patch) — `rgba(134,239,172,...)` / `#86efac` ✓
- `PlanningCard` done state — `#4ade80` ✓

---

## Icon Sources

| Component | Icon | Source | Purpose |
|---|---|---|---|
| `ChatHeader.tsx` | `Sparkles` | lucide-react | Header brand icon (glowing purple) |
| `ChatMessages.tsx` | `Bot` | lucide-react | Agent message avatar |
| `ChatMessages.tsx` | `Sparkles` | lucide-react | Typing indicator avatar |
| `ChatMessages.tsx` | `MessageSquarePlus` | lucide-react | New chat screen icon |
| `LiveActionBar.tsx` | `Brain` | lucide-react | ThinkingBubble avatar |
| `QuestionCard.tsx` | `HelpCircle` | lucide-react | Question card marker |
| `PlanningCard.tsx` | `ListChecks` | lucide-react | Plan card header |

---

## Badge Sources

| Component | Badge type | Colors |
|---|---|---|
| `ActionSummaryBar.tsx` | running/failed/done count | running=#7c8dff, failed=#f87171, done=#4ade80 |
| `FileWriteCard.tsx` | lang badge, patch badge | langColor, #7c8dff |
| `TerminalCard.tsx` | exit code badge | #4ade80 (ok) / #f87171 (fail) |
| `PlanningCard.tsx` | complexity badge | rgba(124,141,255,...) |
| `CheckpointTimelineItem.tsx` | "latest" badge | rgba(74,222,128,...) |

---

## Chat Layout Ownership

| Layout zone | Owner |
|---|---|
| Panel shell bg | `index.tsx` — `rgba(255,255,255,0.015)` |
| Header bar | `ChatHeader.tsx` |
| Scrollable message list | `ChatMessages.tsx` — `flex-1 overflow-y-auto px-3 py-3` |
| Input area | `ChatInput.tsx` |
| History overlay | `ChatHistoryPanel` in `ChatHeader.tsx` |

---

## Card Ownership

| Card | Owner file |
|---|---|
| File open / read / list | `FileOpenCard.tsx` |
| File write / patch | `FileWriteCard.tsx` |
| Terminal / shell | `TerminalCard.tsx` |
| Package install | `PackageCard.tsx` |
| Git operations | `GitCard.tsx` |
| Database | `DatabaseCard.tsx` |
| Deploy | `DeployCard.tsx` |
| Screenshot | `ScreenshotCard.tsx` |
| Execution plan | `PlanningCard.tsx` |
| Question | `QuestionCard.tsx` |
| Checkpoint (inline) | `CheckpointTimelineItem.tsx` (via `CheckpointCard.tsx`) |
| Tool group summary | `ActionSummaryBar.tsx` + `ActionTimeline.tsx` |
| Generic fallback | `ToolGroupLine.tsx` |

---

## Theme Ownership

| Theme element | Owner |
|---|---|
| Global CSS vars / dark mode | `client/src/index.css` |
| Tool color map | `chat/tool-maps.ts` — TOOL_COLOR_MAP |
| Purple glow icon (header) | `ChatHeader.tsx` L18-20 |
| Purple user bubble | `ChatMessages.tsx` L111 |
| Purple typing bubble | `ChatMessages.tsx` L134-143 |
| Purple send button | `ChatInput.tsx` L110 |
| Purple ThinkingBubble | `LiveActionBar.tsx` L32-43 |
| Purple question card | `QuestionCard.tsx` L12 |
| Purple planning card | `PlanningCard.tsx` L34 |
| Purple patch card | `FileWriteCard.tsx` L150-164 |
| Purple badges | `ActionSummaryBar.tsx` L78 |
| Purple checkpoint button | `CheckpointTimelineItem.tsx` L94 |

---

## Completion Message Source

`useAgentRunner.ts` L234-245 — lifecycle "completed" status emits:
```
role: "agent", content: `Done — finished **"${msg}"**.`
```
No structured data (files, actions, duration). To be replaced with a `completion` role ChatMessage.
