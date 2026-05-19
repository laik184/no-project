# NURA X — Complete System Deep Report
### Chat · Console · Preview · File Explorer · Tools · Agents · Fix List

**Date:** 2026-05-19  
**System:** NURA X AI IDE (Replit Clone)  
**Purpose:** Har ek part kaise kaam karta hai — step-by-step, file-by-file, action-by-action

---

## PART 1 — REPLIT BLUEPRINT KYA HAI?

Replit Blueprint ek **pre-built code template + package configuration** hota hai jo Replit ke integration system me registered hota hai.

Jab aap koi blueprint install karte hain to ye 3 cheezein karta hai:

```
Blueprint Install karo
    ├── 1. Required npm packages automatically install karta hai
    ├── 2. Boilerplate code files project me copy karta hai
    └── 3. Environment variables (API keys) ko Replit Secrets se auto-connect karta hai
```

**NURA X me installed blueprint:**

| Blueprint ID | Kya karta hai |
|---|---|
| `javascript_openrouter_ai_integrations` | OpenRouter LLM access — user ka apna API key nahi chahiye, Replit credits se chalata hai |
| `javascript_database` | PostgreSQL database auto-provision |

**Blueprint ka fayda:**  
User ko manually `OPENROUTER_API_KEY` set nahi karna padta. `AI_INTEGRATIONS_OPENROUTER_API_KEY` automatically available hota hai through Replit's credential proxy (`connectors.replit.com`).

**NURA X me blueprint ka use kahan hota hai:**

```
server/agents/llm/openrouter.client.ts
    → apiKey = process.env.OPENROUTER_API_KEY 
            || process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY  ← blueprint se aata hai
```

---

## PART 2 — JAB USER APP IDEA DETA HAI: POORA SYSTEM CYCLE

### Step 0 — User Home Screen Par Idea Likhta Hai

**File:** `client/src/pages/core/home.tsx`

```
User ne likha: "Build me a customer dashboard with login"
    ↓
Input box me type kiya
    ↓
Category select ki (Website / Mobile / AI Agent / etc.)
    ↓
Send button dabaya
    ↓
handleSend() function trigger hua
    ↓
useLocation() hook se navigate("/workspace") hua
    ↓
Goal localStorage me save hua: nura.lastGoal = "Build me a customer dashboard..."
```

**UI components involved:**
- Text input (`Describe your app idea...`)
- Category chips (Website, Mobile, Design, Slides, Animation, Game, Data, AI Agent, API)
- Example prompt chips (SaaS hero animation, 3D racing game, etc.)
- Recent Projects section (database se fetch hota hai via `/api/projects`)

---

### Step 1 — Frontend: Chat Component Goal Ko Backend Bhejta Hai

**File:** `client/src/components/chat/useAgentRunner.ts`

```
handleSend(goal) called
    ↓
POST /api/run  ← HTTP request backend ko
    body: {
        goal: "Build me a customer dashboard with login",
        projectId: 1,
        mode: "agent"   ← auto / pipeline / planned
    }
    ↓
Response: { runId: "run_abc123", status: "running" }
    ↓
currentRunIdRef.current = "run_abc123"
    ↓
SSE connection open: GET /sse?projectId=1&topics=agent,console,file,runtime...
    ↓
isAgentThinking = true  ← UI me loading spinner dikhta hai
```

**SSE Topics jo frontend subscribe karta hai:**

| Topic | Kya receive karta hai |
|---|---|
| `agent` | Agent ke actions, tool calls, thinking tokens |
| `console` | Terminal output (npm install, build logs) |
| `file` | File create/modify/delete events |
| `runtime.verified` | Server start ho gaya notification |
| `diff` | Code changes ka diff (approve/reject ke liye) |
| `checkpoint` | Snapshot liya gaya |
| `tool.execution` | Kaunsa tool chal raha hai |

---

### Step 2 — Backend: Run Controller Goal Ko Route Karta Hai

**File:** `server/chat/run/controller.ts` + `server/api/run.routes.ts`

