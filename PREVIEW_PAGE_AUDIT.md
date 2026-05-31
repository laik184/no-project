# PREVIEW_PAGE_AUDIT.md

## Files Scanned

| Path | Purpose |
|---|---|
| `client/src/pages/preview/index.tsx` | Root Preview page — orchestrates all sub-components |
| `client/src/pages/preview/PreviewHeader.tsx` | "Publish \| Preview" top header bar |
| `client/src/pages/preview/BrowserBar.tsx` | Browser chrome: back/fwd/refresh/URL/devtools/device/open |
| `client/src/pages/preview/IframeView.tsx` | Iframe wrapper with device frame, lifecycle overlays, placeholder |
| `client/src/pages/preview/PreviewPanel.tsx` | Re-exports ProcessingPulse + DevToolsPanel |
| `client/src/pages/preview/PreviewView.tsx` | Legacy standalone preview (unused in main flow) |
| `client/src/pages/preview/ProcessingPulse.tsx` | Animated SVG + cycling text overlay (always mounted) |
| `client/src/pages/preview/ErrorPanel.tsx` | Error strip at bottom |
| `client/src/pages/preview/lifecycle/PreviewPlaceholder.tsx` | Full-page "Preview will be available soon" idle screen |
| `client/src/pages/preview/lifecycle/PreviewLifecycleOverlay.tsx` | Full-page animated overlay for all non-idle, non-ready states |
| `client/src/pages/preview/lifecycle/PreviewStatusPill.tsx` | Compact status badge rendered inside BrowserBar |
| `client/src/pages/preview/lifecycle/usePreviewLifecycle.ts` | SSE subscription hook — provides lifecycle state |
| `client/src/pages/preview/lifecycle/useIframeAutoRefresh.ts` | Auto-refreshes iframe on ready transition |
| `client/src/pages/preview/lifecycle/preview-lifecycle-types.ts` | State enum + STATE_CONFIG map |
| `client/src/pages/preview/lifecycle/lifecycle-animations.css` | All lifecycle overlay CSS |
| `client/src/pages/preview/lifecycle/placeholder-animations.css` | Placeholder full-page CSS |
| `client/src/pages/preview/preview-animations.css` | Shared preview animation keyframes |
| `client/src/pages/preview/preview-types.ts` | DEVICE_CONFIGS, DeviceKey types |
| `client/src/pages/preview/device-frames.tsx` | Phone/tablet SVG frame wrappers |
| `client/src/pages/preview/DevToolsPanel.tsx` | Dev tools panel |
| `client/src/pages/preview/RuntimeHealthWidget.tsx` | Health widget in browser bar |

---

## Component Rendering Each UI Section

### 1. "Publish | Preview" toolbar
- **File:** `client/src/pages/preview/PreviewHeader.tsx`
- **Rendered by:** `<PreviewHeader>` in `index.tsx` line 136
- **Content:** Static text `"Publish"` + divider + `<Monitor>` icon + `"Preview"` text + 3-dot menu
- **Condition:** Always rendered when `!gridMode`

### 2. Preview toolbar (BrowserBar)
- **File:** `client/src/pages/preview/BrowserBar.tsx`
- **Rendered by:** `<BrowserBar>` in `index.tsx` line 144
- **Content:** Back/Forward/Refresh/URL-chain/URL-input/DevTools-toggle/Device-selector/Open-external
- **Condition:** Always rendered when `!gridMode`

### 3. "Preview will be available soon"
- **File:** `client/src/pages/preview/lifecycle/PreviewPlaceholder.tsx` — line 64
- **Rendered by:** `<PreviewPlaceholder>` in `IframeView.tsx` at lines 64, 161, 190
- **Condition:** `lifecycleState === "idle"` (default startup state)
- **CSS:** `placeholder-animations.css`, z-index 20, `position: absolute; inset: 0`

### 4. "Starting dev server..." 
- **File:** `client/src/pages/preview/ProcessingPulse.tsx` — line 17 of `CONSOLE_MESSAGES` array
- **Rendered by:** `<ProcessingPulse>` in `index.tsx` line 180
- **Condition:** Always rendered (no condition), positioned `position: absolute; top: 50%; left: 50%`, z-index 36
- **Note:** Cycles through 15 messages every 1800ms — includes "Starting dev server..."

