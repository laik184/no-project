# PREVIEW_PAGE_IMPLEMENTATION_REPORT.md

## Files Scanned

| File | Scanned For |
|---|---|
| `client/src/pages/preview/index.tsx` | Root render, component imports, ProcessingPulse/PreviewHeader usage |
| `client/src/pages/preview/PreviewHeader.tsx` | "Publish \| Preview" header content |
| `client/src/pages/preview/BrowserBar.tsx` | Browser chrome — confirmed keep |
| `client/src/pages/preview/IframeView.tsx` | Placeholder insertion points (3 locations) |
| `client/src/pages/preview/ProcessingPulse.tsx` | Always-on cycling text overlay |
| `client/src/pages/preview/lifecycle/PreviewPlaceholder.tsx` | Full-page idle screen |
| `client/src/pages/preview/lifecycle/PreviewLifecycleOverlay.tsx` | Full-page state overlay |
| `client/src/pages/preview/lifecycle/preview-lifecycle-types.ts` | State config and types |
| `client/src/pages/preview/lifecycle/lifecycle-animations.css` | CSS animations |
| `client/src/pages/preview/lifecycle/placeholder-animations.css` | Placeholder CSS |
| `client/src/pages/preview/lifecycle/usePreviewLifecycle.ts` | SSE state hook |
| `client/src/pages/preview/lifecycle/useIframeAutoRefresh.ts` | Iframe refresh logic |
| `client/src/pages/preview/lifecycle/PreviewStatusPill.tsx` | Compact status badge |
| `client/src/pages/preview/PreviewPanel.tsx` | Re-export barrel |

---

## Files Modified

| File | Change |
|---|---|
| `client/src/pages/preview/index.tsx` | Removed `PreviewHeader` import + render; removed `ProcessingPulse` import + render |
| `client/src/pages/preview/lifecycle/PreviewPlaceholder.tsx` | Fully replaced — compact inline indicator instead of full-page |
| `client/src/pages/preview/lifecycle/PreviewLifecycleOverlay.tsx` | Fully replaced — compact top-bar chip for non-errors; full card kept for errors only |
| `client/src/pages/preview/lifecycle/lifecycle-animations.css` | Added `@keyframes idle-shimmer` for progress shimmer |
| `client/src/pages/preview/lifecycle/placeholder-animations.css` | Cleared — inline styles now used; file kept as empty import stub |

## Files Removed (logically — no longer imported or rendered)

| File | Status |
|---|---|
| `client/src/pages/preview/PreviewHeader.tsx` | File retained on disk, import removed from `index.tsx` — no longer rendered |
| `client/src/pages/preview/ProcessingPulse.tsx` | File retained on disk, import removed from `index.tsx` — no longer rendered |

---

## Components Removed

| Component | Was Rendered In | Removal Method |
|---|---|---|
| `<PreviewHeader>` | `index.tsx` | Import + JSX removed from `index.tsx` |
| `<ProcessingPulse>` | `index.tsx` inside `<main>` | Import + JSX removed from `index.tsx` |
| Full-page `PreviewPlaceholder` (dot grid, "Preview will be available soon", "Ask the AI agent...") | `IframeView.tsx` × 3 | File rewritten — removed all blocking content |

---

## Components Created / Replaced

### `PreviewPlaceholder` (rewritten)
- **Before:** Full-page `position:absolute; inset:0` with animated 3×3 dot grid, large heading, hint row, pulse dots, z-index 20, covers entire iframe
- **After:** Compact indicator — 2px shimmer progress bar at top edge + single small centered chip "Waiting for server"; no blocking content

### `PreviewLifecycleOverlay` (rewritten)
- **Before (non-error states):** Full-page `plc-backdrop` (blur + dark fill) + centered card with large icon, label, progress bar, message text
- **After (non-error states):** Zero backdrop; 2px top progress bar + compact floating chip (spinner dot + state label), `pointerEvents: none`
- **After (error states):** Unchanged — full backdrop + card + Restart / Reload / Ask AI to Fix buttons

---

## Before vs After Hierarchy

### Before
```
Preview (index.tsx)
├── PreviewHeader          ← "Publish | Preview" bar  [REMOVED]
├── BrowserBar
│   └── PreviewStatusPill
├── <main>
│   ├── ProcessingPulse    ← always-on SVG + cycling text  [REMOVED]
│   ├── IframeView
│   │   ├── <iframe>
│   │   ├── PreviewPlaceholder (full-page, idle)  [REPLACED]
│   │   └── PreviewLifecycleOverlay (full-page, all states)  [REPLACED compact]
│   ├── ErrorPanel
│   └── DevToolsPanel
```

### After
```
Preview (index.tsx)
├── BrowserBar             ← browser chrome, unchanged
│   └── PreviewStatusPill
├── <main>
│   ├── IframeView
│   │   ├── <iframe>
│   │   ├── PreviewPlaceholder (compact chip, idle)
│   │   └── PreviewLifecycleOverlay
│   │       ├── non-error: top bar + floating chip (no backdrop)
│   │       └── error: full card + backdrop + action buttons
│   ├── ErrorPanel
│   └── DevToolsPanel
```

---

## Before vs After Workflow

### Before
1. Page loads → `lifecycleState = "idle"` → `PreviewPlaceholder` blocks entire iframe with dot animation, heading, hint text
2. Agent starts server → states cycle through building/starting → `PreviewLifecycleOverlay` with full backdrop covers iframe
3. `ProcessingPulse` always visible centered behind/above content, cycling "Starting dev server...", etc.
4. Server ready → overlays clear, iframe visible
5. "Publish | Preview" header always visible above browser bar

### After
1. Page loads → `lifecycleState = "idle"` → compact 2px shimmer bar + small "Waiting for server" chip in lower third of frame
2. Agent starts server → states cycle through building/starting → compact top bar + floating chip (no backdrop, iframe partially visible)
3. No `ProcessingPulse` — cycling text entirely gone
4. Server ready → all indicators clear, full iframe visible
5. No "Publish | Preview" header — browser bar is the first UI element

---

## Route Changes
None — routes untouched.

## State Changes
None — all lifecycle state logic (`usePreviewLifecycle`, `useIframeAutoRefresh`, SSE subscription) untouched.

## Preview Loading Flow (After)

```
Mount → lifecycleState = "idle"
  → PreviewPlaceholder: 2px shimmer + "Waiting for server" chip

SSE event: starting / building
  → PreviewLifecycleOverlay (compact):
      top 2px bar (progress shimmer) + floating chip "Starting…"
      no backdrop, iframe below is partially visible

SSE event: ready
  → both overlays hide (fade-out 0.5s)
  → useIframeAutoRefresh fires after 600ms → iframe key increments → fade-in

SSE event: crashed
  → PreviewLifecycleOverlay (full card):
      dark backdrop blur + Crash icon + "Crashed" label + Restart / AI Fix buttons
```

---

## Screenshots Impacted
- Main preview panel — "Publish | Preview" bar removed, browser bar is now topmost element
- Iframe idle state — large placeholder replaced with compact chip
- Building/starting state — full-page backdrop replaced with top-bar indicator
- Error/crash state — unchanged

## Remaining Gaps
- `PreviewHeader.tsx` and `ProcessingPulse.tsx` files remain on disk but are no longer imported — safe to delete in a future cleanup pass
- `placeholder-animations.css` retained as an empty stub; can be deleted if no other file imports it in future