```
POST /api/run received
    ↓
RunController.runGoal(input) called
    ↓
runId = newRunId()  → "run_abc123xyz"
    ↓
Database me insert:
    agentRuns table → { id: runId, projectId, goal, status: "running" }
    ↓
bus.emit("run.lifecycle", { runId, status: "started" })
    ↓
ROUTING DECISION:
    ┌─ mode === "pipeline"  → executePipelineRun()   [9-phase system]
    ├─ mode === "planned"   → executePlannedRun()     [planning + tool loop]
    └─ mode === "agent"
           ↓
        needsPlanning(goal)?
           ├─ YES → executePlannedRun()    [complex goals]
           └─ NO  → executeToolLoopRun()  [simple goals]
```

**`needsPlanning()` kaise decide karta hai:**  
File: `server/agents/planning/index.ts`  
Keywords check karta hai: "build", "create full", "add authentication", "deploy", "complete app", "entire", "whole" — agar ye words hain to planning mode.

---

### Step 3 — Agent: Tool Loop Shuru Hota Hai

**File:** `server/agents/core/tool-loop/tool-loop.agent.ts`

```
runAgentLoop(input) called
    ↓
STEP 1: Pre-run checkpoint liya
    → checkpointStore.createPreRunCheckpoint(projectId, runId)
    → .sandbox/projectId/ ka snapshot → checkpoints table me save
    ↓
STEP 2: System Prompt Build Hota Hai
    → buildSystemPrompt(projectId)
    → Includes: project structure, existing files, capabilities, rules
    ↓
STEP 3: Messages Array Initialize
    messages = [
        { role: "system", content: systemPrompt },
        { role: "user",   content: goal + memoryContext }
    ]
    ↓
STEP 4: LLM TOOL LOOP START (max 25 steps)

    ┌─────────────────────────────────────────┐
    │              AGENT LOOP                 │
    │                                         │
    │  THINK: LLM ko messages bhejo           │
    │      llm.streamChatWithTools(messages)  │
    │      ↓                                  │
    │  STREAM: Tokens aa rahe hain            │
    │      bus.emit("agent.token", token)     │
    │      → Frontend me text stream dikhta   │
    │      ↓                                  │
    │  ACT: LLM ne tool call kiya             │
    │      { tool_calls: [{ name, args }] }   │
    │      ↓                                  │
    │  EXECUTE: Tool run karo                 │
    │      executeToolCall(tool, args, ctx)   │
    │      ↓                                  │
    │  OBSERVE: Result + health check         │
    │      executionObserver(result, health)  │
    │      ↓                                  │
    │  REFLECT: Observation messages me add  │
    │      messages.push(observation)         │
    │      ↓                                  │
    │  task_complete? → VERIFY                │
    │  NO → loop back to THINK               │
    └─────────────────────────────────────────┘
```

---

### Step 4 — Tools: 49 Tools 15 Categories Me

**File:** `server/tools/orchestrator.ts`

Jab LLM koi tool call karta hai, orchestrator us tool ko dhundh ke execute karta hai.

**Tool Categories aur Examples:**

| Category | Tools | Kya karta hai |
|---|---|---|
| **file** | `read_file`, `write_file`, `list_dir`, `delete_file` | Sandbox filesystem operations |
| **shell** | `shell_exec`, `run_command` | Terminal commands run karna |
| **package** | `install_package`, `check_package` | npm/pip packages install karna |
| **git** | `git_init`, `git_commit`, `git_status` | Version control |
| **search** | `search_code`, `grep_files` | Codebase search |
| **runtime** | `start_server`, `stop_server`, `check_health` | Process management |
| **browser** | `screenshot`, `check_preview` | Preview verification |
| **memory** | `save_memory`, `recall_memory` | Agent memory |
| **diff** | `request_approval` | User se code change approve karwana |
| **checkpoint** | `create_checkpoint`, `rollback` | Snapshot aur recovery |

**Sandbox Isolation:**  
File: `server/infrastructure/sandbox/sandbox.util.ts`  
Sabhi file operations `.sandbox/<projectId>/` ke andar locked hain. Agent kabhi bhi is scope ke bahar file access nahi kar sakta.

