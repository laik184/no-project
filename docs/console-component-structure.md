# Console Component — Deep Structure Report

**Path:** `client/src/components/console/`
**Total Files:** 9
**Generated:** 2026-06-05

---

## Folder Structure

```
client/src/components/console/
│
├── index.tsx               ← Main entry point — ConsolePanel (root component)
├── ConsoleView.tsx         ← Legacy/simple fallback view (unused in production)
├── ConsoleStream.tsx       ← Virtualized log list with filter tabs + auto-scroll
├── ConsoleLine.tsx         ← Single log line renderer (ANSI + badges + timestamp)
├── RuntimeBadge.tsx        ← Animated runtime state pill (idle/ready/crashed/…)
├── RuntimeOverlay.tsx      ← Full-panel crash/recovery alert overlay
├── InstallProgress.tsx     ← Animated progress bar during npm install
├── useConsoleStream.ts     ← SSE hook — connects to /api/console/stream
└── ansi-utils.ts           ← ANSI escape parser → React inline styles
```

---

## File-by-File Breakdown

---

### 1. `index.tsx` — ConsolePanel (Root Orchestrator)
**Role:** Saare sub-components ko jodta hai. Console ka poora state yahan manage hota hai.

**Kya karta hai:**
- `useState` se `lines`, `runtimeState`, `search`, `copied`, `dismissed` track karta hai
- `useConsoleStream` hook call karta hai — SSE se live logs receive karta hai
- `addLine()` — naya log line state mein add karta hai (max 2000 lines cap)
- `onState()` — runtime state change hone par system line inject karta hai
- **Toolbar render karta hai:** Terminal icon, connection status (live/connecting), RuntimeBadge, Search, Copy, Clear buttons
- **Search bar** toggle karta hai (showSearch flag)
- `InstallProgress` — installing state mein show hota hai
- `RuntimeOverlay` — crashed/recovering/failed state mein show hota hai
- `ConsoleStream` ko filtered lines + search pass karta hai

**Constants:**
- `MAX_LINES = 2000` — memory leak rokne ke liye cap
- `WELCOME` — startup mein 2 system lines show karta hai
- `STATE_MESSAGES` — runtime state → human-readable message mapping

**Dependencies:**
```
ConsoleStream, RuntimeBadge, InstallProgress, RuntimeOverlay,
useConsoleStream, stripAnsi (ansi-utils)
@/types/console → LogLine, RuntimeState, NpmMeta, RuntimeStateEvent
```

---

### 2. `ConsoleStream.tsx` — Virtualized Log List
**Role:** Filtered log lines ki scrollable list render karta hai.

**Kya karta hai:**
- `kindFilter` state — "all" / "stderr" / "error" / "system" tabs
- `useMemo` se lines ko kind aur search ke hisaab se filter karta hai
- `counts` compute karta hai — har tab mein count badge ke liye
- **Auto-scroll:** Naye log aane par automatically bottom pe scroll karta hai
- **Manual scroll detect:** Agar user upar scroll kare, auto-scroll pause ho jaata hai
- **"↓ latest" FAB button** — jab auto-scroll paused ho, bottom pe jaane ke liye
- CSS `contain: strict` se performance optimize hai

**Filter Tabs:**
| Tab | Dikhta kya |
|-----|-----------|
| All | Saare logs |
| Stderr | Sirf stderr lines |
| Errors | Sirf error kind |
| System | Sirf system messages |

**Dependencies:**
```
ConsoleLine
@/types/console → LogLine
```

---

### 3. `ConsoleLine.tsx` — Single Log Line Renderer
**Role:** Ek log line ko rich format mein render karta hai.

**Kya karta hai:**
- `parseAnsi()` se raw text ke ANSI codes ko colored `<span>` mein convert karta hai
- **Kind prefix** show karta hai: `»` (system), `!` (stderr), `✕` (error)
- **Timestamp** — hover karne par fade-in hota hai (tabular-nums aligned)
- **Stack trace** — `meta.node.type === "stack-trace"` ho to opacity 0.7
- **Search highlight** — matching text ko yellow `<mark>` mein wrap karta hai
- **MetaBadge** inline show karta hai:
  - `ready` → green "ready" pill (vite)
  - `HMR` → blue "HMR" pill (vite)
  - `install-done` → yellow "N pkgs" pill (npm)
  - `vulnerabilities` → red "N vuln" pill (npm)
