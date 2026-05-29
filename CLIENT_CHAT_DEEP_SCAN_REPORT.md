# client/src/components/chat/ — COMPLETE DEEP SCAN REPORT
# Har File ka Poora Analysis + Replit Feature Comparison

---

## FOLDER OVERVIEW

```
client/src/components/chat/
├── index.tsx               ← ChatPanel (ROOT — sab kuch yahan se shuru)
├── useAgentRunner.ts       ← MASTER HOOK (run lifecycle coordinator)
├── agent-event-handler.ts  ← EVENT SWITCH (pure factory, 20+ event types)
├── ChatMessages.tsx        ← MESSAGE RENDERER (6 types handle karta hai)
├── ChatInput.tsx           ← INPUT BAR (send/stop/upload)
├── ChatHeader.tsx          ← HEADER + HISTORY PANEL
├── LiveActionBar.tsx       ← LIVE STATUS (ThinkingBubble + tool animations)
├── QuestionCard.tsx        ← Q&A CARD (clarification questions)
├── ToolGroupLine.tsx       ← TOOL BATCH DISPLAY (collapsible)
├── tool-helpers.ts         ← PURE ASYNC HELPERS (no hooks)
├── tool-maps.ts            ← TOOL → UI MAPPING (icons/colors/animations)
└── types.ts                ← TYPE DEFINITIONS (ChatMessage union)
```

---

## FILE 1: `index.tsx` — ChatPanel (ROOT COMPONENT)

### Kya karta hai?
ChatPanel poore chat pane ka root component hai. Yeh saari child components ko wire karta hai aur top-level state manage karta hai.

### Poora State Map
```typescript
const [chatInput, setChatInput]               // Textarea ki value
const [showNewChatScreen, setShowNewChatScreen] // Naya chat screen toggle
const [showHistoryPanel, setShowHistoryPanel]   // History panel toggle

// useAgentRunner se:
messages, setMessages        // ChatMessage[] array
isAgentThinking              // Agent kaam kar raha hai?
isAgentTyping                // Agent respond kar raha hai?
activeAction, setActiveAction // Current tool/thinking action
runAgent()                   // Run start karo
stopAgent()                  // Run cancel karo
handleAnswer()               // Q&A answer submit karo

// useQuery se:
chatHistory    // /api/chat/history se — past runs
suggestedPrompts // /api/chat/prompts se — prompt suggestions
```

### Special Behaviors
1. **URL Auto-Send**: `?prompt=` URL param se 1800ms baad auto send karta hai
2. **External Action Sync**: `currentAction` prop change hone par `setActiveAction` call
3. **File Open Handler**: Monaco editor mein file open karne ke liye `onOpenFile` prop

### Render Structure
```
ChatPanel
├── ChatHeader          (showHistoryPanel, onToggleHistory, onNewChat)
├── ChatHistoryPanel    (agar showHistoryPanel true hai)
└── (agar history nahi dikh rahi)
    ├── ChatMessages    (messages, thinking/typing state, prompts)
    └── ChatInput       (chatInput, send/stop handlers)
```

### Data Flow
```
handleSend() → trim check → runAgent(msg) → useAgentRunner se POST /api/run
                                           → SSE subscribe
                                           → React state updates → re-render
```

---

## FILE 2: `useAgentRunner.ts` — MASTER HOOK

### Kya karta hai?
Poore chat ka "brain". Run start karna, SSE events receive karna, stop karna, answer dena — sab kuch yahan se control hota hai.

### Dependencies
```
useToast         → toast notifications
useRealtime      → subscribe() fn (RealtimeProvider se)
useTokenStream   → startStream, pushToken, finalizeStream
useRunReattach   → C6 page-refresh recovery
useRunRecovery   → activeRunId (DB se active run check)
buildAgentHandler → per-run event switch block
getAgentMode()   → "planned" | "tool-loop"
```

### Stable Refs (re-render nahi karate)
```typescript
agentStreamRef.current  → { close() } — current SSE subscription bundle
currentRunIdRef.current → string | null — active run ID tracker
```

### runAgent() — Full Flow
```
1. setMessages(prev => [...prev, { role: "user", content: msg }])
2. setIsAgentThinking(true)
3. setActiveAction({ tool: "analysis.think", content: "Connecting…" })
4. getAgentMode() → "planned"
5. POST /api/run { projectId, goal: msg, mode: "planned" }
   ← Response: { ok: true, data: { runId: "run-abc123" } }
6. currentRunIdRef.current = runId
7. inflight = new Map()  ← per-run tool accumulator
8. flushGroup() define  ← inflight → messages mein push
9. subscribe("agent",      buildAgentHandler({...}))
10. subscribe("checkpoint", handler)
11. subscribe("lifecycle",  handler)
12. agentStreamRef.current = { close: () => offAgent() + offCheckpoint() + offLifecycle() }
```

