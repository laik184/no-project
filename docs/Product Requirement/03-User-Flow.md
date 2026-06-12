# User Flow Document
### NURAX — User App Mein Kaise Move Karta Hai

> Har flow ke liye: Steps → Expected Result → Fail States

---

## FLOW 1: Pehli Baar App Open Karna

```
User browser mein NURAX open karta hai
            ↓
        "/" Home Page
            ↓
    "Hi [Name], what do you want to make?"
            ↓
    ┌───────────────────────────────────────┐
    │  Text input — app idea likho          │
    │  Example prompts: "SaaS hero"         │
    │  Category buttons: Website/Mobile/... │
    └───────────────────────────────────────┘
            ↓
    RECENT PROJECTS section dikhta hai
    (Default Project already seeded hota hai)
```

**Pages Involved:** `/` (Home)
**API Call:** `GET /api/projects` — recent projects load

---

## FLOW 2: Naya Project Banana

```
Option A — Home page se:
    Text input mein idea likho → Enter
        ↓
    Project auto-create hota hai

Option B — Manual:
    Sidebar → "+" button → /create page
        ↓
    Form: Project name, description, framework
        ↓
    "Create" click
        ↓
    POST /api/projects
    { name, description, framework }
        ↓
    Backend:
        - DB mein projects row insert (status: idle)
        - sandboxPath generate: .sandbox/slug-timestamp
        ↓
    /workspace/:id pe redirect
        ↓
    Workspace open hoti hai
```

**Pages:** `/` → `/create` → `/workspace/:id`
**APIs:** `POST /api/projects`

**Fail States:**
- name missing → Error "name is required"
- DB down → Degraded mode (in-memory, data not saved)

---

## FLOW 3: Workspace — Main Working Area

```
/workspace/:id
    ↓
┌────────────────────────────────────────────────────┐
│ LEFT PANEL        │ CENTER PANEL    │ RIGHT PANEL  │
│ ─────────────── │ ─────────────── │ ──────────── │
│ Chat Panel        │ Code Editor OR  │ File         │
│ (Agent input)     │ Preview iframe  │ Explorer     │
│                   │ (tabs switch    │              │
│ Agent action feed │ between them)   │ Open files   │
│                   │                 │ list         │
│ Tool execution    │ Diff Viewer     │              │
│ cards             │ (when agent     │ Pinned files │
│                   │  suggests code) │              │
└────────────────────────────────────────────────────┘
```

**Panels:**
- **Chat Panel** — AI se baat karo, agent actions dekho
- **Center Panel** — Code editor ya preview (tabs se switch karo)
- **File Explorer** — Sidebar mein files browse karo

---

## FLOW 4: AI Se App Banwana (Core Flow)

```
STEP 1: Goal type karo
    Chat input mein: "Build me a todo app with React"
        ↓

STEP 2: Run start hota hai
    POST /api/run { projectId, goal }
        ↓
    Backend runId return karta hai
    SSE subscription start hoti hai
        ↓

STEP 3: Intent routing
    ┌─────────────────────────────────────┐
    │ "explain karo" / "kya hai yeh"      │
    │     ↓ Chat LLM direct stream        │
    │     → tokens UI mein aate hain      │
    ├─────────────────────────────────────┤
    │ "banao" / "fix karo" / "add karo"   │
    │     ↓ Full orchestration pipeline   │
    └─────────────────────────────────────┘
        ↓

STEP 4: Agent pipeline (build intent ke liye)
    Supervisor → validates goal
        ↓
    Planner → tasks mein todta hai
        ↓
    CoderX → code generate karta hai
        ↓
    Filesystem → files likhta hai
        ↓
    Terminal → npm install / build
        ↓
    Verifier → type-check + build verify
        ↓

STEP 5: UI mein live dikhta hai (SSE events)
    ┌─────────────────────────────────────┐
    │ ▶ Planning...                       │
    │   ✓ Created: src/App.tsx            │
    │   ✓ Created: src/components/...    │
    │   ⟳ Running: npm install           │
    │   ✓ Build: successful              │
    │   ✓ Checkpoint saved               │
    └─────────────────────────────────────┘
        ↓

STEP 6: Run complete
    - Run status: "completed"
    - Checkpoint auto-create
    - Memory store (decisions/learnings)
    - Preview automatically refresh
        ↓

STEP 7: User preview dekhta hai
    Center panel mein live app
```