**Diff Approval Gate:**  
Jab agent existing file modify karna chahta hai:
```
write_file called on existing file
    ↓
requestApproval(diff) → diff-approval.service.ts
    ↓
bus.emit("diff.created", { filePath, oldContent, newContent })
    ↓
Frontend me DiffViewer dikhta hai
    ↓
User "Accept" ya "Reject" dabata hai
    ↓
agent ko result milta hai → loop continue
```

---

### Step 5 — Chat Page: Real-Time UI Update

**File:** `client/src/realtime/realtime-provider.tsx`

```
SSE stream se event aata hai
    ↓
realtime-provider.tsx event ko parse karta hai
    ↓

EVENT TYPE         → UI ACTION
─────────────────────────────────────────
agent.token        → Chat me text stream dikhta hai (typewriter effect)
agent.event        → Action feed me tool name dikhta hai (file_write, shell_exec...)
console.log        → Console panel me output line add hoti hai
file.change        → File explorer me tree update hoti hai (new file highlighted)
runtime.verified   → Preview panel me app load hoti hai
diff.created       → Diff viewer popup aata hai
checkpoint.created → "Checkpoint saved" notification
tool.execution     → Tool status badge update hota hai
run.lifecycle      → Agent thinking/done state toggle
```

**Frontend State Flow:**

```
isAgentThinking = true   ← spinner on
    ↓ (agent kaam kar raha hai)
messages[] update hota rahe
agentActions[] update hota rahe  
consoleLines[] update hota rahe
fileTree update hota rahe
    ↓
run.lifecycle.completed event
    ↓
isAgentThinking = false  ← spinner off
finalizeStream()
```

---

### Step 6 — Console Panel: Terminal Output Capture

**Files:**
- `server/console/capture/capture.service.ts`
- `server/console/console.orchestrator.ts`
- `client/src/pages/devtools/console.tsx`

```
shell_exec("npm install react") called
    ↓
spawnWithStream() → child process shuru
    ↓
stdout/stderr lines → shell-log-emitter.ts
    ↓
captureService.capture(line, stream, projectId)
    ↓
Intelligence Parsers run karte hain:
    ├── ViteParser → "VITE ready in 187ms" detect karta hai
    ├── NodeParser → "Error: Cannot find module" detect karta hai
    └── ErrorParser → stack traces identify karta hai
    ↓
consoleLogs table me PostgreSQL me save
    ↓
bus.emit("console.log", { line, stream, projectId })
    ↓
SSE → Frontend console panel me live dikhta hai
    ↓
"Server started on port 3000" detect hua?
    ↓
observation-controller.ts → port probe
    ↓
bus.emit("runtime.verified", { projectId, port: 3000 })
    ↓
Preview panel activate!
```

---

### Step 7 — Preview Panel: App Ka Live View

**Files:**
- `client/src/pages/preview/PreviewPanel.tsx`
- `server/infrastructure/proxy/preview-proxy.ts`

```
runtime.verified event received (port 3000 ready)
    ↓
PreviewPanel.tsx iframe src set:
    /preview/1/  ← projectId=1
    ↓
preview-proxy.ts request receive karta hai
    ↓
.sandbox/1/ me running process ka port dhundha (3000)
    ↓
http-proxy-middleware → localhost:3000 par forward
    ↓
User ka React/Node app iframe me load hoti hai
    ↓
BrowserBar.tsx → URL bar dikhta hai
DevToolsPanel.tsx → Console errors dikhte hain
RuntimeHealthWidget.tsx → Server health badge
```

**Preview Features:**
- Device frames (Mobile / Tablet / Desktop)
- Refresh button
- External link (new tab me open)
- Runtime health indicator (green/red)

---

### Step 8 — File Explorer: Live File Tree

**Files:**
- `client/src/components/file-explorer/FileExplorer.tsx`
- `server/file-explorer/` (tree, crud, search, history, watcher modules)

```
Chokidar file watcher → .sandbox/projectId/ monitor karta hai
    ↓
File create/modify/delete event
    ↓
bus.emit("file.change", { path, type, projectId })
    ↓
SSE → Frontend
    ↓
File tree automatically update hota hai
New files → highlighted dikhte hain
Modified files → icon change
    ↓
File click → Monaco Editor me open
    ↓
read_file tool → content load
    ↓
Editor me syntax highlighting ke saath dikhta hai
```

