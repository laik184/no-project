# Preview Module — Deep Dive Report

**Path:** `client/src/pages/preview/`  
**Total Files:** 21 (14 `.tsx/.ts` + 5 lifecycle files + 2 `.css`)

---

## Folder Structure

```
client/src/pages/preview/
│
├── index.tsx                          ← Main entry point (root component)
├── preview-types.ts                   ← Shared types, constants, device configs
├── PreviewView.tsx                    ← Standalone iframe + SSE reload (alternate view)
├── PreviewPanel.tsx                   ← Barrel re-export file (PreviewPanel + ProcessingPulse)
├── PreviewHeader.tsx                  ← Top header bar (crash reason, reload badge, menu)
├── BrowserBar.tsx                     ← Browser-like top toolbar (nav, URL, DevTools, device)
├── IframeView.tsx                     ← Iframe renderer with device frame support
├── DevToolsPanel.tsx                  ← Developer tools panel (console, elements, network)
├── ErrorPanel.tsx                     ← Runtime error overlay (paginated errors)
├── device-frames.tsx                  ← Device frame SVG wrappers (Mobile, Tablet, OnePlus)
├── ProcessingPulse.tsx                ← Animated SVG pulse shown during agent processing
├── RuntimeHealthWidget.tsx            ← Live runtime health pill (port, uptime, restarts)
├── preview-animations.css             ← Global CSS animations for the preview module
│
└── lifecycle/                         ← Preview lifecycle state machine (sub-module)
    ├── preview-lifecycle-types.ts     ← All 15 state types + STATE_CONFIG registry
    ├── usePreviewLifecycle.ts         ← SSE hook — subscribes to preview.lifecycle events
    ├── useIframeAutoRefresh.ts        ← Smart iframe reload on lifecycle transitions
    ├── PreviewLifecycleOverlay.tsx    ← Overlay shown during building/crashed/healing etc.
    ├── PreviewPlaceholder.tsx         ← Idle state placeholder inside iframe area
    ├── PreviewStatusPill.tsx          ← Compact colored dot+label in the browser bar
    ├── lifecycle-animations.css       ← Lifecycle overlay CSS animations
    └── placeholder-animations.css     ← Placeholder-specific CSS animations
```

---

## File-by-File Breakdown

### `index.tsx` — Root Entry Point
**Kya karta hai:**  
Preview page ka main component. Saare hooks, state aur sub-components ko ek jagah orchestrate karta hai.

**Key responsibilities:**
- `usePreviewLifecycle` se lifecycle state subscribe karta hai (SSE)
- `useIframeAutoRefresh` se iframe auto-reload handle karta hai
- `useDeviceLogic` — device selection + custom resize
- `useNavigationLogic` — back/forward/reload navigation
- `useDevToolsLogic` — DevTools panel open/close/resize
- `useInspectLogic` — DOM element inspect mode
- `usePreviewCapture` — console/network capture from iframe
- Grid Mode support (swipe-based mobile grid with 4 pages)
- FilesModal + URLSharingModal rendering

**Kya export karta hai:** `default function Preview`

---

### `preview-types.ts` — Types & Constants
**Kya karta hai:**  
Poore module ke shared types aur constants define karta hai.

| Export | Type | Description |
|---|---|---|
| `RELOAD_DEBOUNCE_MS` | `number` | 2500ms — reload debounce guard |
| `DeviceKey` | `type` | `"fullsize"` (sirf ek key abhi) |
| `DeviceConfig` | `interface` | label, width, height, frame type |
| `DEVICE_CONFIGS` | `Record` | Device configurations map |
| `DEVICE_GROUPS` | `Array` | Grouped device list for dropdown |
| `usePreviewGuard` | `hook` | Debounced reload guard hook |
| `DeviceType` | `type` | `desktop / iphone / ipad / android` |
| `DevToolsTab` | `type` | `console / elements / network` |

---

### `BrowserBar.tsx` — Browser Toolbar
**Kya karta hai:**  
Preview window ke upar browser jaise toolbar render karta hai.