### stopAgent() — Cancel Flow
```
1. finalizeStream()
2. agentStreamRef.current.close() → 3 subscriptions remove
3. fetch(`/api/run/${rid}/cancel`, { method: "POST" })
4. setIsAgentThinking(false)
5. setIsAgentTyping(false)
6. setActiveAction(null)
```

### handleAnswer() — Q&A Flow
```
1. POST /api/chat/answer { runId, questionId, answer }
2. setMessages → question card ko answered: answer mark karo
```

### lifecycle handler — Run Completion
```
Events: "completed" | "failed" | "cancelled"
1. finalizeStream() + flushGroup()
2. agentStreamRef.current.close()
3. currentRunIdRef.current = null
4. setIsAgentThinking(false) + setIsAgentTyping(false) + setActiveAction(null)
5. setMessages: completion message + checkpoint card (agar completed)
```

---

## FILE 3: `agent-event-handler.ts` — EVENT SWITCH BLOCK

### Kya karta hai?
Pure factory function — ek run ke liye ek handler banata hai jo sab SSE events handle karta hai. Hook nahi hai — plain function hai.

### Signature
```typescript
buildAgentHandler(deps: AgentHandlerDeps): (raw: unknown) => void
```

### Poore 20+ Event Types

| Event Type | Kya hota hai? |
|---|---|
| `agent.stream.start` | finalizeStream() → startStream() → isStreaming:true |
| `agent.token` | pushToken(token) → RAF buffer mein |
| `agent.stream.end` | finalizeStream() → cursor band |
| `agent.thinking` | isAgentThinking:true + ThinkingBubble |
| `agent.retry` | Retry status LiveActionBar mein |
| `agent.replanning` | Re-plan indicator ya limit reached message |
| `agent.context_compressed` | Context compression notice |
| `agent.continuation` | Continuation badge |
| `agent.tool_call` | inflight Map update + LiveActionBar |
| `agent.tool_call` (task_complete) | flushGroup() + isAgentTyping:true |
| `agent.message` | Final message push + cleanup |
| `agent.question` | QuestionCard message push |
| `agent.question.answered` | QuestionCard mark answered + thinking start |
| `recovery.started` | "Self-healing" indicator |
| `recovery.completed` | Recovery success message |
| `recovery.failed` | Recovery failure message |
| `plan.created` | Execution plan message (phases + risks) |
| `plan.progress` | Phase progress LiveActionBar |
| `phase.started` | inflight entry create |
| `phase.completed` | inflight entry update → done |
| `phase.failed` | inflight entry → error |
| `file.written` | inflight file entry (done) |
| `diff.queued` | inflight patch entry (done) |
| `file.diff` | FileDiffCard message push |

### inflight Map — Tool Accumulator
```typescript
const inflight = new Map<string, AgentStreamItem>()
// Key format: `${phase}::${tool}` ya `file::${path}`
// Jab flushGroup() call hota hai:
//   → inflight.values() → actions array
//   → setMessages: { role: "tool_group", actions }
//   → inflight.clear()
```

---

## FILE 4: `ChatMessages.tsx` — MESSAGE RENDER LAYER

### Kya karta hai?
`messages[]` array ko render karta hai. 6 different message types handle karta hai. Auto-scroll karta hai.

### 6 Message Types ka Render

```typescript
// 1. "checkpoint"
<CheckpointCard data={msg.checkpoint} checkpointNumber={cpNumber} isLatest={isLatest} />
// Safety snapshot card, restore button ke saath

// 2. "diff"
<FileDiffCard diff={diff} />
// Code diff viewer (before/after file changes)

// 3. "question"
<QuestionCard data={msg.question} onAnswer={onAnswer} />
// Multiple choice Q&A card

// 4. "tool_group"
<ToolGroupLine actions={msg.actions} onOpenFile={onOpenFile} />
// Collapsible completed tool actions list

// 5. "agent" (normal + streaming)
<AgentMarkdown content={msg.content} />
// Agar isStreaming: true → blinking cursor bhi
// CSS: @keyframes stream-cursor { 0%,100%{opacity:1} 50%{opacity:0} }

// 6. "user"
<div style={{ background: "rgba(124,141,255,0.18)" }}>
  {msg.content}
</div>
// Right-aligned purple bubble
```