---

### Step 9 — Verification Engine: Quality Check

**File:** `server/verification/index.ts`

Agent jab `task_complete` call karta hai, pehle verification run hoti hai:

```
task_complete called
    ↓
emitVerificationStarted → frontend pe "Verifying..." badge
    ↓
runVerificationEngine():
    ├── TypeScript Check → tsc --noEmit (type errors?)
    ├── Runtime Health  → process alive + port open?
    └── Preview Stable  → HTTP 200 response?
    ↓
PASS → emitVerificationPassed → run.complete
    ↓
FAIL → emitVerificationFailed
    ↓
Failure inject karo messages me
    ↓
Agent loop wapas THINK pe → self-heal
    ↓
Max 3 verification retries
    ↓
Exhaust → emitVerificationExhausted → warn + complete anyway
```

---

### Step 10 — Memory System: Lessons Seekhna

**File:** `server/agents/core/memory/orchestrator.ts`

```
Run complete hua
    ↓
Memory Pipeline run:
    1. Deduplication → same cheezein dobara save mat karo
    2. Scoring       → kitna relevant hai? (0.0 - 1.0)
    3. Filtering     → low-score memories hatao
    4. Classification → "pattern" / "fact" / "preference"
    5. Writing       → persistent store me save
    ↓
Next run pe:
    → Similarity search → relevant memories retrieve
    → memoryContext me inject
    → LLM ko pata hoga: "Is project me ESM imports use hoti hain"
```

---

## PART 3 — AGENTS KAISE KAAM KARTE HAIN

NURA X me multiple specialized agents hain. Koi ek "mega agent" nahi hai.

### Agent Hierarchy

```
RunController
    ↓
    ├── PlannerBoss (complex goals ke liye)
    │       ↓
    │   TaskDecomposer → Ordered task list
    │       ↓
    │   ArchitectureAgent → Project structure decide
    │
    ├── ToolLoopAgent (har task ke liye)
    │       ↓
    │   Tool calls execute → file write, shell run, etc.
    │       ↓
    │   ExecutionObserver → Result analyze
    │
    ├── AutonomousDebugAgent (crash pe activate)
    │       ↓
    │   ConsoleParser → Error classify
    │       ↓
    │   RecoveryAgent → Fix suggest + apply
    │
    ├── VerificationEngine (task complete pe)
    │       ↓
    │   TypeCheck + RuntimeCheck + PreviewCheck
    │
    └── MemoryAgent (run ke baad)
            ↓
        Pattern extract + save
```

### Agent Communication

Koi bhi agent directly doosre agent ko call nahi karta (HVP principle).  
Sab kuch **Event Bus** ke through hota hai:

```
Agent A → bus.emit("event.type", payload) → Agent B
```

Is wajah se agents loosely coupled hain aur ek ka fail hona doosre ko affect nahi karta.

---

## PART 4 — NURA X ME KYA FIX KARNA HAI

Yahan wo sab kuch hai jo broken hai, incomplete hai, ya better ho sakta hai.

---

### FIX #1 — Navigation: Back Button Kaam Nahi Karta

**File:** `client/src/lib/navigation-system.ts` (Lines 437-474)  
**Severity:** HIGH  
**Problem:**

```
User workspace me hai → File kholi → Back dabaya → UI state lost!
Editor tabs reset ho jate hain
Scroll position bhooli jati hai
```

**Kya missing hai:**
- `NavigationStack` / History handler nahi hai
- `ViewStateSnapshot` restore nahi hota
- Components ka `onEnter` / `onExit` lifecycle nahi hai

**Fix karna hai:**
```typescript
// NavigationStack banana hai
// Har view change pe state snapshot lena hai
// Wouter ke sath custom history management implement karna hai
```

---

### FIX #2 — WebSocket Listener Leak

**File:** `client/src/lib/navigation-system.ts` (MISSING_NAV_EXEC_1)  
**Severity:** HIGH  
**Problem:**

```javascript
// executeCode() me WebSocket listeners attach hote hain
// lekin kabhi detach nahi hote
// Result: duplicate updates, memory leak, wrong project ka data dikhna
```