**Features:**
- ← → Back/Forward navigation buttons
- 🔄 Refresh button (hot reload)
- 🔗 Dev URL popup — QR code, copy button, private dev URL toggle, port info
- URL input bar (navigate iframe to any URL)
- 🔧 DevTools toggle button
- 📱 Device selector dropdown (groups + labels)
- 🔗 "Open in new tab" button
- `children` slot — `PreviewStatusPill` + `RuntimeHealthWidget` inject hote hain yahan

**Props:** 30+ props (navigation refs, URL state, device state, devtools state, children)

---

### `IframeView.tsx` — Iframe Renderer
**Kya karta hai:**  
Lifecycle-aware iframe render karta hai, device frame ke saath.

**4 render modes:**
1. **Phone frame** (`frame === "phone"`) — `DeviceFrame` component ke andar
2. **Tablet frame** (`frame === "tablet"`) — `TabletFrame` component ke andar
3. **Fullsize no-custom** — Simple absolute iframe (sabse fast)
4. **Custom size / 16:9** — Resizable container, drag handles (right, bottom, corner)

**Sub-components:**
- `LifecycleAwareIframe` — wraps iframe + `PreviewPlaceholder` + `PreviewLifecycleOverlay`
- `useFadeClass` — smooth fade-in animation on `iframeKey` change

**Iframe src:** `/preview-frame` (sandboxed)

---

### `DevToolsPanel.tsx` — Developer Tools
**Kya karta hai:**  
Browser DevTools jaisa panel render karta hai, preview ke bottom mein.

**3 tabs:**
| Tab | Content |
|---|---|
| **Elements** | Inspect mode — selected element ka HTML, Box Model, Computed Styles |
| **Webview Logs** | Console logs (type-colored: error/warn/info/log) with clear button |
| **Server Logs** | Network requests (method, URL, status, type) with clear button |

**Extra controls:**
- Network throttle: Normal / Slow 3G / Offline
- "Follow team session" checkbox
- Resize handle (drag to resize height)
- Minimize + Close buttons

---

### `ErrorPanel.tsx` — Runtime Error Overlay
**Kya karta hai:**  
Jab execution errors hain, iframe ke bottom par fixed red panel dikhata hai.

**Features:**
- Error count badge (e.g., "Error 1 of 3")
- Prev/Next error navigation
- Expand/Collapse toggle
- File + line + column info
- Auto-hides when `errors.length === 0`

---

### `PreviewHeader.tsx` — Header Bar
**Kya karta hai:**  
Ek simple header bar jo crash reason, reload type aur settings menu show karta hai.

**Badges shown:**
- 🔴 Crash reason (red pill)
- 🔵 Last action (blue pill)
- 🟢/🟡 Reload type: "Hot Reload" (green) / "Server Restart" (yellow)

**Menu items:** Settings, Keyboard Shortcuts, Help & Support

> **Note:** Ye component currently `index.tsx` mein use nahi hota — `BrowserBar` ne iska kaam le liya hai. Legacy component hai.

---

### `device-frames.tsx` — Device Frame SVGs
**Kya karta hai:**  
Realistic device frame wrappers render karta hai (pure CSS/inline styles, no images).

| Component | Device | Size |
|---|---|---|
| `TabletFrame` | 16:9 Tablet | 800×450px |
| `OnePlusFrame` | OnePlus Pad Go 2 | 840×600px |
| `MobileFrame` | Generic Mobile | 390×844px |
| `DeviceFrame` | Router (picks above) | DeviceKey based |

**Details:** Drop shadows, bezels, camera cutouts, screen reflections — sab CSS se bana hai.

---

### `ProcessingPulse.tsx` — Agent Processing Animation
**Kya karta hai:**  
Jab AI agent kaam kar raha hota hai, ek animated SVG pentagon network graph dikhata hai.

**Features:**
- Animated SVG — pentagon nodes + dashed edges + center hub
- 15 rotating console messages (e.g., "Agent writing code...", "Compiling TypeScript...")
- Message changes every 1.8s with fade-in animation
- Pure CSS animations — no external dependencies

**Used in:** `PreviewPanel.tsx` ke through export hota hai.

---

### `RuntimeHealthWidget.tsx` — Health Indicator
**Kya karta hai:**  
Browser bar mein ek compact green pill dikhata hai jab server chal raha hota hai.

**Shows:** Port number `:3000`, Uptime `↑2m30s`, Restart count `↻3`

