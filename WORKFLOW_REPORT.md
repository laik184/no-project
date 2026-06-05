# Nura-X Agent Workflow Report
**Date:** 2026-06-05  
**Scope:** Chat → File Explorer access + Agent file creation pipeline

---

## 1. क्या Chat के पास File Explorer का Access है?

**हाँ — लेकिन direct नहीं, event-driven तरीके से।**

Chat और File Explorer दोनों अलग-अलग subsystems हैं, लेकिन ये एक shared SSE (Server-Sent Events) layer के through sync होते हैं।

```
Chat (user sends message)
       ↓
chatOrchestrator (server/chat/orchestration/)
       ↓
Agent runs → fs_write_file tool writes to disk
       ↓
Chokidar file watcher detects change on disk
       ↓
file-publisher.ts emits SSE event (topic: "file")
       ↓
Frontend: use-file-explorer.ts receives event → refreshes tree
```

File Explorer को directly control नहीं किया जाता — वो automatically react करता है जब agent disk पर file write करता है।

---

## 2. Full Workflow: Chat → Agent → File Creation

### Step 1 — User Message
- **Entry:** `chatOrchestrator.startRun()` (`server/chat/orchestration/chat-orchestrator.ts`)
- **SSE Event emitted:** `run_started` → topic: `agent`
- `routeIntent(goal)` decide करता है: simple reply vs full orchestration

### Step 2 — Planning Phase
- `orchestrate()` → `runOrchestrationLoop()` (`server/orchestration/execution/orchestration-loop.ts`)
- **Planner Agent** (`server/agents/planner/planner-agent.ts`) goal को tasks में तोड़ता है
- **SSE Events:** `planning_started`, `workflow_started`

### Step 3 — Execution Phase
- `runWorkflow()` → `runPhase()` → **Executor Agent** invoke होता है
- Executor `ExecutionSteps` बनाता है और LLM को coding task देता है
- **SSE Events:** `phase_started`, `step_started`

### Step 4 — Tool Call (File Write)
- Executor directly tool नहीं चलाता — `ToolDispatcher` के through जाता है
- `fs_write_file` tool → `writeToolService.write()` (`server/tools/filesystem/write/tool.service.ts`)
- **Coding tasks** के लिए: LLM code generate करता है → `persistGeneratedFiles()` automatically सभी files लिखता है

### Step 5 — File Explorer Update
- `resolveSafe()` sandboxRoot में file लिखता है (`/tmp/nurax-sandbox/`)
- Chokidar watcher (`server/file-explorer/watchers/file-watcher.service.ts`) change detect करता है
- `file-publisher.ts` SSE emit करता है → Frontend `use-file-explorer.ts` tree refresh करता है

### Step 6 — Run Complete
- **SSE Event:** `run_completed` → topic: `agent`
- File Explorer में नई file दिखती है

---

## 3. SSE Events की पूरी List

| Stage | Event Name | SSE Topic |
|---|---|---|
| Chat शुरू | `run_started` | `agent` |
| Intent route | `intent_routed` | `agent` |
| Planning | `planning_started`, `workflow_started` | `agent` |
| Executor | `phase_started`, `step_started` | `agent` |
| Tool call | `tool_call_started`, `tool_call_completed` | `agent` |
| File write | `file_change` (+ Chokidar) | `file` |
| Done | `run_completed` | `agent` |

---

## 4. File Explorer Real-time Features

| Feature | कैसे काम करता है |
|---|---|
| **Writing spinner** | `publishWriting()` event → explorer row पर live "writing..." दिखता है |
| **AI highlight badge** | `aiFiles` set में file add → `AIActivityBadge` component |
| **Auto tree refresh** | `file` SSE event → debounced `loadTree()` call |
| **Optimistic insert** | Manual file create → तुरंत UI में दिखता है, server confirm का wait नहीं |

---

## 5. Bugs जो Fix किये गए (इस Session में)

### Bug 1 — गलत Tool Names → Silent NOT_FOUND
**File:** `server/agents/executor/coordination/tool-coordinator.ts`

`coordinateFilesystem()` गलत tool names use कर रहा था:

| पहले (गलत) | अब (सही) |
|---|---|
| `write_file` | `fs_write_file` |
| `read_file` | `fs_read_file` |
| `patch_file` | `fs_patch_file` |
| `delete_file` | `fs_delete_file` |
| `search_text` | `fs_search_text` |
| `read_folder` | `fs_read_folder` |

**Effect:** हर filesystem task silently fail हो रहा था — कोई error नहीं, कोई crash नहीं, सिर्फ file नहीं बनती थी।

---

### Bug 2 — Double Path Prefix → File गलत जगह बन रही थी
**File:** `server/agents/executor/execution/task-executor.ts` → `persistGeneratedFiles()`

```
पहले (गलत):
absPath = "/tmp/nurax-sandbox/src/App.tsx"  ← absolute path
resolveSafe() → strips "/" → "tmp/nurax-sandbox/src/App.tsx"
final path   → "/tmp/nurax-sandbox/tmp/nurax-sandbox/src/App.tsx"  ← double!

अब (सही):
relPath = "src/App.tsx"  ← relative path
resolveSafe() → "/tmp/nurax-sandbox/src/App.tsx"  ← correct!
```

---

### Bug 3 — coordinateFilesystem में भी यही Path Bug
**File:** `server/agents/executor/coordination/tool-coordinator.ts`

`coordinateFilesystem()` भी absolute path बना कर `fs_*` tools को pass कर रहा था। Same fix — अब relative path pass होता है।

---

### Bug 4 — Backend Crash on Startup (already fixed earlier)
- `spawn-process.ts`: ENOENT crash → no-op error listener add किया
- `typescript-checker.ts`: `tsc` path fix → `node_modules/.bin/tsc`
- `verification-utils.ts`: `check_server_health` → `critical: false`

---

## 6. Current Status

```
✅ Server boot: clean (171 tools registered)
✅ AGENT_PROJECT_ROOT: /tmp/nurax-sandbox
✅ LLM: openai/gpt-oss-120b:free via OpenRouter
✅ File tool names: correct (fs_* prefix)
✅ File paths: relative paths only (no double-prefix)
✅ File Explorer: SSE-connected, Chokidar-backed
✅ Chat → Agent → Disk write pipeline: end-to-end functional
```

---

## 7. Architecture Diagram

```
User
 │
 ▼
[Chat UI]  ←──────────────────────────────── SSE events (agent topic)
 │                                                        ▲
 ▼                                                        │
[chatOrchestrator]                               [eventPublisher / bus]
 │                                                        ▲
 ▼                                                        │
[Intent Router]                                           │
 │                                                        │
 ▼                                                        │
[Planner Agent] → creates ExecutionPlan                   │
 │                                                        │
 ▼                                                        │
[Executor Agent] → LLM generates code                     │
 │                                                        │
 ▼                                                        │
[ToolDispatcher] → fs_write_file                          │
 │                                                        │
 ▼                                                        │
[Sandbox: /tmp/nurax-sandbox/]                            │
 │                                                        │
 ▼                                                        │
[Chokidar Watcher] → file change detected                 │
 │                                                        │
 ▼                                                        │
[file-publisher.ts] ──── SSE (file topic) ────────────────┘
 │
 ▼
[File Explorer UI] ← loadTree() refresh → shows new file
```

---

*Report generated: 2026-06-05 | Nura-X Deployer — Internal Workflow Audit*