**Fix karna hai:**
```typescript
// Har listener ke saath cleanup function return karo
// useEffect me unsubscribe call karo
const unsub = socket.on("message", handler);
return () => unsub(); // ← ye missing hai
```

---

### FIX #3 — CenterPanel: Tab Switch Pe Content Lost

**File:** `client/src/components/layout/CenterPanel.tsx` (Line 403)  
**Severity:** MEDIUM  
**Problem:**

```
// FIX: restore edited content when switching back to this tab
// Yani: user tab switch kare to edited content wapas nahi aata
```

**Fix karna hai:**
```typescript
// Tab state ko Map me preserve karo
const tabContentMap = useRef<Map<string, string>>(new Map());
// Tab switch pe save + restore karo
```

---

### FIX #4 — Empty Catch Blocks (Silent Failures)

**Files aur Lines:**

| File | Line | Problem |
|---|---|---|
| `client/src/hooks/useInspectLogic.ts` | 85, 95 | `catch (_) {}` — error kahan gaya? |
| `client/src/components/agent/BatchPanel.tsx` | 55 | `catch(e){}` — silently fail |
| `client/src/components/layout/UnifiedTimeline.tsx` | 18 | `console.error` hai but user ko kuch nahi dikhta |

**Fix karna hai:**
```typescript
// Bura:
catch (_) {}

// Acha:
catch (err) {
  console.error("[ComponentName] operation failed:", err);
  toast({ title: "Something went wrong", description: String(err), variant: "destructive" });
}
```

---

### FIX #5 — File Explorer: Alert() Use Nahi Hona Chahiye

**File:** `client/src/components/file-explorer/FileExplorer.tsx` (Lines 192, 205)  
**Severity:** LOW-MEDIUM  
**Problem:**

```javascript
alert("Failed to create file"); // ← browser ka ugly default alert
```

**Fix karna hai:**
```typescript
// Modern toast ya inline error message use karo
toast({ title: "Failed to create file", variant: "destructive" });
```

---

### FIX #6 — maxSteps = 25 Ka Hard Cap

**File:** `server/agents/core/tool-loop/tool-loop.agent.ts`  
**Severity:** MEDIUM  
**Problem:**

```
Complex tasks (poora app banana) me 25 steps kafi nahi hain
Agent force-terminate ho jata hai beech me
```

**Fix karna hai:**
```typescript
// Dynamic maxSteps based on goal complexity
const maxSteps = needsPlanning(goal) ? 50 : 25;

// Ya user ko control do:
const maxSteps = input.maxSteps ?? DEFAULT_MAX_STEPS;
```

---

### FIX #7 — needsPlanning() Sirf Keywords Check Karta Hai

**File:** `server/agents/planning/index.ts`  
**Severity:** MEDIUM  
**Problem:**

```javascript
// Sirf simple keyword matching:
if (goal.includes("build") || goal.includes("create full")) → planning
// "Build a button" aur "Build a complete SaaS platform" — dono same route!
```

**Fix karna hai:**
```typescript
// LLM se pehle complexity score puchho
// Ya goal ki length + keyword density se better heuristic banao
const complexityScore = await estimateGoalComplexity(goal);
return complexityScore > PLANNING_THRESHOLD;
```

---

### FIX #8 — Context Compressor: Critical Info Drop

**File:** `server/agents/core/tool-loop/continuation/context-compressor.ts`  
**Severity:** MEDIUM  
**Problem:**

```
Long runs me context compress hota hai (LLM token limit ke wajah se)
Compressor LLM-generated summary banata hai
Critical file paths / decisions silently drop ho sakte hain
```

**Fix karna hai:**
```typescript
// Important tool results ko "pinned" mark karo → compress se exempt karo
// Structured summary format use karo (JSON nahi plain text)
// Summary ke saath original key facts ka index raho
```

---

### FIX #9 — Visual Validation: Sirf HTTP 200 Check

**File:** `server/verification/index.ts`  
**Severity:** HIGH (Feature Gap)  
**Problem:**