**Data source:** `useRuntimeHealth` hook, polling every 5 seconds  
**Hidden when:** health null hai ya unhealthy

---

### `PreviewPanel.tsx` — Barrel Export
**Kya karta hai:**  
Sirf re-export file hai. `ProcessingPulse` aur `DevToolsPanel` ko ek jagah se export karta hai.

```ts
export { ProcessingPulse }    from "./ProcessingPulse";
export { DevToolsPanel }      from "./DevToolsPanel";
export type { ElementInfo, DevToolsTab, DevToolsPanelProps } from "./DevToolsPanel";
```

---

### `PreviewView.tsx` — Alternate Preview (Standalone)
**Kya karta hai:**  
Ek alag, simpler preview view jo SSE se auto-reload handle karta hai.

**Alag kaise hai `index.tsx` se:**
- Seedha `EventSource` use karta hai (no lifecycle hooks)
- 4 device modes: desktop, tablet, oneplus, mobile
- `/preview-frame` ke bajaaye `REPLIT_DEV_DOMAIN` ya `localhost:3000` use karta hai
- Grid toolbar/modal nahi hain

**Status:** Yeh legacy/alternate implementation lagta hai; main app `index.tsx` use karta hai.

---

## lifecycle/ Sub-module

### `preview-lifecycle-types.ts` — State Machine Types
**15 lifecycle states define karta hai:**

| State | Color | Meaning |
|---|---|---|
| `idle` | Gray | No server running |
| `building` | Indigo | npm/vite build chal raha hai |
| `installing` | Purple | npm install chal raha hai |
| `starting` | Green | Server start ho raha hai |
| `verifying` | Lime | Post-start health check |
| `restarting` | Yellow | Server restart |
| `updating` | Sky | Code update |
| `refreshing` | Green | Soft refresh |
| `hot_reloading` | Cyan | CSS/JS hot update (no restart) |
| `self_healing` | Pink | AI crash fix kar raha hai |
| `debugging` | Orange | AI logs padh raha hai |
| `patching` | Violet | AI code patch apply kar raha hai |
| `ready` | Green | Server ready hai |
| `crashed` | Red | Server crash ho gaya |
| `reconnecting` | Orange | SSE reconnect ho raha hai |

---

### `usePreviewLifecycle.ts` — SSE Lifecycle Hook
**Kya karta hai:**
1. Mount pe `/api/lifecycle-state` se current state fetch karta hai
2. SSE `TOPIC.PREVIEW_LIFECYCLE` events subscribe karta hai (real-time)
3. SSE disconnect hone pe `reconnecting` state set karta hai
4. `LifecycleSnapshot` return karta hai: `{ state, prevState, message, meta, ts }`

---

### `useIframeAutoRefresh.ts` — Smart Reload Logic
**Kya karta hai:**  
Lifecycle transitions pe intelligently iframe reload trigger karta hai.

**Rules:**
- `hot_reloading` → ❌ No reload (CSS in-place inject hota hai)
- `verifying` / `debugging` / `self_healing` → ❌ No reload
- `refreshing` → ✅ Soft reload (key bump)
- `ready` ← from `starting/restarting/crashed/patching` → ✅ Hard reload (600ms delay)
- `ready` ← from `hot_reloading` → ❌ No reload

---

### `PreviewLifecycleOverlay.tsx` — State Overlay
**Kya karta hai:**  
Iframe ke upar overlay render karta hai based on lifecycle state.

**2 modes:**
1. **Error states** (`crashed`, `reconnecting`) — Full card with backdrop, Restart/Reload/Ask AI buttons
2. **Non-error states** — Thin top progress bar + small floating status chip (no blocking)

**Self-healing phases** (cycled every 2.2s):
`Reading crash logs… → Identifying root cause… → Generating patch… → Applying fix… → Verifying health…`

---

### `PreviewPlaceholder.tsx` — Idle Placeholder
**Kya karta hai:**  
`idle` state mein iframe area ke andar dikhata hai.

**Shows:** Shimmer top bar + "Waiting for server" chip  
**Animation:** Fade-in on mount, shimmer loop

---

### `PreviewStatusPill.tsx` — Status Pill (Browser Bar)
**Kya karta hai:**  
BrowserBar ke andar ek colored dot+label pill render karta hai.