### Bottom Indicators (priority order)
```
if (activeAction?.tool === "analysis.think" && !isAgentTyping)
  → <ThinkingBubble />   ← pulsing brain + "Thinking..." dots

if (activeAction && activeAction.tool !== "analysis.think" && !isAgentTyping)
  → <LiveActionBar action={activeAction} />  ← tool name + animation

if (isAgentTyping)
  → Typing animation (3 bouncing dots + "Responding")
```

### Auto-Scroll
```typescript
useEffect(() => {
  endRef.current?.scrollIntoView({ behavior: "smooth" })
}, [messages, isAgentThinking])
// Messages badhlne ya thinking state badhlne par scroll
```

### New Chat Screen
```
showNewChatScreen === true:
  → Bot icon + "New chat with Agent" heading
  → suggestedPrompts buttons grid (6 prompts)
  → Click → handleSelectPrompt → chatInput mein fill
```

---

## FILE 5: `ChatInput.tsx` — INPUT BAR

### Kya karta hai?
Text input, file upload popup, send button, stop button — sab input layer yahan hai.

### State
```typescript
const [showPopup, setShowPopup] = useState(false)  // + button popup
const isBusy = isAgentThinking || isAgentTyping
```

### Visual States
```
Normal:  border = rgba(255,255,255,0.09)
         placeholder = "Make, test, iterate..."
         
Busy:    border = rgba(124,141,255,0.4)   ← purple glow
         boxShadow = purple ambient glow
         placeholder = "Agent is working…" / "Agent is responding…"
         textarea disabled = true
```

### Send vs Stop Button
```
isBusy === false:
  → Send button (gradient purple, Send icon)
  → disabled agar chatInput.trim() === ""

isBusy === true:
  → Stop button (red, "Stop" text)
  → onClick → onStop() → cancel run
```

### File Upload
```
+ button → popup mein 2 options:
  1. "Upload File"  → accept=".pdf,.zip,.tar,.gz,.txt,.csv,.json,.md"
  2. "Upload Photo" → accept="image/*"
  
Handler:
  FormData { projectId, files[] }
  POST /api/chat/upload
```

### Keyboard
```
Enter         → onSend()   (agar !isBusy)
Shift + Enter → newline    (default textarea behavior)
```

---

## FILE 6: `ChatHeader.tsx` — HEADER + HISTORY PANEL

### Kya karta hai?
Chat pane ka header — title, realtime status dot, history toggle, new chat button.

### ChatHeader Component
```
Left side:
  [Sparkles icon gradient] "Agent" text + RealtimeStatusDot

Right side:
  [History icon button] → onToggleHistory()
  [MessageSquarePlus button] → onNewChat()
```

### RealtimeStatusDot
```
"connected"    → green pulsing dot
"reconnecting" → yellow dot  
"offline"      → gray dot
```

### ChatHistoryPanel Component
```
Full height panel replaces ChatMessages

Header: "CHAT HISTORY" (uppercase, muted)

List:
  Each chat entry:
    - title (line-clamp-2)
    - time (muted)
    - active chat → purple left border + highlighted bg
    
Empty state: "No previous chats yet."
```

---

## FILE 7: `LiveActionBar.tsx` — LIVE STATUS

### Kya karta hai?
Real-time agent status dikhata hai — agent kya kar raha hai abhi. 2 sub-components.

### ThinkingBubble
```
Brain icon (la-pulse animation) + "Thinking" text + 3 animated dots
la-glow-pulse: purple ambient glow on icon container
3 dots: la-think-dot-1/2/3 (staggered 200ms delay each)
```

### LiveActionBar
```
Har tool ke liye:
  - Icon from TOOL_ICON_MAP → la-{animation} CSS class
  - Color from TOOL_COLOR_MAP
  - Tool name badge (font-mono)
  - "Working" label + 3 dots
  - Emoji from TOOL_EMOJI_MAP
  - action.content text (small description)
```

### 9 CSS Animations (all defined inline as `<style>` tag)
| Animation | Effect | Used for |
|---|---|---|
| `la-spin` | 360deg rotate 0.85s | search_web, package_install, file_search |
| `la-pulse` | scale 1→1.35 1.1s | analysis.think, server_start, monitor_check |
| `la-bounce` | translateY 0→-4px 0.75s | file_write, file_read, git_add |
| `la-flash` | opacity 1→0.12 0.65s | shell_exec, preview_url, env_read |
| `la-shake` | rotate -14→14deg 0.45s | file_delete, debug_run |
| `la-ping` | scale 1→2 opacity fade 1.1s | db_push, api_call, test_run |
| `la-enter` | fade-in slide-up 0.2s | entry animation for both components |
| `la-glow-pulse` | purple glow pulse 1.8s | ThinkingBubble icon container |
| `la-think-dot` | scale 0.55→1 1.4s | ThinkingBubble dots |