```
Verification engine check karta hai: HTTP 200 mila? → ✅ done
Lekin page blank ho sakta hai aur 200 bhi aa sakta hai
Agent ko pata nahi chalta UI actually kaam kar rahi hai ya nahi
```

**Fix karna hai:**
```typescript
// Playwright/Puppeteer se headless browser screenshot lo
// Screenshot ko LLM ko bhejo for visual verification
// Ya kam se kam page title aur basic DOM structure check karo
```

---

### FIX #10 — Memory Retrieval: Similarity Only, No Semantic

**File:** `server/agents/core/memory/orchestrator.ts`  
**Severity:** LOW-MEDIUM  
**Problem:**

```
Memory retrieve hoti hai string similarity se
"ESM imports" memory "CSS imports" task ke liye bhi aa sakti hai
Wrong memories LLM ko confuse kar sakti hain
```

**Fix karna hai:**
```typescript
// Metadata tags add karo memories pe (language, framework, project_type)
// Retrieval me metadata filter bhi lagao
// Relevance threshold increase karo (0.7 → 0.85)
```

---

### FIX #11 — ProjectId Hardcoded localStorage Me

**File:** `client/src/components/chat/useAgentRunner.ts` (Line 27)  
**Severity:** MEDIUM  
**Problem:**

```javascript
const projectId = Number(window.localStorage.getItem("nura.projectId") || "1") || 1;
// Fallback = 1, always!
// Multi-project support broken hai
```

**Fix karna hai:**
```typescript
// URL params ya React Context se projectId lena chahiye
const { projectId } = useParams(); // wouter se
// Ya global project context:
const { activeProject } = useProjectContext();
```

---

### FIX #12 — Listener Leak Warning Already Aa Rahi Hai

**Runtime Log Evidence:**
```
[subscription-manager] LISTENER LEAK DETECTED: "agent.event" has 7 listeners 
(expected ≤ 6). Check for unremoved bus.subscribe() / bus.on() calls.
```

**File:** `server/infrastructure/events/core/subscription-manager.ts`  
**Severity:** HIGH  
**Problem:**

```
SSE connections close hone ke baad listeners properly cleanup nahi ho rahe
Memory leak + potential wrong-project events
```

**Fix karna hai:**
```typescript
// Har SSE connection close pe:
req.on("close", () => {
  cleanup(); // ← ye already hai but kuch paths me miss ho raha hai
  bus.removeAllListeners("agent.event"); // force cleanup
});
```

---

### FIX #13 — planner.service.ts: BASE_URL Hardcoded

**File:** `server/agents/planning/planner.service.ts` (Line 12)  
**Severity:** LOW  
**Problem:**

```javascript
const BASE_URL = "https://openrouter.ai/api/v1/chat/completions"; // hardcoded!
// LLM_BASE_URL env var ignore ho raha hai planning agent me
```

**Fix karna hai:**
```typescript
const BASE_URL = process.env.LLM_BASE_URL 
  || process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL 
  || "https://openrouter.ai/api/v1/chat/completions";
```

---

### FIX #14 — mock-diffs.ts: Mock Data Production Me

**File:** `client/src/components/diff/mock-diffs.ts`  
**Severity:** MEDIUM  
**Problem:**

```javascript
// TODO: add auth routes
// TODO: add methods
// Fake diff data production UI me dikhta hai
```

**Fix karna hai:**
- Mock data sirf development/testing me use ho
- Production me real diffs hi dikho
- `if (process.env.NODE_ENV === 'development')` se guard karo

---

### FIX #15 — Agents Configuration: DEBUG Flag Risk

**File:** `server/agents/config/index.ts` (Line 4)  
**Severity:** MEDIUM (Security)  
**Problem:**

```typescript
const DEBUG = process.env['DEBUG'] === 'true'; // default false, achha hai
// Lekin koi bhi env me DEBUG=true set kar sakta hai
// Production me sensitive agent internals expose ho sakte hain
```

**Fix karna hai:**
```typescript
// Production me DEBUG kabhi enable na ho
const DEBUG = process.env.NODE_ENV !== 'production' && process.env['DEBUG'] === 'true';
```

---

