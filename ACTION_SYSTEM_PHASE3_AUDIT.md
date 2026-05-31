# ACTION SYSTEM PHASE 3 — PRE-IMPLEMENTATION AUDIT

**Date:** 2026-05-31  
**Status:** COMPLETE — ready to implement

---

## 1. Files Scanned

### Frontend — client/src/components/chat/
| File | Exports | Role |
|---|---|---|
| `index.tsx` | `ChatPanel` | Top-level chat layout |
| `ChatMessages.tsx` | `ChatMessages` | Message role dispatcher |
| `ActionGroup.tsx` | `ActionGroup` | 1/2-3/4+ action router |
| `ActionSummaryBar.tsx` (cards/) | `ActionSummaryBar` | Compact action header |
| `ActionTimeline.tsx` (cards/) | `ActionTimeline` | Expandable 4+ action list |
| `ActionCardRegistry.tsx` (cards/) | `renderActionCard`, `normalizeTool` | Tool→card router |
| `FileWriteCard.tsx` | `FileWriteCard` | file.write/patch.queue |
| `GitCard.tsx` | `GitCard` | git.* tools |
| `DeployCard.tsx` | `DeployCard` | deploy.publish |
| `ScreenshotCard.tsx` | `ScreenshotCard` | screenshot.capture |
| `TerminalCard.tsx` | `TerminalCard` | shell.exec |
| `PlanningCard.tsx` | `PlanningCard` | plan role messages |
| `types.ts` | `ChatMessage`, `PlanData`, `PlanStep` | Chat type contracts |
| `tool-maps.ts` | `TOOL_ICON_MAP`, `TOOL_COLOR_MAP` | Tool → icon/color |

### Frontend — client/src/components/diff/
| File | Exports | Role |
|---|---|---|
| `agent-diff-viewer.tsx` | `AgentDiffViewer` (default) | Standalone accept/reject (isolated) |
| `DiffPanel.tsx` | `DiffPanel` (default) | Patch list + preview panel |
| `diff-viewer.tsx` | default | Simple line-by-line diff renderer |
| `FileDiffCard.tsx` | `FileDiffCard` | Single file diff UI |
| `DiffPreviewModal.tsx` | `DiffPreviewModal` | Modal diff preview |
| `PatchList.tsx` | `PatchList` | Patch selection list |
| `FileOperationList.tsx` | `FileOperationList` | Created/Modified/Deleted list |

### Server — server/chat/
| File | Purpose |
|---|---|
| `timeline/event-timeline.ts` | In-memory `TimelineEntry` store per run |
| `timeline/tool-timeline.ts` | Tool lifecycle helpers (recordStarted/Completed/Failed) |
| `timeline/timeline-publisher.ts` | Publishes entries to SSE via eventPublisher |
| `events/timeline.events.ts` | `makeTimelinePublishedEvent` factory |
| `types/event.types.ts` | `ChatEvent`, stream/run event interfaces |
| `realtime/event-publisher.ts` | `bus.emit('agent.event', ...)` |
| `realtime/sse-manager.ts` | SSE fan-out listener |

---

## 2. Current Architecture

### SSE Flow (unchanged by Phase 3)
```
toolTimeline.recordCompleted(runId, entryId, result)
  → eventTimeline.updateStatus + entry.meta enrichment
  → timelinePublisher.publish(runId, projectId, entry)
    → eventPublisher.publish(makeTimelinePublishedEvent(...))
      → bus.emit('agent.event', event)
        → sse-manager fan-out
          → frontend useRealtimeEvent / useRealtimeTopic
```

### Card Rendering Flow
```
ChatMessages (role = 'tool_group')
  → ActionGroup(actions)
    → 1 action:  renderActionCard → specific card or ToolGroupLine
    → 2-3:       ActionSummaryBar + per-card rendering
    → 4+:        ActionSummaryBar + ActionTimeline (collapsed)
```