- Pulsing dot → active/loading states
- Cyan flash → hot_reloading
- Hidden → `idle` state

---

## Data Flow Diagram

```
index.tsx (root)
│
├── usePreviewLifecycle()  ←── SSE: /api/realtime (TOPIC.PREVIEW_LIFECYCLE)
│       └── returns: { state, prevState, message, meta }
│
├── useIframeAutoRefresh() ← lifecycle state/prevState se triggers iframe key bump
│
├── BrowserBar
│   ├── nav controls (back/fwd/refresh)
│   ├── URL input
│   ├── DevTools toggle
│   ├── Device selector
│   ├── children slot:
│   │   ├── PreviewStatusPill    ← lifecycle.state
│   │   └── RuntimeHealthWidget  ← polls /api/runtime-health every 5s
│
├── IframeView
│   ├── <iframe src="/preview-frame" key={iframeKey} />
│   ├── PreviewPlaceholder       ← shown when state === "idle"
│   └── PreviewLifecycleOverlay  ← shown on building/crashed/etc.
│
├── ErrorPanel                   ← executionState.errors se
└── DevToolsPanel
    ├── consoleLogs (captured via usePreviewCapture)
    ├── networkRequests
    └── selectedElementInfo (from useInspectLogic)
```

---

## CSS Files

| File | Purpose |
|---|---|
| `preview-animations.css` | Global preview animations (iframe-fade-in, etc.) |
| `lifecycle/lifecycle-animations.css` | Overlay animations (plc-enter, plc-exit, plc-spin, plc-dot-pulse, etc.) |
| `lifecycle/placeholder-animations.css` | Idle placeholder animations |

---

## Key Dependencies (External Hooks)

| Hook | Location | Kya karta hai |
|---|---|---|
| `useDeviceLogic` | `@/hooks/useDeviceLogic` | Device selection + custom resize drag |
| `useNavigationLogic` | `@/hooks/useNavigationLogic` | Back/fwd/reload navigation |
| `useDevToolsLogic` | `@/hooks/useDevToolsLogic` | DevTools open/close/resize |
| `useInspectLogic` | `@/hooks/useInspectLogic` | DOM element inspect mode |
| `usePreviewCapture` | `@/hooks/usePreviewCapture` | Console/network capture from iframe |
| `useRuntimeHealth` | `@/hooks/useRuntimeHealth` | Runtime health polling |
| `useRealtime` | `@/realtime/realtime-provider` | SSE connection |
| `useAppState` | `@/context/app-state-context` | Global execution state |

---

## Summary Table

| File | LOC | Category | Used In |
|---|---|---|---|
| `index.tsx` | 248 | Root Page | `App.tsx` router |
| `BrowserBar.tsx` | 249 | UI Component | `index.tsx` |
| `IframeView.tsx` | 237 | UI Component | `index.tsx` |
| `DevToolsPanel.tsx` | 205 | UI Component | `index.tsx` via PreviewPanel |
| `lifecycle/PreviewLifecycleOverlay.tsx` | 258 | UI Component | `IframeView.tsx` |
| `device-frames.tsx` | 113 | UI Component | `IframeView.tsx`, `PreviewView.tsx` |
| `ProcessingPulse.tsx` | 89 | UI Component | via `PreviewPanel.tsx` |
| `RuntimeHealthWidget.tsx` | 80 | UI Component | `index.tsx` (inside BrowserBar) |
| `lifecycle/PreviewPlaceholder.tsx` | 93 | UI Component | `IframeView.tsx` |
| `lifecycle/PreviewStatusPill.tsx` | 53 | UI Component | `index.tsx` (inside BrowserBar) |
| `lifecycle/usePreviewLifecycle.ts` | 137 | Hook | `index.tsx` |
| `lifecycle/useIframeAutoRefresh.ts` | 67 | Hook | `index.tsx` |
| `lifecycle/preview-lifecycle-types.ts` | 56 | Types | lifecycle/* |
| `preview-types.ts` | 39 | Types | BrowserBar, IframeView |
| `PreviewPanel.tsx` | 3 | Barrel | `index.tsx` |
| `PreviewHeader.tsx` | 67 | Legacy UI | (unused in current flow) |
| `PreviewView.tsx` | 87 | Legacy/Alt | (alternate standalone view) |
