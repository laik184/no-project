# CHAT_ACTION_UI_AUDIT

## Files Scanned

### client/src/components/chat/
| File | Role |
|------|------|
| `tool-maps.ts` | Icon map, color map, emoji map, animation map for all tools |
| `ToolGroupLine.tsx` | Fallback row for unmapped tools — expandable detail panel |
| `ActionGroup.tsx` | Smart container routing 1 / 2-3 / 4+ actions to correct layout |
| `LiveActionBar.tsx` | Live "Thinking" / "Working" bubble during agent run |
| `ChatMessages.tsx` | Message list renderer |
| `ChatInput.tsx` | Input field |
| `ChatHeader.tsx` | Header bar |

### client/src/components/chat/cards/
| File | Role |
|------|------|
| `ActionCardRegistry.tsx` | Routes tool name → specific card component |
| `ActionSummaryBar.tsx` | Compact icon strip + action count for grouped actions |
| `ActionTimeline.tsx` | Collapsible full list of actions with search/filter |
| `FileOpenCard.tsx` | Rendered for file.read / file.list / file.search |
| `FileWriteCard.tsx` | Rendered for file.write / patch.queue / diff.queued |
| `TerminalCard.tsx` | Rendered for shell.exec / console.run |
| `PackageCard.tsx` | Rendered for package.install / uninstall / detect |
| `GitCard.tsx` | Rendered for git.* tools |
| `DeployCard.tsx` | Rendered for deploy.publish |
| `DatabaseCard.tsx` | Rendered for db.push / db.migrate |
| `ScreenshotCard.tsx` | Rendered for screenshot.capture / preview.screenshot |
| `PlanningCard.tsx` | Rendered for planning tool — step list with progress |

### client/src/components/chat/checkpoints/
| File | Role |
|------|------|
| `CheckpointTimelineItem.tsx` | Collapsed/expanded checkpoint row |
| `CheckpointDetailsPanel.tsx` | Files changed breakdown |
| `CheckpointRollbackDialog.tsx` | Rollback confirmation |
| `CheckpointChangesPanel.tsx` | Changed file list |
| `CheckpointUtils.ts` | Time formatting, trigger labels |

### client/src/components/panels/
| File | Role |
|------|------|
| `CheckpointCard.tsx` | Thin wrapper delegating to CheckpointTimelineItem |
| `CheckpointPanel.tsx` | Side-panel checkpoint history |
| `checkpoint-types.ts` | CheckpointData type |

---

## Component Hierarchy

```
ChatMessages
  └── ActionGroup                    ← routes by count
        ├── [1 action]  renderActionCard → specific card | ToolGroupLine
        ├── [2-3]       ActionSummaryBar + cards
        └── [4+]        ActionSummaryBar + ActionTimeline
              └── ActionTimeline
                    └── renderActionCard | ToolGroupLine

  └── CheckpointCard
        └── CheckpointTimelineItem
              ├── CheckpointDetailsPanel
              ├── CheckpointRollbackDialog
              └── CheckpointChangesPanel

  └── LiveActionBar / ThinkingBubble   ← shown during active run

Cards:
  FileOpenCard, FileWriteCard, TerminalCard
  PackageCard, GitCard, DeployCard
  DatabaseCard, ScreenshotCard, PlanningCard
```

---

## Issues Found

### 1. Action Icons
- `analysis.think` mapped to `Brain` ✓ but color is purple `#a78bfa` — should be blue `#3b82f6`
- `file_read` / `file_list` mapped to `FileText` — spec says `BookOpen`
- `deploy_publish` mapped to `Globe` — spec says `Rocket`
- `shell_exec` mapped to `TerminalSquare` — spec says `Terminal`

### 2. ToolGroupLine
- Fallback color for unknown tools is `#a78bfa` (purple) — needs neutral blue
- Inner detail panel uses `rgba(255,255,255,0.025)` background — too subtle, needs `#111827`
- Border `rgba(255,255,255,0.07)` — replace with `#1f2937`

### 3. ActionSummaryBar
- Icon containers have no background/border — icons float without visual grouping
- Action count text too small at 11px and muted — needs readable weight
- Missing proper status indicator pill (running = animated dot)
- CountBadge font-size 9px with opacity tricks — replace with proper semantic badges

### 4. ActionTimeline
- Toggle button is purely text, no left border/vertical timeline decoration
- No status dots per action row
- No running animation on active items
- Collapsed state shows plain text only

### 5. PlanningCard
- Already decent structure but uses `#111827` background and `#263244` border — need to update border to `#1f2937`
- Step rows have no left timeline connector
- `ListChecks` icon — replace with `Brain` for planning

### 6. All Tool Cards (excessive accent colors)
- `FileOpenCard`: cyan-tinted background `rgba(125,211,252,0.05)` — replace with neutral
- `TerminalCard`: lime green `rgba(163,230,53,0.04)` tint — replace with neutral
- `ScreenshotCard`: pink `rgba(244,114,182,0.04)` tint — replace with neutral
- `PackageCard`: orange `rgba(251,146,60,0.04)` tint — replace with neutral
- `GitCard`, `DatabaseCard`, `DeployCard`: all have colored tint backgrounds

### 7. CheckpointCard
- Already Replit-style via CheckpointTimelineItem — largely acceptable
- Border should use `#1f2937` instead of `rgba(74,222,128,0.18)`

### 8. LiveActionBar / ThinkingBubble
- `ThinkingBubble` uses `#1A2230` icon bg — update to `#1f2937`
- Tool name chip in LiveActionBar is colored — replace with neutral gray chip

---

## Planned Changes
- `tool-maps.ts`: Fix 3 icon mappings + neutralize purple color
- `ActionSummaryBar.tsx`: Better icon containers, status badge, proper count label
- `ActionTimeline.tsx`: Vertical timeline with status dots + animation
- `ToolGroupLine.tsx`: Neutral dark theme, remove purple fallback
- `PlanningCard.tsx`: Timeline connector, Brain icon, `#1f2937` borders
- `FileOpenCard.tsx`: Neutral card bg + BookOpen icon
- `FileWriteCard.tsx`: Neutral card bg
- `TerminalCard.tsx`: Neutral card bg, keep lime for prompt text only
- `PackageCard.tsx`: Neutral card bg
- `GitCard.tsx`: Neutral card bg
- `DeployCard.tsx`: Rocket icon, neutral card bg
- `DatabaseCard.tsx`: Neutral card bg
- `ScreenshotCard.tsx`: Neutral card bg
- `CheckpointTimelineItem.tsx`: Update border to `#1f2937`
- `LiveActionBar.tsx`: Neutral chip, `#1f2937` borders