### 5. "Ask the AI agent to run your project"
- **File:** `client/src/pages/preview/lifecycle/PreviewPlaceholder.tsx` — line 73
- **Rendered by:** Same `<PreviewPlaceholder>` component, `.nph-hint` section

### 6. Placeholder/skeleton preview screen
- **File:** `client/src/pages/preview/lifecycle/PreviewPlaceholder.tsx`
- **Consists of:** Animated dot grid (3×3), "Preview will be available soon" heading, hint row, pulse dots
- **Background:** `#0d0d0f`, z-index 20, covers full iframe area

### 7. Custom preview header
- **File:** `client/src/pages/preview/PreviewHeader.tsx`
- **Content:** "Publish | Preview" branding + 3-dot dropdown menu (Settings/Keyboard/Help)

---

## Component Tree

```
Preview (index.tsx)
├── [gridMode=false]
│   ├── PreviewHeader          ← "Publish | Preview" bar  [REMOVE]
│   ├── BrowserBar             ← browser chrome (keep)
│   │   ├── Back / Forward / Refresh buttons
│   │   ├── LinkIcon (dev URL popup)
│   │   ├── URL input
│   │   ├── DevTools toggle
│   │   ├── Device selector
│   │   ├── Open-external button
│   │   ├── PreviewStatusPill  ← compact status in bar (keep)
│   │   └── RuntimeHealthWidget
│   └── <main>
│       ├── ProcessingPulse    ← always-on SVG + cycling text  [REMOVE]
│       ├── IframeView
│       │   ├── <iframe>
│       │   ├── PreviewPlaceholder  (idle state)  [REPLACE with compact]
│       │   └── PreviewLifecycleOverlay  (building/starting/crashed)  [MAKE COMPACT]
│       ├── ErrorPanel
│       └── DevToolsPanel
└── [gridMode=true]
    └── Grid pages
```

---

## State Flow

```
usePreviewLifecycle() → snapshot.state
  "idle"         → PreviewPlaceholder shown (full-page)
  "building"     → PreviewLifecycleOverlay (full backdrop + card)
  "installing"   → PreviewLifecycleOverlay (full backdrop + card)
  "starting"     → PreviewLifecycleOverlay (full backdrop + card)
  "verifying"    → PreviewLifecycleOverlay (full backdrop + card)
  "ready"        → both hidden — iframe is visible
  "crashed"      → PreviewLifecycleOverlay (full backdrop + card + buttons)
  "hot_reloading"→ PreviewLifecycleOverlay (brief flash)
  "reconnecting" → PreviewLifecycleOverlay (full backdrop + card)
```

---

## Route Flow

```
App router → /preview route → Preview (index.tsx)
  No sub-routes; grid mode pages are conditionally rendered inline
```

---

## Preview iframe Flow

```
IframeView renders <iframe src="/preview-frame" />
  On state=ready + prev≠ready → useIframeAutoRefresh → setIframeKey (600ms delay) → iframe remounts
  BrowserBar refresh → iframeRef.current.src = src (hard reload)
  URL bar submit → nav.handleUrlInputSubmit → iframe navigation
```

---

## Dev Server Status Flow

```
Server (SSE) → /api/realtime
  → RealtimeProvider (EventSource)
  → useRealtime().subscribe(TOPIC.PREVIEW_LIFECYCLE, cb)
  → usePreviewLifecycle() → snapshot.state
  → IframeView (lifecycleState prop)
    → PreviewPlaceholder when idle
    → PreviewLifecycleOverlay when building/starting/crashed

Initial state synced via fetch /api/lifecycle-state on mount
ProcessingPulse runs independently — always cycles text, no state connection
```

---

## Problems Identified

| # | Issue | Source |
|---|---|---|
| 1 | Full-page placeholder on idle | `PreviewPlaceholder.tsx` |
| 2 | "Preview will be available soon" text | `PreviewPlaceholder.tsx` line 64 |
| 3 | "Ask the AI agent to run your project" | `PreviewPlaceholder.tsx` line 73 |
| 4 | "Starting dev server..." cycling text | `ProcessingPulse.tsx` line 17 (always mounted) |
| 5 | Always-on neural network SVG overlay | `ProcessingPulse.tsx` — mounted unconditionally in `index.tsx` |
| 6 | "Publish \| Preview" redundant header | `PreviewHeader.tsx` |
| 7 | Full-page backdrop on starting/building | `PreviewLifecycleOverlay.tsx` + CSS |