## PART 5 — COMPLETE SYSTEM FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER                                      │
│         "Build me a customer dashboard with login"               │
└────────────────────────┬────────────────────────────────────────┘
                         │ Type + Send
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  HOME PAGE (client/src/pages/core/home.tsx)                     │
│  handleSend() → navigate("/workspace") → POST /api/run          │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP POST
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  RUN CONTROLLER (server/chat/run/controller.ts)                 │
│  runId generate → DB insert → needsPlanning() → route           │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┼──────────────────┐
         ▼               ▼                  ▼
    Pipeline         Planned Run        Tool Loop
    (9 phases)    (decompose+loop)    (direct ReAct)
         └───────────────┬──────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  TOOL LOOP AGENT (server/agents/core/tool-loop/tool-loop.agent) │
│  THINK → ACT → OBSERVE → REFLECT → RETRY → VALIDATE            │
│                                                                  │
│  LLM calls tools:                                               │
│    read_file → write_file → shell_exec → install_package        │
│    → start_server → check_health → task_complete               │
└──┬──────────────┬──────────────┬──────────────┬────────────────┘
   │              │              │              │
   ▼              ▼              ▼              ▼
File Sys       Console        Runtime       SSE Events
.sandbox/     stdout/stderr   Health        → Frontend
projectId/    capture         probes
   │              │              │              │
   ▼              ▼              ▼              ▼
┌──────┐    ┌─────────┐   ┌─────────┐   ┌──────────────┐
│ FILE │    │ CONSOLE │   │ PREVIEW │   │ CHAT PANEL   │
│EXPLO-│    │  PANEL  │   │  PANEL  │   │ (messages +  │
│ RER  │    │ (logs)  │   │ (iframe)│   │  actions)    │
└──────┘    └─────────┘   └─────────┘   └──────────────┘
   │              │              │              │
   └──────────────┴──────────────┴──────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  VERIFICATION ENGINE│
              │  TS + Runtime + HTTP│
              └──────────┬──────────┘
                         │
              PASS ───────┴─────── FAIL
                │                    │
                ▼                    ▼
            RUN COMPLETE         SELF-HEAL
            Memory save          Loop again
            Checkpoint           (max 3x)
```

---

## SUMMARY TABLE — FIX PRIORITY

| # | Issue | File | Severity | Impact |
|---|---|---|---|---|
| 1 | Navigation / back button | `navigation-system.ts` | 🔴 HIGH | UX broken |
| 2 | WebSocket listener leak | `navigation-system.ts` | 🔴 HIGH | Memory leak |
| 3 | SSE listener leak warning | `subscription-manager.ts` | 🔴 HIGH | Wrong events |
| 4 | Tab switch content loss | `CenterPanel.tsx` | 🟡 MEDIUM | UX annoyance |
| 5 | Empty catch blocks | Multiple | 🟡 MEDIUM | Silent failures |
| 6 | maxSteps hard cap = 25 | `tool-loop.agent.ts` | 🟡 MEDIUM | Complex tasks fail |
| 7 | needsPlanning() weak | `planning/index.ts` | 🟡 MEDIUM | Wrong routing |
| 8 | Context compressor loss | `context-compressor.ts` | 🟡 MEDIUM | Agent forgets |
| 9 | No visual validation | `verification/index.ts` | 🟡 MEDIUM | Blank page pass |
| 10 | ProjectId hardcoded | `useAgentRunner.ts` | 🟡 MEDIUM | Multi-project broken |
| 11 | alert() in file explorer | `FileExplorer.tsx` | 🟢 LOW | Ugly UI |
| 12 | Memory retrieval weak | `memory/orchestrator.ts` | 🟢 LOW | Wrong memories |
| 13 | BASE_URL hardcoded | `planner.service.ts` | 🟢 LOW | Config ignored |
| 14 | Mock diffs in production | `mock-diffs.ts` | 🟡 MEDIUM | Fake data shown |
| 15 | DEBUG flag in production | `agents/config/index.ts` | 🟡 MEDIUM | Security risk |

---

*Report generated from direct codebase inspection, runtime logs, and live system observation.*  
*File: `NURA_X_SYSTEM_DEEP_REPORT.md`*
