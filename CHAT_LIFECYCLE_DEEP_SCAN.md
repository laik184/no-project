# Chat System — Deep Scan & Lifecycle Flow Report

> **Scope:** `client/src/components/chat/` ka poora internals +  
> `server/chat/` ka poora internals +  
> NURA-X vs Replit Chat System comparison  
> **Files Scanned:** 35+ files (client + server)

---

## TABLE OF CONTENTS

1. [Chat System Bird's Eye View](#1-birds-eye-view)
2. [Client-Side File Map](#2-client-side-file-map)
3. [Server-Side File Map](#3-server-side-file-map)
4. [Complete Message Lifecycle Flow](#4-complete-message-lifecycle-flow)
5. [Component-by-Component Deep Dive](#5-component-by-component-deep-dive)
6. [Hook-by-Hook Deep Dive](#6-hook-by-hook-deep-dive)
7. [Server-Side Execution Pipeline](#7-server-side-execution-pipeline)
8. [SSE Realtime System Deep Dive](#8-sse-realtime-system-deep-dive)
9. [Event Type Encyclopedia](#9-event-type-encyclopedia)
10. [State Machine Diagram](#10-state-machine-diagram)
11. [Token Streaming Deep Dive](#11-token-streaming-deep-dive)
12. [Recovery & Reconnection System (C6)](#12-recovery--reconnection-system-c6)
13. [NURA-X vs Replit Chat — Comparison](#13-nura-x-vs-replit-chat--comparison)
14. [Full End-to-End Lifecycle Diagram](#14-full-end-to-end-lifecycle-diagram)

---

## 1. BIRD'S EYE VIEW

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CHAT SYSTEM OVERVIEW                            │
│                                                                     │
│   USER TYPES MESSAGE                                                │
│          │                                                          │
│          ▼                                                          │
│   ┌─────────────┐     ┌──────────────┐     ┌──────────────────┐   │
│   │  ChatInput  │────▶│  useAgent    │────▶│  POST /api/run   │   │
│   │  (UI Layer) │     │  Runner      │     │  (HTTP)          │   │
│   └─────────────┘     │  (Hook)      │     └────────┬─────────┘   │
│                       └──────┬───────┘              │ runId back  │
│                              │                      ▼             │
│   ┌───────────────────┐      │              ┌──────────────────┐   │
│   │  RealtimeProvider │◀─────┘              │  RunController   │   │
│   │  (SSE Connection) │                     │  (Server)        │   │
│   │  /api/realtime    │                     └────────┬─────────┘   │
│   └────────┬──────────┘                             │             │
│            │ events stream                          ▼             │
│            ▼                                ┌──────────────────┐   │
│   ┌────────────────────┐                    │  orchestrate()   │   │
│   │ agent-event-handler│                    │  (Planned Exec)  │   │
│   │ (switch block)     │                    └────────┬─────────┘   │
│   └────────┬───────────┘                            │             │
│            │ state updates                          ▼             │
│            ▼                                ┌──────────────────┐   │
│   ┌────────────────────┐                    │  Agent Runs      │   │
│   │  ChatMessages      │                    │  (170 tools)     │   │
│   │  (Render Layer)    │                    └────────┬─────────┘   │
│   └────────────────────┘                            │             │
│                                             bus.emit() events      │
│                                             → SSE fan-out          │
│                                             → Browser receives     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. CLIENT-SIDE FILE MAP

### Poore 11 Files ka Role

```
client/src/components/chat/
│
├── index.tsx                ← ChatPanel (ROOT COMPONENT)
│   Role: Sab kuch yahan se shuru hota hai.
│   Manages: showNewChatScreen, showHistoryPanel, chatInput state
│   Owns: handleSend(), handleSelectPrompt(), handleOpenFile()
│   Renders: ChatHeader + ChatMessages + ChatInput
│
├── useAgentRunner.ts        ← CORE ORCHESTRATOR HOOK
│   Role: Chat ka "brain" — run start karna, SSE subscribe karna,
│          stop karna, answer dena.
│   Owns: messages[], isAgentThinking, isAgentTyping, activeAction
│   Calls: POST /api/run → gets runId
│   Subscribes: "agent", "checkpoint", "lifecycle" topics
│
├── agent-event-handler.ts   ← EVENT SWITCH BLOCK (pure factory)
│   Role: SSE se aane wale har event ko handle karta hai.
│   Pattern: buildAgentHandler(deps) → handler function
│   Handles: 20+ event types (token, thinking, tool_call, recovery, etc.)
│   NOT a hook — ek plain function hai
│
├── ChatMessages.tsx         ← MESSAGE RENDER LAYER
│   Role: messages[] array ko render karta hai.
│   6 types handle karta hai:
│     user, agent, tool_group, diff, checkpoint, question
│   Auto-scrolls to bottom on new messages
│
├── ChatInput.tsx            ← INPUT LAYER
│   Role: Text input, file upload, send/stop button.
│   Features: Enter to send, Shift+Enter newline, file upload popup
│   Shows: "Stop" button jab agent busy ho
│
├── ChatHeader.tsx           ← HEADER + HISTORY PANEL
│   Role: "New Chat" button, history toggle
│   Shows: ChatHistoryPanel jab toggle ho
│
├── LiveActionBar.tsx        ← LIVE STATUS INDICATOR
│   Role: Agent kya kar raha hai realtime mein dikhata hai
│   2 components:
│     ThinkingBubble  → jab agent.thinking event aaye
│     LiveActionBar   → jab koi tool call chal raha ho
│   Animations: spin, pulse, bounce, flash, shake, ping
│
├── QuestionCard.tsx         ← CLARIFICATION QUESTION UI
│   Role: Agent ne kuch puchha → user ko options dikhao
│   On answer: POST /api/chat/answer
│
├── ToolGroupLine.tsx        ← TOOL CALL GROUP DISPLAY
│   Role: Ek "batch" of tool calls dikhata hai (completed actions)
│   Collapsible list of: file_write, shell_exec, git_commit, etc.
│
├── tool-maps.ts             ← TOOL → UI MAPPING (pure data)
│   Role: Har tool ke liye icon, color, emoji, animation define karta hai
│   3 maps:
│     TOOL_ICON_MAP      → lucide-react icon component
│     TOOL_COLOR_MAP     → hex color string
│     TOOL_ANIMATION_MAP → "spin"|"pulse"|"bounce"|"flash"|"ping"|"shake"
│     TOOL_EMOJI_MAP     → emoji string
│
├── tool-helpers.ts          ← API HELPER FUNCTIONS
│   Role: fetchFileContent(), fetchChatHistory(), fetchChatPrompts()
│   Pure async functions, no hooks
│
└── types.ts                 ← TYPE DEFINITIONS
    Role: ChatMessage union type define karta hai
    6 message roles:
      user | agent | tool_group | diff | checkpoint | question
```

---

## 3. SERVER-SIDE FILE MAP

### Poore Server Chat Files ka Role

```
server/chat/
│
├── orchestrator.ts          ← ENTRY POINT SINGLETON
│   Class: ChatOrchestrator
│   Exports: chatOrchestrator (singleton)
│   Methods:
│     buildChatRouter()  → POST /chat/run, GET /chat/run/:id, cancel
│     buildSseRouter()   → /api/realtime SSE endpoint
│     attachWebSocket()  → /ws/terminal WebSocket
│     startPersistence() → console log flush start
│
├── run/
│   ├── controller.ts    ← RUN LIFECYCLE CONTROLLER
│   │   Class: RunController
│   │   runGoal(input):
│   │     1. newRunId() generate
│   │     2. DB mein agentRuns row insert
│   │     3. bus.emit("run.lifecycle", { status: "started" })
│   │     4. executePlannedRun() async chalao
│   │     5. RunHandle return karo immediately
│   │
│   ├── planned.executor.ts  ← ORCHESTRATION ENTRY
│   │   GOVERNANCE RULE: server/agents/ ko directly import nahi kar sakta
│   │   Does: orchestrate() call karta hai — single authoritative entry point
│   │   Wraps in: withRunLifecycle() for lifecycle tracking
│   │
│   ├── tool-loop.executor.ts ← TOOL LOOP (STUB)
│   │   NOTE: Tool-loop agent removed — OPENROUTER_API_KEY needed
│   │   Currently: warning emit + phase.failed event
│   │   Full version: LLM step-by-step tool calling loop
│   │
│   ├── run-lifecycle.ts     ← LIFECYCLE UTILITIES
│   │   emitAgentEvent()   → bus.emit("agent.event", ...)
│   │   withRunLifecycle()  → try/catch + DB update + lifecycle emit
│   │   finalizeRun()      → status = success|failed|cancelled
│   │
│   ├── registry.ts          ← IN-MEMORY RUN REGISTRY
│   │   Map<runId, RunHandle>
│   │   newRunId(), registerRun(), getRun()
│   │   requestCancel(), isCancelled(), clearCancel()
│   │
│   ├── event-persist.ts     ← RUN EVENT DB PERSISTENCE
│   ├── executor.ts          ← BASE EXECUTOR
│   ├── active-project.ts    ← ACTIVE PROJECT TRACKER
│   ├── code-files.ts        ← CODE FILE UTILITIES
│   ├── question-bus.ts      ← CLARIFICATION Q&A BUS
│   ├── tool-reference.ts    ← TOOL REFERENCE HELPERS
│   └── types.ts             ← RunHandle, RunInput types
│
├── streams/
│   ├── sse.ts               ← SSE GATEWAY (MAIN REALTIME ENDPOINT)
│   │   GET /api/realtime
│   │   Hub fan-out pattern — ONE bus listener per event type
│   │   C6 replay: missed events replay on reconnect
│   │   sseManager.register() → connection pool entry
│   │
│   ├── sse-utils.ts         ← SSE HEADER/WRITE UTILITIES
│   │   setupSse()  → headers set karo
│   │   sseSendId() → id: field ke saath event bhejo
│   │   onClose()   → disconnect cleanup
│   │
│   └── ws-server.ts         ← WEBSOCKET SERVER (/ws/terminal)
│
├── routes/
│   ├── messages.routes.ts   ← GET/POST /api/chat/messages
│   ├── history.routes.ts    ← GET /api/chat/history
│   ├── feedback.routes.ts   ← POST /api/chat/feedback
│   ├── prompts.routes.ts    ← GET /api/chat/prompts
│   ├── upload.routes.ts     ← POST /api/chat/upload (files)
│   └── stream.routes.ts     ← Streaming routes
│
└── events/
    ├── bus.ts               ← Re-export of infrastructure event bus
    └── console-log-persister.ts ← 500ms batch console flush
```

---

## 4. COMPLETE MESSAGE LIFECYCLE FLOW

### User "Build a todo app" type karta hai — kya hota hai?

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 — INPUT CAPTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ChatInput.tsx
  User: "Build a todo app" type karta hai
  User: Enter press karta hai
       ↓
  handleKeyDown() → e.key === "Enter" && !e.shiftKey → onSend()
       ↓
ChatPanel/index.tsx → handleSend()
  1. chatInput.trim() check (empty nahi hona chahiye)
  2. isAgentThinking || isAgentTyping check (already busy nahi hona chahiye)
  3. setChatInput("") → input clear
  4. setShowNewChatScreen(false)
  5. runAgent("Build a todo app") call

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 2 — RUN START (useAgentRunner.ts → runAgent)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

useAgentRunner.ts → runAgent("Build a todo app")
  1. setMessages(prev => [...prev, { role: "user", content: msg }])
     → User message chat mein appear hota hai
  2. setIsAgentThinking(true)
  3. setActiveAction({ tool: "analysis.think", content: "Connecting…" })
     → ThinkingBubble UI mein appear hoti hai
  4. getAgentMode() → "planned" ya "tool-loop"
  5. HTTP POST /api/run:
     {
       projectId: 1,
       goal: "Build a todo app",
       mode: "planned"
     }
     Headers: x-project-id: 1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 3 — SERVER: RUN REGISTRATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

server/api/run.routes.ts → POST /api/run
  → chatOrchestrator.runManager.runGoal(input) call

RunController.runGoal():
  1. runId = newRunId()  → e.g. "run-a1b2c3d4"
  2. handle = { runId, projectId, status: "running", startedAt }
  3. registerRun(handle) → in-memory Map mein store
  4. DB INSERT agentRuns: { id: runId, goal, status: "running" }
  5. bus.emit("run.lifecycle", { runId, status: "started" })
  6. executePlannedRun(handle, input) → ASYNC FIRE AND FORGET (void)
  7. RETURN { ok: true, data: { runId } } to client IMMEDIATELY

Client receives runId — ab woh jaanta hai kaun sa run track karna hai.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 4 — CLIENT: SSE SUBSCRIPTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

useAgentRunner.ts (runId received ke baad)
  inflight = new Map()  ← tool call accumulator
  flushGroup = () → inflight → messages mein push

  3 subscriptions:
  1. subscribe("agent",      buildAgentHandler({runId, inflight, ...}))
     → Sabse important — tool calls, thinking, streaming, recovery
  2. subscribe("checkpoint", handler)
     → Snapshot save hone par toast show karo
  3. subscribe("lifecycle",  handler)
     → Run complete/failed/cancelled hone par cleanup

  agentStreamRef.current = {
    close: () => { offAgent(); offCheckpoint(); offLifecycle(); }
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 5 — SERVER: ORCHESTRATION EXECUTION (background, async)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

planned.executor.ts → executePlannedRun()
  1. emitAgentEvent({ eventType: "phase.started", phase: "orchestration" })
  2. ensureProjectDir(projectId) → .sandbox/<id>/ create karo
  3. orchestrate({
       orchestrationId, runId, projectId,
       sandboxRoot: ".sandbox",
       goal: "Build a todo app",
       timeoutMs: 120_000
     })
  4. orchestrate() internally:
     → Planner Agent: goal → task DAG
     → Executor Agent: task by task (file writes, shell, db, etc.)
     → Each tool call → bus.emit("agent.event", { eventType: "agent.tool_call" })
     → Each file write → bus.emit("agent.event", { eventType: "file.written" })
     → Each phase → "phase.started" / "phase.completed"
     → LLM response tokens → "agent.stream.start" + "agent.token" × N + "agent.stream.end"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 6 — SSE: EVENT FAN-OUT TO BROWSER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

bus.emit("agent.event", event)
      │
      ▼
infrastructure/events/bus.ts (EventEmitter)
      │
      ▼
subscription-manager.ts (ONE listener per topic)
      │ fan-out
      ▼
sseManager.register() pool — sabhi connected clients
      │
      ▼ SSE response.write()
GET /api/realtime (browser EventSource)
      │
      ▼
RealtimeProvider.dispatch("agent")
      │
      ▼
handlersRef.current.get("agent") → Set<handlers>
      │
      ▼
buildAgentHandler() return value (per-run handler)
      │
      ▼ (switch on eventType)
React state updates → UI re-render

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 7 — CLIENT: EVENT PROCESSING (agent-event-handler.ts switch block)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EVENT: agent.thinking
  → setIsAgentThinking(true)
  → setActiveAction({ tool: "analysis.think", content: "Thinking…" })
  → ThinkingBubble dikhta hai

EVENT: plan.created { phases: 3, phaseList: [{title: "Setup"}, ...] }
  → flushGroup()
  → setMessages(prev => [...prev, { role: "agent", content: "**Execution Plan**\n1. Setup\n2. Backend\n3. Frontend" }])

EVENT: agent.tool_call { tool: "file_write", label: "Writing schema.ts" }
  → item = { tool: "file_write", content: "Writing schema.ts", status: "running" }
  → inflight.set("::file_write", item)
  → setActiveAction(item)
  → LiveActionBar shows: ✍️ file_write  Working...

EVENT: file.written { path: "shared/schema.ts" }
  → inflight.set("file::shared/schema.ts", { tool: "file_write", status: "done" })

EVENT: agent.stream.start
  → finalizeStream()
  → setIsAgentThinking(false)
  → startStream() → messages mein { role: "agent", content: "", isStreaming: true } push

EVENT: agent.token { token: "Here" }
EVENT: agent.token { token: " is" }
EVENT: agent.token { token: " your" }
  → pushToken() → TokenBuffer mein push → RAF flush → content update
  → UI: streaming cursor blink karta hai

EVENT: agent.stream.end
  → finalizeStream() → isStreaming: false → cursor band

EVENT: agent.tool_call { tool: "task_complete", status: "running" }
  → flushGroup() → inflight flush → tool_group message appear
  → setIsAgentTyping(true) → typing indicator show

EVENT: agent.message { text: "I've built your todo app..." }
  → finalizeStream() + flushGroup()
  → messages mein agent message push
  → setIsAgentTyping(false)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 8 — RUN COMPLETION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SERVER: withRunLifecycle() → finalizeRun()
  1. DB UPDATE agentRuns SET status = "success", endedAt = now()
  2. bus.emit("run.lifecycle", { runId, status: "completed" })

CLIENT: lifecycle handler
  1. finalizeStream()
  2. flushGroup()
  3. agentStreamRef.current.close() → 3 subscriptions unsubscribe
  4. currentRunIdRef.current = null
  5. setIsAgentThinking(false)
  6. setIsAgentTyping(false)
  7. setActiveAction(null)
  8. setMessages(prev => [
       ...prev,
       { role: "agent", content: "Done — finished "Build a todo app"." },
       { role: "checkpoint", checkpoint: { label: "Build a todo app", ... } }
     ])

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 5. COMPONENT-BY-COMPONENT DEEP DIVE

### ChatPanel (index.tsx) — ROOT

```
STATE                          PROPS
──────────────────────         ──────────────────
chatInput: string              inputRef?: RefObject<textarea>
showNewChatScreen: boolean     currentAction?: AgentStreamItem
showHistoryPanel: boolean      onOpenFile?: (path, content, lang) => void

FROM useAgentRunner:
  messages, setMessages
  isAgentThinking, isAgentTyping
  activeAction, setActiveAction
  runAgent, stopAgent, handleAnswer

FROM useQuery:
  chatHistory    ← /api/chat/history
  suggestedPrompts ← /api/chat/prompts

SPECIAL BEHAVIORS:
  1. URL ?prompt= param → auto-send after 1800ms
  2. External currentAction sync → setActiveAction (from workspace toolbar)
  3. onOpenFile → Monaco editor mein file open karna
```

### ChatInput (ChatInput.tsx)

```
STATE                     KEY BEHAVIORS
──────────────────────    ──────────────────────────────────────────
showPopup: boolean        Enter → onSend() (Shift+Enter = newline)
                          isBusy = isAgentThinking || isAgentTyping

VISUAL STATES:
  Normal:  border = rgba(255,255,255,0.09)
  Busy:    border = rgba(124,141,255,0.4) + glow shadow
  
  Placeholder:
    Normal: "Make, test, iterate..."
    Thinking: "Agent is working…"
    Typing: "Agent is responding…"

  Send Button → Send icon (gradient purple)
  Stop Button → Red "Stop" (jab isBusy)

FILE UPLOAD:
  + button → popup:
    "Upload File" → .pdf,.zip,.tar,.gz,.txt,.csv,.json,.md
    "Upload Photo" → image/*
  POST /api/chat/upload (FormData)
```

### ChatMessages (ChatMessages.tsx)

```
6 MESSAGE TYPES ka render:

1. role: "user"
   → Right-aligned bubble
   → Purple bg: rgba(124,141,255,0.18)

2. role: "agent"
   → Left-aligned with bot avatar
   → AgentMarkdown component (markdown render)
   → isStreaming: true → blinking cursor

3. role: "tool_group"
   → ToolGroupLine component
   → Collapsed list of completed tool actions

4. role: "diff"
   → FileDiffCard component
   → Code diff viewer

5. role: "checkpoint"
   → CheckpointCard component
   → "Safety snapshot saved" with restore option

6. role: "question"
   → QuestionCard component
   → Multiple choice options for user

BOTTOM INDICATORS (in order of priority):
  if (activeAction.tool === "analysis.think") → ThinkingBubble
  if (activeAction && not thinking)           → LiveActionBar
  if (isAgentTyping)                          → Typing animation

AUTO-SCROLL: useEffect → endRef.scrollIntoView({ behavior: "smooth" })
             Triggers on: messages change OR isAgentThinking change
```

### LiveActionBar (LiveActionBar.tsx)

```
TOOL → ANIMATION MAPPING:
  file_write      → bounce  🟩
  file_delete     → shake   🔴
  shell_exec      → flash   ⚡
  package_install → spin    📦
  server_restart  → spin    🔄
  db_push         → ping    🗄️
  git_clone       → spin    📥
  deploy_publish  → bounce  🚀
  debug_run       → shake   🐛
  browser_eval    → pulse   🖥️

CSS ANIMATIONS (all defined inline):
  la-spin   → rotate 360deg, 0.85s linear
  la-pulse  → scale 1→1.35, 1.1s ease-in-out
  la-bounce → translateY 0→-4px, 0.75s
  la-flash  → opacity 1→0.12, 0.65s
  la-shake  → rotate -14→14deg, 0.45s
  la-ping   → scale 1→2, opacity 0.9→0, 1.1s

THINKING BUBBLE (special case):
  Brain icon + "Thinking" text + 3 bouncing dots
  la-glow-pulse → purple glow on avatar
```

---

## 6. HOOK-BY-HOOK DEEP DIVE

### useAgentRunner.ts — MASTER HOOK

```
RESPONSIBILITIES:
  ✓ Run start karna (POST /api/run)
  ✓ 3 SSE topics subscribe karna
  ✓ Agent event handler wire karna
  ✓ Token streaming coordinate karna
  ✓ Run stop/cancel karna
  ✓ Answer submit karna
  ✓ Page refresh recovery (via useRunReattach)

INTERNAL REFS (stable, never cause re-render):
  agentStreamRef   → { close() } — current SSE subscription bundle
  currentRunIdRef  → string | null — active run ID

DELEGATES TO:
  useTokenStream   → startStream, pushToken, finalizeStream
  useRunReattach   → C6 page-refresh recovery
  buildAgentHandler → per-run event switch block
  useRunRecovery   → activeRunId (DB se check)
  useRealtime      → subscribe fn (from RealtimeProvider)
```

### useTokenStream.ts — TOKEN STREAMING HOOK

```
PROBLEM SOLVED:
  Server LLM tokens ek-ek karke aate hain (agent.token events).
  Inhe efficiently buffer karke React state update karna.

ARCHITECTURE:
  TokenBuffer class (RAF-based batching)
    → push(token) → internal queue
    → requestAnimationFrame → flush callback
    → flush: queue join → setMessages update

FLOW:
  startStream() → { role: "agent", content: "", isStreaming: true } push
                   TokenBuffer create
  pushToken()   → buffer.push(token)
  finalizeStream() → buffer.destroy()
                     isStreaming: false set
                     activeRef.current = false

WHY RAF:
  100 tokens/sec aa sakte hain.
  Har token par React re-render = jank.
  RAF batch: ~60fps pe flush = smooth streaming.
```

### useRunReattach.ts — C6 RECOVERY HOOK

```
PROBLEM SOLVED:
  User page refresh karta hai mid-run.
  Active run abhi bhi server pe chal raha hai.
  UI ko reconnect karna padega without losing state.

HOW IT WORKS:
  1. useRunRecovery(projectId) → DB se activeRunId fetch
     (running status wala agentRuns row)
  2. Agar activeRunId mila aur currentRunIdRef.current null hai:
     → setIsAgentThinking(true)
     → setActiveAction("↻ Reconnected…")
     → setMessages([reconnection message])
     → subscribe("agent", lightweight handler)
     → subscribe("lifecycle", completion handler)
  3. RealtimeProvider ne already C6 replay kiya hoga
     (?lastEventId= se missed events replay)

RESULT:
  User refresh kare → "↻ Reconnected to active run" dikhta hai
  → Run complete hone tak events stream hoti rehti hain
```

### RealtimeProvider.tsx — SINGLETON SSE CONNECTION

```
PROBLEM SOLVED:
  Pehle 15+ alag EventSource connections the.
  Har component apna connection kholta tha.
  Ek provider → sab ko serve karo.

ARCHITECTURE:
  ONE EventSource to /api/realtime
  handlersRef: Map<topic, Set<handler>>
  
  subscribe(topic, handler):
    → handlersRef.get(topic).add(handler)
    → returns unsubscribe fn (handler remove karo)
  
  dispatch(topic)(event):
    → JSON.parse(event.data)
    → handlersRef.get(topic).forEach(h => h(data))

RECONNECT STRATEGY:
  Exponential backoff: 1s → 2s → 4s → ... → 30s cap
  C6: lastEventId track karo → /api/realtime?lastEventId=N

STATUS:
  "connected"    → onopen fired
  "reconnecting" → onerror fired, retrying
  "offline"      → provider unmounted
```

---

## 7. SERVER-SIDE EXECUTION PIPELINE

```
POST /api/run  ← HTTP request
      │
      ▼
RunController.runGoal()
      │
      ├─ newRunId()              → "run-abc123"
      ├─ registerRun(handle)     → in-memory Map
      ├─ DB INSERT agentRuns     → status: "running"
      ├─ bus.emit run.lifecycle  → status: "started"
      ├─ return { runId }        → CLIENT KO IMMEDIATELY
      │
      └─ void executePlannedRun() → BACKGROUND (async, fire-and-forget)
                    │
                    ▼
         planned.executor.ts
                    │
                    ├─ emitAgentEvent(phase.started)
                    ├─ ensureProjectDir()
                    │
                    └─ orchestrate({ runId, goal, ... })
                                  │
                                  ▼
                       orchestration/orchestrator.ts
                                  │
                                  ├─ Planner Agent
                                  │   → LLM call: goal → task DAG
                                  │   → emit: plan.created
                                  │
                                  ├─ Executor Agent (per task)
                                  │   → Tool select
                                  │   → Tool invoke (sandbox)
                                  │   → emit: agent.tool_call (running)
                                  │   → Tool completes
                                  │   → emit: file.written / agent.tool_call (done)
                                  │
                                  ├─ LLM Response
                                  │   → emit: agent.stream.start
                                  │   → emit: agent.token × N
                                  │   → emit: agent.stream.end
                                  │
                                  └─ Completion
                                      → emit: agent.message (final text)
                                      → emit: agent.tool_call (task_complete)
                                      │
                                      ▼
                         withRunLifecycle() → finalizeRun()
                                      │
                                      ├─ DB UPDATE status = "success"
                                      └─ bus.emit run.lifecycle (completed)
```

---

## 8. SSE REALTIME SYSTEM DEEP DIVE

### Hub Fan-Out Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     SSE HUB FAN-OUT PATTERN                          │
│                                                                      │
│  infrastructure/events/bus.ts                                        │
│  (Node.js EventEmitter)                                              │
│       │                                                              │
│       │ ONE bus.on() per topic                                       │
│       ▼                                                              │
│  subscription-manager.ts                                             │
│  (sab topics ke liye single listeners)                               │
│       │                                                              │
│       │ sseManager.broadcast(topic, data)                            │
│       ▼                                                              │
│  sse-manager.ts — Connection Pool                                    │
│  ┌──────────┬──────────┬──────────┬──────────┐                     │
│  │ conn-1   │ conn-2   │ conn-3   │ conn-N   │ ← registered SSE   │
│  │ topics:  │ topics:  │ topics:  │ topics:  │   clients           │
│  │ [agent,  │ [agent,  │ [console]│ [all]    │                     │
│  │  lifecycle│ file]   │          │          │                     │
│  └────┬─────┴────┬─────┴────┬─────┴────┬─────┘                     │
│       │          │          │          │                            │
│    browser    browser    browser    browser                         │
│    tab 1      tab 2      terminal   dashboard                       │
└──────────────────────────────────────────────────────────────────────┘

SSE Event Format (wire format):
  id: 1234\n
  event: agent\n
  data: {"eventType":"agent.thinking","runId":"run-abc","payload":{...}}\n\n
```

### C6 Replay System

```
PROBLEM: Browser disconnects for 5 seconds (network hiccup).
         Server ne 20 events emit kiye.
         Reconnect hone par 20 events miss ho gaye.

SOLUTION: Replay Cache (ring buffer, server-side)
  → Har event ek sequence ID (seqId) ke saath store hota hai
  → Ring buffer: last N events (e.g. last 500) in memory
  → Client reconnects: lastEventId=1200 bhejta hai
  → Server: replay(1200, requestedTopics) → events 1201–1220 bhejta hai
  → Client: gap fill ho jaata hai
  
CLIENT SIDE:
  RealtimeProvider.lastEventId → browser se track
  Reconnect URL: /api/realtime?lastEventId=1200
  
SERVER SIDE (sse.ts):
  rawLastId = req.headers["last-event-id"] ?? req.query.lastEventId
  missed = replay(lastSeqId, requested)
  for (const evt of missed) sseSendId(res, evt.topic, evt.data, evt.seqId)
```

### Topics Reference

```
Topic            → Who emits it          → Who listens
─────────────────────────────────────────────────────────
"agent"          → Agent events bus      → useAgentRunner, useRunReattach
"lifecycle"      → Run lifecycle         → useAgentRunner, useRunReattach
"checkpoint"     → Checkpoint system     → useAgentRunner (toast)
"console"        → Console pipeline      → Terminal component
"file"           → FS watcher            → File explorer component
"runtime.verified" → Runtime verifier   → Preview component
"runtime.observation" → Port observer   → Preview component
"runtime.sync"   → Runtime store        → Runtime dashboard
"runtime.port"   → Port allocator       → Port display
"diff"           → Diff approval system → Diff panel
"browser.session" → Browser agent       → Browser view
"tool.execution" → Tool registry        → Tool dashboard
"debug.lifecycle" → Debug manager       → Debug panel
"preview.lifecycle" → Preview pipeline  → Preview panel
```

---

## 9. EVENT TYPE ENCYCLOPEDIA

### "agent" Topic — Complete Event List

```
EVENT TYPE              | PAYLOAD              | EFFECT IN UI
─────────────────────────────────────────────────────────────────────
agent.thinking          | text, agentName      | ThinkingBubble show
agent.stream.start      | —                    | startStream() call
agent.token             | token: string        | pushToken() call
agent.stream.end        | —                    | finalizeStream()
agent.message           | text: string         | Final message push
agent.tool_call         | tool, label, args,   | LiveActionBar update
                        | status               | inflight Map update
agent.retry             | attempt, maxAttempts,| Retry status show
                        | delayMs, error       |
agent.replanning        | text, continuationCount | Re-plan indicator
agent.context_compressed| originalCount,       | Compression notice
                        | compressedCount      |
agent.continuation      | text, count          | Continuation badge
agent.question          | text, options,       | QuestionCard show
                        | questionId           |
agent.question.answered | questionId, answer   | QuestionCard update
                        |                      | + thinking start
plan.created            | phases, phaseList,   | Execution plan message
                        | complexity, risks    |
plan.progress           | completed, total,    | Phase progress bar
                        | currentPhase, percent|
phase.started           | label, phase         | inflight entry create
phase.completed         | phase, payload       | inflight entry update
phase.failed            | phase, error         | inflight error status
file.written            | path                 | inflight file entry
diff.queued             | path                 | inflight diff entry
file.diff               | diff object          | FileDiffCard render
recovery.started        | attempt, maxAttempts,| "Self-healing" message
                        | errorType            |
recovery.completed      | attempt, steps,      | Recovery success msg
                        | summary              |
recovery.failed         | attempt, maxAttempts,| Recovery failure msg
                        | reason               |
```

---

## 10. STATE MACHINE DIAGRAM

### useAgentRunner ke React States

```
                    ┌──────────────────┐
                    │      IDLE        │
                    │                  │
                    │ isThinking: false│
                    │ isTyping:  false │
                    │ activeAction: null│
                    └────────┬─────────┘
                             │ runAgent() called
                             ▼
                    ┌──────────────────┐
                    │   CONNECTING     │
                    │                  │
                    │ isThinking: true │
                    │ activeAction:    │
                    │  "Connecting…"   │
                    └────────┬─────────┘
                             │ runId received
                             ▼
                    ┌──────────────────┐
                    │    THINKING      │◀──────────────┐
                    │                  │               │
                    │ isThinking: true │    agent.thinking event
                    │ activeAction:    │               │
                    │  "analysis.think"│               │
                    └────────┬─────────┘               │
                             │                         │
               ┌─────────────┼─────────────┐           │
               │             │             │           │
    tool_call  │    stream   │   question  │           │
    event      │    start    │   event     │           │
               ▼             ▼             ▼           │
    ┌──────────────┐ ┌─────────────┐ ┌─────────────┐  │
    │  EXECUTING   │ │  STREAMING  │ │  WAITING    │  │
    │              │ │             │ │  FOR ANSWER │  │
    │ activeAction:│ │ isTyping:   │ │             │  │
    │  tool name   │ │  false      │ │ QuestionCard│  │
    │  animation   │ │ isStreaming: │ │  shown      │  │
    │              │ │  true       │ │             │  │
    └──────┬───────┘ └──────┬──────┘ └──────┬──────┘  │
           │               │              │           │
           │ task_complete  │ stream.end   │ answer    │
           ▼               ▼              └───────────┘
    ┌──────────────────────────────────┐
    │           RESPONDING             │
    │                                  │
    │ isTyping: true                   │
    │ activeAction: null               │
    │ (typing dots animation)          │
    └─────────────────┬────────────────┘
                      │ agent.message OR lifecycle.completed
                      ▼
                    ┌──────────────────┐
                    │   COMPLETED      │
                    │                  │
                    │ isThinking: false│
                    │ isTyping:  false │
                    │ activeAction: null│
                    │ checkpoint card  │
                    └──────────────────┘
```

---

## 11. TOKEN STREAMING DEEP DIVE

### RAF-Buffered Streaming

```
Server LLM response:
  "He" → "re " → "is " → "yo" → "ur " → "to" → "do " → "ap" → "p."

(100 tokens/sec possible)

WITHOUT BUFFER:
  Each token → setState() → React re-render
  100 re-renders/sec → UI jank, dropped frames

WITH TokenBuffer (RAF batch):

  token arrives → buffer.push("He")
  token arrives → buffer.push("re ")
  token arrives → buffer.push("is ")
                              ↓
  requestAnimationFrame fires (~16ms, 60fps)
                              ↓
  flush(): "He" + "re " + "is " = "Here is "
                              ↓
  setMessages: last agent message content += "Here is "
                              ↓
  ONE React re-render → smooth streaming

VISUAL:
  messages[last] = {
    role: "agent",
    content: "Here is your todo ap",  ← grows each RAF
    isStreaming: true                   ← blinking cursor shown
  }

  finalizeStream() call:
    → isStreaming: false
    → cursor hata
    → final content locked
```

---

## 12. RECOVERY & RECONNECTION SYSTEM (C6)

### C6: Page Refresh Mid-Run Recovery

```
SCENARIO:
  Agent "Build todo app" chal raha hai.
  User accidentally F5 press karta hai.
  Kya sab kuch lost ho jata hai?

  ANSWER: NO — C6 Recovery System

FLOW:
  1. PAGE REFRESH
     Browser close karta hai EventSource connection
     Server pe run continue karta rehta hai
  
  2. PAGE LOAD HOTI HAI
     RealtimeProvider mount → /api/realtime?lastEventId=N se connect
     Server: replay(N, topics) → missed events bhejta hai
     Browser: gap fill ho jata hai
  
  3. useRunRecovery(projectId)
     GET /api/chat/run/active → DB se active run check
     Agar "running" status run mila → activeRunId return
  
  4. useRunReattach({ activeRunId, ... })
     Detects activeRunId exists
     setMessages(["↻ Reconnected to active run..."])
     setIsAgentThinking(true)
     subscribe("agent", recovery handler)
     subscribe("lifecycle", completion handler)
  
  5. RESUME:
     Aage se events stream hoti rehti hain
     Run complete hone par normal cleanup

WHAT GETS RECOVERED:
  ✓ Active run detection
  ✓ Missed events (C6 replay)
  ✓ Future events (fresh subscription)
  ✓ Run completion notification

WHAT GETS LOST:
  ✗ Message history before refresh
    (DB se reload possible hai — not yet wired)
```

---

## 13. NURA-X vs REPLIT CHAT — COMPARISON

### Architecture Comparison

```
┌─────────────────────────────────────────────────────────────────────┐
│                    NURA-X CHAT                                       │
│                                                                     │
│  Transport:  SSE (Server-Sent Events) + WebSocket (terminal)        │
│  Endpoint:   GET /api/realtime (ONE connection, topic-multiplexed)  │
│  Protocol:   Custom event types (agent.token, agent.tool_call, ...) │
│  Streaming:  RAF-buffered TokenBuffer                                │
│  Recovery:   C6 — Last-Event-ID replay + useRunReattach             │
│  State:      React useState (in-memory, ephemeral)                  │
│  DB:         PostgreSQL (agentRuns table — run metadata)            │
│  Auth:       None (projectId via localStorage + header)             │
│  Message Types: user|agent|tool_group|diff|checkpoint|question      │
│  Tool Viz:   Real-time LiveActionBar with per-tool animations       │
│  Q&A:        QuestionCard (multiple choice, POST /api/chat/answer)  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    REPLIT CHAT (Replit Agent)                        │
│                                                                     │
│  Transport:  SSE + WebSocket                                        │
│  Endpoint:   Replit's internal realtime infrastructure              │
│  Protocol:   Replit-specific event system                           │
│  Streaming:  Token-by-token streaming                               │
│  Recovery:   Automatic reconnection with state persistence          │
│  State:      Persisted server-side + client hydration               │
│  DB:         Replit's internal storage                              │
│  Auth:       Replit Auth (authenticated user context)               │
│  Message Types: user|agent|action|diff|checkpoint                   │
│  Tool Viz:   Action feed with tool name + result                    │
│  Q&A:        Inline clarification in chat                           │
└─────────────────────────────────────────────────────────────────────┘
```

### Feature Comparison Table

| Feature | NURA-X | Replit |
|---|---|---|
| **SSE Connection** | Single /api/realtime (topic-multiplexed) | Per-session streams |
| **Token Streaming** | RAF-buffered TokenBuffer | Direct streaming |
| **Reconnection** | C6 Last-Event-ID + DB recovery | Auto-reconnect |
| **Tool Visualization** | LiveActionBar + per-tool icon/color/animation | AgentActionFeed |
| **Message Types** | 6 types incl. checkpoint + diff | Similar |
| **Q&A Flow** | QuestionCard (modal-like) | Inline in chat |
| **History** | DB-backed /api/chat/history | Cloud-persisted |
| **File Upload** | POST /api/chat/upload (files + photos) | Attachment support |
| **Suggested Prompts** | /api/chat/prompts (dynamic) | Built-in suggestions |
| **Agent Mode** | planned/tool-loop (getAgentMode()) | Single mode |
| **Recovery** | C6 page-refresh recovery | Session persistence |
| **Checkpoint** | Auto after completion | Manual + auto |
| **Cancel** | POST /api/run/:id/cancel | Stop button |
| **Telemetry** | Bus events + execution history | Internal telemetry |

### Lifecycle Flow Comparison

```
NURA-X CHAT LIFECYCLE:
  User message
    → POST /api/run
    → runId received
    → subscribe("agent" + "lifecycle" + "checkpoint")
    → Events stream via SSE /api/realtime
    → agent-event-handler switch block processes
    → React state updates → UI renders
    → lifecycle.completed → cleanup

REPLIT CHAT LIFECYCLE:
  User message
    → POST to Replit agent endpoint
    → Session ID received
    → Replit's realtime connects
    → Replit agent runs (planning → execution → verification)
    → Events stream (actions, outputs, diffs)
    → Replit UI renders (AgentActionFeed, diff viewer)
    → Completion → checkpoint optional
```

---

## 14. FULL END-TO-END LIFECYCLE DIAGRAM

```
╔═══════════════════════════════════════════════════════════════════════╗
║              NURA-X CHAT — COMPLETE LIFECYCLE                         ║
╚═══════════════════════════════════════════════════════════════════════╝

BROWSER (React App)                    SERVER (Express + Node.js)
═══════════════════                    ═══════════════════════════

                    ┌─── APP BOOTSTRAP ───┐
                    │                     │
<RealtimeProvider>  │                     │  chatOrchestrator.attachWebSocket()
  EventSource open ─────────────────────▶ │  chatOrchestrator.startPersistence()
  GET /api/realtime │                     │  loadAllTools() (170 tools sealed)
  "connected" status│                     │  initializePlanner()
                    │                     │  initializeExecutor()
                    └─────────────────────┘

                    ┌─── USER SENDS MESSAGE ───┐
                    │                          │
ChatInput           │                          │
  Enter key         │                          │
  onSend()          │                          │
  runAgent(msg)     │                          │
                    │                          │
useAgentRunner      │                          │
  POST /api/run ────────────────────────────▶  run.routes.ts
  {goal, projectId} │                          │
                    │                          │  RunController.runGoal()
  ← 200 {runId} ◀──────────────────────────── │  newRunId() + DB INSERT
                    │                          │  bus.emit("run.lifecycle", started)
                    │                          │  void executePlannedRun() → ASYNC
                    │                          │
  subscribe("agent")│                          │
  subscribe("lifecycle")                       │
  subscribe("checkpoint")                      │

                    ┌─── AGENT RUNS (ASYNC) ───┐
                    │                          │
                    │                    planned.executor.ts
                    │                          │
                    │                    orchestrate()
                    │                          │
                    │                    PLANNER AGENT
                    │                    LLM call → DAG
                    │                          │
                    │                    bus.emit("agent.event", plan.created)
                    │                          │
                    │      SSE event ◀──────── sseManager.broadcast()
                    │      topic: "agent"      │
                    │      { eventType:        │
                    │        "plan.created" }  │
                    │                          │
  agent-event-handler                         │
  switch → plan.created                        │
  setMessages ← plan message                  │
                    │                          │
                    │                    EXECUTOR AGENT
                    │                    task dequeue
                    │                    tool: file_write
                    │                          │
                    │                    bus.emit agent.tool_call (running)
                    │      SSE ◀────────────── │
  switch → tool_call│                          │
  inflight.set()    │                          │
  LiveActionBar ← ✍️ Writing schema.ts         │
                    │                          │
                    │                    file_write executes
                    │                    → atomic write to .sandbox/
                    │                    bus.emit file.written
                    │      SSE ◀────────────── │
  switch → file.written                        │
  inflight update   │                          │
                    │                          │
                    │                    LLM RESPONSE STREAM
                    │                    bus.emit agent.stream.start
                    │      SSE ◀────────────── │
  switch → stream.start                        │
  startStream() →   │                          │
  { isStreaming:true}│                          │
                    │                          │
                    │                    bus.emit agent.token "Here"
                    │                    bus.emit agent.token " is"
                    │                    bus.emit agent.token " your"
                    │      SSE ◀────────────── │
  pushToken() × N   │                          │
  TokenBuffer RAF   │                          │
  → content grows   │                          │
  → cursor blinks   │                          │
                    │                          │
                    │                    bus.emit agent.stream.end
                    │      SSE ◀────────────── │
  finalizeStream()  │                          │
  cursor stops      │                          │
                    │                          │
                    │                    task_complete tool call
                    │      SSE ◀────────────── │
  flushGroup() →    │                          │
  tool_group message│                          │
  isTyping: true    │                          │
  typing animation  │                          │
                    │                          │
                    │                    bus.emit agent.message
                    │      SSE ◀────────────── │
  agent message push│                          │
  isTyping: false   │                          │
                    │                          │
                    │                    withRunLifecycle → finalizeRun()
                    │                    DB UPDATE status=success
                    │                    bus.emit run.lifecycle completed
                    │      SSE ◀────────────── │
  lifecycle handler │                          │
  agentStream.close()                         │
  setIsThinking(false)                        │
  checkpoint card   │                          │
  "Done — finished" │                          │
                    │                          │
                    └──────────────────────────┘

                    ┌─── ERROR RECOVERY ───┐
                    │                      │
                    │                CRASH DETECTED
                    │                      │
                    │                bus.emit recovery.started
                    │      SSE ◀────────── │
  "Self-healing"    │                      │
  message show      │                      │
                    │                REPAIR + RETRY
                    │                      │
                    │                bus.emit recovery.completed
                    │      SSE ◀────────── │
  recovery success  │                      │
  message show      │                      │
                    └──────────────────────┘

╔═══════════════════════════════════════════════════════════════════════╗
║  SUMMARY: Chat = HTTP (start) + SSE (events) + React state (UI)      ║
║  3 SSE topics per run: "agent" + "lifecycle" + "checkpoint"          ║
║  20+ event types in agent-event-handler switch block                 ║
║  RAF-buffered token streaming for smooth LLM output                  ║
║  C6 recovery: page refresh mid-run survive karta hai                 ║
╚═══════════════════════════════════════════════════════════════════════╝
```

---

*Deep Scan by: NURA-X Architecture Analysis*  
*Files Covered: 35+ client + server files*  
*Report Date: 2025*