- `memo()` se wrapped — unnecessary re-renders nahi hote

**Kind Colors:**
| Kind | Color |
|------|-------|
| stdout | `rgba(180,255,200,0.88)` — light green |
| stderr | `#ff7b7b` — red-orange |
| error | `#ff5555` — bright red |
| system | `rgba(120,160,255,0.75)` — blue |

**Dependencies:**
```
parseAnsi (ansi-utils)
@/types/console → ConsoleLineMeta
```

---

### 4. `RuntimeBadge.tsx` — Runtime State Pill
**Role:** Runtime ka current state animated pill mein dikhata hai.

**Kya karta hai:**
- 11 states handle karta hai: `idle`, `starting`, `installing`, `compiling`, `ready`, `restarting`, `reconnecting`, `crashed`, `recovering`, `recovered`, `warning`, `failed`
- **Pulsing dot** — active states (starting, installing, compiling, etc.) mein `animate-ping` class se pulse karta hai
- **Solid dot** — terminal states (ready, crashed, failed) mein glowing dot
- `title` prop se hover pe full message dikhta hai
- `transition: all 0.3s ease` — smooth state changes

**State → Color Mapping:**
| State | Color |
|-------|-------|
| idle | white/dim |
| starting / restarting | blue `#4d9de0` |
| installing | yellow `#ffd93d` |
| compiling | purple `#c77dff` |
| ready / recovered | green `#6bcb77` |
| crashed / failed | red `#ff5555` |
| recovering | yellow `#ffd93d` |
| reconnecting | cyan `#4cc9f0` |

**Dependencies:**
```
@/types/console → RuntimeState
```

---

### 5. `RuntimeOverlay.tsx` — Crash/Recovery Alert Panel
**Role:** Process crash ya recovery hone par console ke andar banner dikhata hai.

**Kya karta hai:**
- Sirf 3 states pe visible hota hai: `crashed`, `recovering`, `failed`
- **crashed/failed** — red border, dismiss button, `✕` icon
- **recovering** — yellow border, spinning `⟳` icon, no dismiss (AI fix chal raha hai)
- `onDismiss` callback — user "dismiss" click kare to parent se `dismissed=true` set hota hai
- Banner console ke andar `mx-3 my-2` mein render hota hai (full-screen overlay nahi)

**Dependencies:**
```
@/types/console → RuntimeState
```

---

### 6. `InstallProgress.tsx` — npm Install Progress Bar
**Role:** npm install ke dauran animated progress bar dikhata hai.

**Kya karta hai:**
- `active` prop `true` hone par visible, `false` hone par 100% fill karta hai phir fade out
- **Simulated progress** — real npm progress nahi milta, isliye fake animation:
  - 0–70%: `+2.5` per 200ms (fast)
  - 70–88%: `+0.8` per 200ms (slow)
  - 88%+: `+0.2` per 200ms (crawl, never reaches 100 until done)
- `lastNpmMeta` se package count aur vulnerability count dikhata hai
- Done hone par bar green ho jaata hai (`#6bcb77`)

**Dependencies:**
```
@/types/console → NpmMeta
```

---

### 7. `useConsoleStream.ts` — SSE Connection Hook
**Role:** Backend se live console stream receive karta hai.

**Kya karta hai:**
- `EventSource` se `/api/console/stream?projectId=N` pe connect karta hai
- 3 SSE events listen karta hai:
  - `connected` — connection establish, retry delay reset
  - `console` — log line parse karke `onLine()` callback call karta hai
  - `runtime.state` — runtime state change, `onState()` callback call karta hai
- **Exponential backoff reconnection:**
  - Start: 1000ms
  - Multiply: 1.5x per retry
  - Max: 15,000ms (15 seconds)