**APIs:** `POST /api/run` → SSE `/api/realtime`
**Fail States:**
- API key missing → "AI features require OPENROUTER_API_KEY" error stream
- Invalid goal → HTTP 400
- Build fail → run "failed", error shown in chat
- Cancel → "Stop" button → `POST /api/run/:runId/cancel`

---

## FLOW 5: Code Editor Mein File Edit Karna

```
File Explorer mein file click karo
        ↓
GET /api/file-explorer/read?filePath=src/App.tsx
        ↓
Monaco Editor mein file open hoti hai
(Center Panel mein new tab)
        ↓
User code edit karta hai
        ↓
Save (Ctrl+S):
POST /api/file-explorer/write
{ filePath, content, clientMtime }
        ↓
┌─────────────────────────────────────────┐
│ Conflict check:                         │
│   clientMtime = server mtime?           │
│       ↓ YES → File saved ✓             │
│       ↓ NO  → HTTP 409 CONFLICT         │
│               → Warning dialog dikhta   │
│               → "Force save" ya "Discard"│
└─────────────────────────────────────────┘
        ↓
File change SSE event broadcast
→ File Explorer tree update
→ Agent ko change ka pata chalta hai
```

---

## FLOW 6: Agent Ki Suggested Changes Review Karna (Diff Flow)

```
Agent run ke dauran — agent code changes suggest karta hai
        ↓
Center Panel mein DiffViewer khulta hai
        ↓
┌─────────────────────────────────────────┐
│ OLD CODE (left)    │ NEW CODE (right)   │
│ ─────────────────  │ ──────────────── │
│ const App = () => │ const App = () => │
│   return <div>    │   return (         │
│     Hello         │     <main>         │
│   </div>          │       <h1>Todo     │
│                   │       </h1>        │
└─────────────────────────────────────────┘
        ↓
User decides:
    ✅ "Approve" → changes apply hoti hain
    ❌ "Reject" → changes discard hoti hain
```

---

## FLOW 7: Preview Dekhna + Runtime Control

```
Agent run complete hone ke baad:
OR user "Run" button click kare:
        ↓
POST /api/runtime/:projectId/start
        ↓
Backend:
    Project ke sandboxPath se start command detect karta hai:
    ├── package.json → scripts.dev → use karo
    ├── package.json → scripts.start → use karo
    ├── index.js / server.js → use karo
    └── Kuch nahi mila → "No runnable content" error
        ↓
Child process spawn hota hai
        ↓
Runtime status: idle → starting → running
        ↓
/preview/frame iframe proxy start hoti hai
        ↓
┌─────────────────────────────────────────┐
│ [← → ↺]  https://app.local      [📱🖥️] │
│ ─────────────────────────────────────  │
│                                         │
│        LIVE APP PREVIEW                 │
│        (iframe mein)                    │
│                                         │
└─────────────────────────────────────────┘
        ↓
Controls:
    🔁 Restart → POST /api/runtime/:id/restart
    ⏹ Stop    → POST /api/runtime/:id/stop
    📱 Mobile  → 375px device frame
    🖥 Desktop → full width
```

**Lifecycle States Visible To User:**
- ⚪ Idle — koi app nahi chal rahi
- 🟡 Starting — app boot ho rahi hai
- 🟢 Running — app live hai
- 🔴 Crashed — kuch toot gaya, restart karo

---

## FLOW 8: Terminal Use Karna

```
Sidebar → Console icon → /console page
OR workspace mein console panel
        ↓
POST /api/terminal/sessions
{ projectId, cwd: "/sandbox/my-project" }
        ↓
sessionId milta hai
        ↓
Command type karo: "npm install lodash"
        ↓
POST /api/terminal/sessions/:id/run
{ command: "npm install lodash" }
        ↓
SSE stream se output real-time aata hai:
┌────────────────────────────────┐
│ $ npm install lodash           │
│ added 1 package in 2s          │
│ found 0 vulnerabilities        │
│ $                              │
└────────────────────────────────┘
```

---

## FLOW 9: Checkpoint Se Rollback Karna