---

## FILE 8: `QuestionCard.tsx` — Q&A CARD

### Kya karta hai?
Agent ne clarification puchi — user ko options dikhata hai.

### States
```
data.answered === undefined:
  → HelpCircle icon + question text
  → Options buttons (each → onAnswer(questionId, runId, option))
  
data.answered !== undefined:
  → CheckCheck icon (green)
  → "Answered: {answer}" (green text)
  → Buttons hide ho jate hain
```

### Answer Flow
```
Button click → onAnswer(questionId, runId, opt)
            → handleAnswer in useAgentRunner
            → POST /api/chat/answer
            → setMessages: QuestionCard ko answered mark karo
```

---

## FILE 9: `ToolGroupLine.tsx` — TOOL BATCH DISPLAY

### Kya karta hai?
Completed tool actions ka batch dikhata hai. Collapsible list.

### Collapsed State
```
Up to 5 tool icons (colored) + "N actions" text
Hover → ChevronDown visible
Click → expanded toggle
```

### Expanded State (Detail Panel)
```
Har tool action ke liye:
  [Icon container] [tool badge chip] [action content] [CheckCircle2]
                   ↑ Dropdown Menu trigger
  
  Dropdown Options:
    1. "View tool docs"      → onOpenFile("server/agents/TOOLS.md")
    2. "View agents inventory" → onOpenFile("server/agents/AGENTS.md")
    3. "Open source file"   → (agar meta.file hai) → onOpenFile(path)
    4. "Run via backend"    → invokeToolBackend(tool) → POST /api/inventory/tools/{name}/invoke
    5. "Copy tool name"     → navigator.clipboard.writeText(tool)
  
  Agar meta.logs hai → monospace code block (max 600 chars)
  Agar meta.file hai → file path button
    → Dropdown: "Open in editor" | "Copy path"
```

---

## FILE 10: `tool-helpers.ts` — PURE ASYNC HELPERS

### Kya karta hai?
API call helpers — sab plain async functions, koi hook nahi.

### 5 Functions

```typescript
// 1. File content fetch karo (Monaco editor ke liye)
fetchFileContent(filePath: string): Promise<{ content: string; lang: string }>
  → POST /api/inventory/actions/open-file
  → Error case: "// Could not load {path}\n// {error}"

// 2. Tool directly invoke karo backend se
invokeToolBackend(name: string, args = {}): Promise<any>
  → POST /api/inventory/tools/{name}/invoke

// 3. File extension se language guess karo
guessLangFromPath(p: string): string
  → ts/tsx → typescript, py → python, rs → rust, etc.

// 4. Chat history fetch karo
fetchChatHistory(projectId: number): Promise<HistoryEntry[]>
  → GET /api/chat/history?projectId={id}

// 5. Suggested prompts fetch karo
fetchChatPrompts(projectId: number): Promise<string[] | null>
  → GET /api/chat/prompts?projectId={id}
```

---

## FILE 11: `tool-maps.ts` — TOOL → UI MAPPING

### Kya karta hai?
Pure data file — 4 Maps jo har tool ke liye UI properties define karte hain.

### 4 Maps
```typescript
TOOL_ICON_MAP:      Record<tool, React.ElementType>  // lucide-react icons
TOOL_COLOR_MAP:     Record<tool, string>              // hex colors
TOOL_EMOJI_MAP:     Record<tool, string>              // emoji
TOOL_ANIMATION_MAP: Record<tool, AnimationStyle>      // CSS animation name
```

### Color Coding Pattern
```
🔵 Blue family    → file operations (read/list)
🟢 Green family   → write, git, deploy, success ops
🔴 Red            → delete, stop, debug
🟡 Yellow         → env, auth, warnings
🟠 Orange         → packages, server restart
🟣 Purple         → thinking, agent, monitoring
⚡ Cyan           → file_search, api_call, server
```

---

## FILE 12: `types.ts` — TYPE DEFINITIONS

### Kya karta hai?
Chat system ke saare types — discriminated union for messages.

### ChatMessage Union
```typescript
type ChatMessage =
  | { role: "user";       content: string;            time: string }
  | { role: "agent";      content: string;            time: string; isStreaming?: boolean }
  | { role: "tool_group"; actions: AgentStreamItem[]; time: string }
  | { role: "diff";       diffs: FileDiff[];           time: string }
  | { role: "checkpoint"; checkpoint: CheckpointData; time: string }
  | { role: "question";   question: QuestionData;     time: string }
```