- `onLine` aur `onState` refs mein store karta hai taaki effect re-run na ho

**Returns:** `boolean` — `true` = connected, `false` = connecting/disconnected

**Dependencies:**
```
@/types/console → LogLine, RuntimeStateEvent
```

---

### 8. `ansi-utils.ts` — ANSI Escape Code Parser
**Role:** Raw terminal text ke ANSI color codes ko React styles mein convert karta hai.

**Kya karta hai:**
- `parseAnsi(raw)` → `AnsiSegment[]` — text ko colored segments mein split karta hai
- **SGR codes** handle karta hai:
  - `0` — reset all
  - `1` — bold, `2` — dim, `3` — italic, `4` — underline
  - `30–37`, `90–97` — foreground 16 colors
  - `40–47`, `100–107` — background 16 colors
  - `39`/`49` — default fg/bg reset
- `stripAnsi(s)` → plain string — clipboard copy aur search ke liye ANSI codes hatata hai
- Regex: `/\x1b\[([0-9;]*)m/g` (SGR sequences only)

**Exports:**
```typescript
parseAnsi(raw: string): AnsiSegment[]
stripAnsi(s: string): string
interface AnsiSegment { text: string; style: React.CSSProperties }
```

---

### 9. `ConsoleView.tsx` — Legacy Simple View
**Role:** Purana simple fallback component (production mein use nahi hota).

**Kya karta hai:**
- `useAppState()` se `consoleOutput` (string[]) lektar dikhata hai
- Basic `<pre>` tags mein green text render karta hai
- Koi filter, search, ANSI, ya live stream nahi — sirf plain strings

**Status:** ⚠️ Legacy — `ConsolePanel` (index.tsx) isse replace kar chuka hai. Sirf `ConsoleView` naam se import ho sakta hai lekin `ConsolePanel` use karna chahiye.

---

## Component Data Flow

```
useConsoleStream (SSE hook)
        │
        ├── onLine(LogLine) ──────────────────────→ ConsolePanel (index.tsx)
        │                                                    │
        └── onState(RuntimeStateEvent) ──────────→          │
                                                             │
                                              ┌──────────────┼──────────────────┐
                                              ▼              ▼                  ▼
                                        RuntimeBadge   InstallProgress    RuntimeOverlay
                                        (state pill)   (progress bar)     (crash banner)
                                                             │
                                                             ▼
                                                      ConsoleStream
                                                      (filtered list)
                                                             │
                                                             ▼
                                                       ConsoleLine ×N
                                                     (ANSI + badges)
                                                             │
                                                             ▼
                                                        ansi-utils
                                                    (parseAnsi / stripAnsi)
```

---

## Type Dependencies (`@/types/console`)

| Type | Kahan use hota hai |
|------|--------------------|
| `LogLine` | index.tsx, ConsoleStream, ConsoleLine, useConsoleStream |
| `RuntimeState` | index.tsx, RuntimeBadge, RuntimeOverlay |
| `NpmMeta` | index.tsx, InstallProgress |
| `RuntimeStateEvent` | index.tsx, useConsoleStream |
| `ConsoleLineMeta` | ConsoleLine |

---

## Summary Table

| File | LOC | Type | Role |
|------|-----|------|------|
| `index.tsx` | 154 | Component | Root orchestrator, state hub |
| `ConsoleStream.tsx` | 156 | Component | Filtered scrollable log list |
| `ConsoleLine.tsx` | 137 | Component | Single line: ANSI + badges + timestamp |
| `RuntimeBadge.tsx` | 85 | Component | State pill with pulse animation |
| `RuntimeOverlay.tsx` | 105 | Component | Crash/recovery banner |
| `InstallProgress.tsx` | 84 | Component | npm install progress bar |
| `useConsoleStream.ts` | 89 | Hook | SSE live log stream |
| `ansi-utils.ts` | 104 | Utility | ANSI → React styles parser |
| `ConsoleView.tsx` | 11 | Component | ⚠️ Legacy — simple fallback only |
| **Total** | **925** | | |