```
Chat panel mein checkpoint card dikhti hai
OR Sidebar → Checkpoints panel
        ↓
Checkpoint list dikhti hai:
┌────────────────────────────────────────────┐
│ ● 2 min ago — After "Add auth feature"     │
│   📁 3 files created, 2 modified           │
│   [View Diff] [Rollback]                   │
├────────────────────────────────────────────┤
│ ● 15 min ago — After "Create todo app"     │
│   📁 8 files created                       │
│   [View Diff] [Rollback]                   │
└────────────────────────────────────────────┘
        ↓

Option A — View Diff:
    GET /api/checkpoints/:id/diff
    DiffViewer mein before/after dikhta hai
        ↓

Option B — Rollback:
    "Rollback" button click
        ↓
    POST /api/checkpoints/:id/rollback
        ↓
    Backend:
        - fileSnapshots se sare files restore
        - rollback_history mein entry
        - SSE event broadcast
        ↓
    File Explorer refresh hota hai
    Editor mein open files update hoti hain
    Confirmation message: "Rolled back to: After todo app"
```

---

## FLOW 10: Apps Page — Sare Projects Manage Karna

```
Sidebar → Apps icon → /apps page
        ↓
┌────────────────────────────────────────────┐
│  [+ New App]  [+ New Folder]               │
│                                            │
│  📁 My Projects                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Todo App │ │ Blog Site│ │ Dashboard│  │
│  │ 2h ago   │ │ 1d ago   │ │ 3d ago   │  │
│  │ [Open]   │ │ [Open]   │ │ [Open]   │  │
│  └──────────┘ └──────────┘ └──────────┘  │
│                                            │
│  📁 Shared With Me                        │
└────────────────────────────────────────────┘
        ↓
Project card click → /workspace/:id
```

**APIs:** `GET /api/projects`, `GET /api/folders`

---

## FLOW 11: Tab Reload / Reconnect Hona

```
User browser tab reload karta hai
        ↓
Frontend boot hota hai
        ↓
GET /api/run/active?projectId=N
        ↓
┌──────────────────────────────────────────┐
│ Active run mila?                         │
│   ├── YES → SSE reattach (lastEventId)   │
│   │         → Missed events replay       │
│   │         → UI sync ho jaati hai       │
│   └── NO  → Normal state load            │
└──────────────────────────────────────────┘
        ↓
GET /api/lifecycle-state/:projectId
→ Preview state restore hota hai
```

---

## FLOW 12: Import Karna (⚠️ Currently Not Working)

```
Sidebar → Import → /import page
        ↓
Import options dikhte hain:
    ┌─────────────┐ ┌─────────┐ ┌──────────┐
    │ GitHub      │ │ Figma   │ │ ZIP File │
    │ repo URL    │ │ design  │ │ upload   │
    └─────────────┘ └─────────┘ └──────────┘
    ┌─────────┐ ┌────────┐ ┌──────────┐
    │ Bolt    │ │Lovable │ │ Vercel   │
    └─────────┘ └────────┘ └──────────┘
        ↓
User GitHub URL paste karta hai → Import click
        ↓
POST /api/import/git { repoUrl }
        ↓
    ⚠️ HTTP 404 — Route mounted nahi hai
    (Yeh feature abhi kaam nahi karta)
```

---

## FLOW 13: Settings + Integrations

```
Sidebar → Settings icon → /integrations
        ↓
Third-party connections:
    - OpenRouter API key status
    - Database connection status
    - Redis/Queue status
        ↓

/publishing → Deployment settings:
    - App name
    - Region (us-east-1 etc.)
    - Environment (production/staging)
    - Custom domain add
    - Secrets management
    - Auth providers configure
```

---

## PAGE ROUTES QUICK REFERENCE

| Route | Page | Kya Hai |
|---|---|---|
| `/` | Home | Landing page, recent projects, new app prompt |
| `/workspace` | Workspace | Main IDE (chat + editor + preview) |
| `/workspace/:id` | Workspace | Specific project workspace |
| `/apps` | Apps | All projects + folders management |
| `/preview` | Preview | Dedicated browser-in-browser |
| `/console` | Console | Standalone terminal/console |
| `/import` | Import | External project import (UI only) |
| `/publishing` | Publishing | Deployment settings |
| `/published` | Published Apps | Deployed apps list |
| `/integrations` | Integrations | Third-party connections |
| `/usage` | Usage | Resource analytics (UI only) |
| `/create` | Create Project | New project form |

---

## NAVIGATION SIDEBAR ICONS (Left Rail)

```
┌───┐
│ 🏠 │ → Home (/)
│ 📁 │ → Apps (/apps)
│ 📚 │ → Projects
│ 📊 │ → Analytics/Usage
│ ⬜ │ → Integrations
│ 📖 │ → Docs/Frameworks
└───┘
        (bottom)
│ ⚙️ │ → Settings
```