### QuestionData
```typescript
interface QuestionData {
  text: string;       // Question text
  options: string[];  // Multiple choice options
  questionId: string; // Unique question ID
  runId: string;      // Which run se aaya
  answered?: string;  // User ka answer (after answering)
}
```

---

---

# REPLIT vs NURA-X — FEATURE COMPARISON

## Features Jo NURA-X Mein HAIN ✅

| Feature | NURA-X Implementation |
|---|---|
| Chat panel with streaming | ChatMessages + TokenBuffer + RAF batching |
| Multi-agent orchestration | Planner + Executor + Browser + Supervisor |
| Real-time SSE events | Single /api/realtime endpoint, topic-multiplexed |
| Tool visualization | LiveActionBar + per-tool animations |
| File diff viewer | FileDiffCard component |
| Checkpoint/snapshot | CheckpointCard + automatic after run |
| Q&A / clarification | QuestionCard + /api/chat/answer |
| File upload in chat | POST /api/chat/upload |
| Chat history | /api/chat/history API |
| Suggested prompts | /api/chat/prompts API |
| Run cancel | POST /api/run/:id/cancel |
| Page refresh recovery | C6 system (Last-Event-ID replay) |
| Token streaming | RAF-buffered TokenBuffer |
| WebSocket terminal | /ws/terminal |
| Sandbox environment | .sandbox/ directory isolation |
| 170 registered tools | Registry sealed on boot |
| Recovery/self-healing | recovery.started/completed/failed events |

---

## Features Jo NURA-X Mein NAHI HAIN ❌ (Replit Mein Hain)

| Feature | Replit Mein | NURA-X Mein |
|---|---|---|
| **User Auth** | OAuth + email login | ❌ Nahi hai |
| **Multi-user / Teams** | Shared workspaces, roles | ❌ Nahi hai |
| **Real-time Collaboration** | Multiple cursors, live presence | ❌ Nahi hai |
| **LSP / IntelliSense** | Full language server | ❌ Nahi hai |
| **Git UI** | Branch, PR, clone from GitHub | ⚠️ Partial (tools only) |
| **GitHub Import** | Import any repo | ❌ Nahi hai |
| **Deployment Pipeline** | One-click deploy + custom domain | ❌ Nahi hai |
| **Custom Domains** | HTTPS + DNS management | ❌ Nahi hai |
| **Secret Manager UI** | Visual env var management | ❌ Nahi hai |
| **Package Manager UI** | Visual npm/pip/cargo | ❌ Nahi hai |
| **Multiplayer editing** | Real-time code co-editing | ❌ Nahi hai |
| **Persistent message history** | DB-backed, survives refresh | ⚠️ Partial (DB schema hain) |
| **AI model selection** | Switch between models | ❌ Nahi hai |
| **Resource monitoring** | CPU/RAM/disk dashboard | ⚠️ Partial (metrics hain) |
| **Mobile support** | Responsive mobile editor | ❌ Nahi hai |
| **Project templates** | Starter templates library | ❌ Nahi hai |
| **Nix package manager** | System-level packages | ❌ Nahi hai |
| **Billing/Usage** | Usage tracking, limits | ❌ Nahi hai |
| **Code search** | Global search in project | ⚠️ Partial (file_search tool) |
| **Linting/Formatting** | ESLint, Prettier UI | ❌ Nahi hai |
| **Test runner UI** | Visual test results | ❌ Nahi hai |
| **Export/Download** | Download project as zip | ❌ Nahi hai |
| **Multiplayer chat** | Multiple users in same run | ❌ Nahi hai |

---

## Priority Order (Kya Banana Chahiye Pehle)

```
TIER 1 — Critical (bina inke production nahi ho sakta):
  1. Auth System (user accounts, sessions, JWT)
  2. Message History Persistence (DB-backed chat messages)
  3. Deployment Pipeline (build + deploy + domain)

TIER 2 — Important (power users ke liye):
  4. Secret Manager UI (visual env vars)
  5. Git UI (branch, commit, push from UI)
  6. GitHub Import (repo clone + setup)
  7. Resource Monitoring Dashboard (CPU/RAM)

TIER 3 — Enhanced Experience:
  8. Package Manager UI
  9. Test Runner UI
  10. LSP / IntelliSense
  11. Project Templates
  12. Export/Download (zip)

TIER 4 — Enterprise/Scale:
  13. Multi-user / Teams
  14. Real-time Collaboration
  15. Billing / Usage Tracking
  16. Custom Domains / SSL
```

---

*Report Date: May 2026*
*Files Scanned: 12 files in client/src/components/chat/*