### AgentStreamItem Meta Fields (used by cards)
```typescript
item.meta = {
  // FileWriteCard
  file?:        string;     // file path
  logs?:        string;     // raw diff text (lines starting with +/-)
  original?:    string;     // original content (patch.queue)
  proposed?:    string;     // proposed content (patch.queue)

  // ScreenshotCard
  imageUrl?:    string;     // URL to rendered image
  imageData?:   string;     // base64 image (NOT currently populated)
  url?:         string;     // page URL

  // GitCard
  branch?:      string;     // branch name (NOT currently from result)
  commitHash?:  string;     // SHA (NOT currently from result)

  // DeployCard
  url?:         string;     // deployed URL (NOT currently from result)
  environment?: string;     // environment label

  // TerminalCard
  stdout?:      string[];   // output lines
  exitCode?:    number;
  durationMs?:  number;
}
```

---

## 3. Bugs & Gaps

| # | Task | Gap | Impact |
|---|---|---|---|
| T1 | Diff Accept/Reject | `agent-diff-viewer.tsx` is disconnected; uses `any`, `alert()`, raw styles. `FileWriteCard` shows patch.queue items with no accept/reject. | AI diffs always silently discarded — no user control |
| T2 | Screenshot Backend | `entry.meta.result` is NOT unwrapped to `entry.meta.imageUrl/imageData`. `ScreenshotCard` renders empty (no image). | Screenshots never display in chat |
| T3 | Git Metadata | Git result fields (`commitHash`, `branch`) sit in `entry.meta.result` (nested), not in `entry.meta` where `GitCard` reads them. | GitCard never shows branch/SHA |
| T4 | Deploy Metadata | Deploy result `url` sits in `entry.meta.result` (nested). `DeployCard` reads `item.meta?.url` which is undefined. | DeployCard never shows URL or "Open" button |
| T5 | Timeline Search | `ActionTimeline` has no search/filter. 4+ action groups are a flat scroll with no way to find a specific tool. | Poor UX for long runs |
| T6 | Terminal Replay | `TerminalCard` shows static stdout. No way to replay the output as a live stream. | Output appears abruptly, no visual storytelling |
| T7 | Card Animations | All cards render instantly. No enter animation on any card, summary bar, or timeline item. | Jarring appearance, no visual feedback |

---

## 4. Insertion Points

### Backend: `server/chat/timeline/tool-timeline.ts`
- `recordCompleted` — extend to unwrap git/deploy/screenshot result fields into top-level `entry.meta`
- No callers broken (signature unchanged)

### Frontend: individual card files
- `FileWriteCard.tsx` — add accept/reject bar for `patch.queue`/`diff.queued` tools
- `ScreenshotCard.tsx` — handle `imageData` (base64) + loading skeleton
- `GitCard.tsx` — display file changed count from `meta.filesChanged`
- `DeployCard.tsx` — display environment badge + "Copied" URL button
- `ActionTimeline.tsx` — add search input + filtered render
- `TerminalCard.tsx` — add replay button + line-by-line animation

### Global animation: `client/src/index.css` (or inline `<style>` tag)
- Add `@keyframes card-enter` + `@keyframes card-stagger` for card entry

---

## 5. Constraints

- **Do NOT rewrite**: `ActionCardRegistry`, `ActionGroup`, `PlanningCard`, `ActionSummaryBar`
- **Extend only**: `tool-timeline.ts` (additive enrichment, no signature changes)
- **Preserve SSE flow**: no new bus topics or SSE routes
- **Type-safe**: no `any` in new code
- **Architecture**: all changes are additive to existing modules

---

## 6. Implementation Order

```
T2/T3/T4 backend (tool-timeline enrichment)   → parallel, no deps
T1 frontend (FileWriteCard diff UI)            → no backend dep
T5 frontend (ActionTimeline search)            → no dep
T6 frontend (TerminalCard replay)              → no dep
T7 frontend (card animations)                 → no dep
T2 frontend (ScreenshotCard imageData)        → after backend T2
```

---

## 7. Replit Parity Estimate (Before)

| Feature | Status |
|---|---|
| AI diff accept/reject wired to chat | ❌ |
| Screenshot image visible in card | ❌ |
| Git SHA/branch shown in GitCard | ❌ |
| Deploy URL shown + clickable | ❌ |
| Timeline search/filter | ❌ |
| Terminal output replay | ❌ |
| Card entry animations | ❌ |
| **Estimated system parity** | **~54%** |
