# Data Persistence Document
### NURAX — Memory / Projects / Logs Kaise Store Hote Hain

---

## 1. PERSISTENCE LAYERS OVERVIEW

NURAX mein 4 alag persistence layers hain:

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 1: PostgreSQL (Drizzle ORM)                      │
│  → Projects, Runs, Messages, Tool logs, Checkpoints     │
├─────────────────────────────────────────────────────────┤
│  LAYER 2: Filesystem Sandbox                            │
│  → Agent-generated source code files                    │
├─────────────────────────────────────────────────────────┤
│  LAYER 3: Memory Platform (Vector Store)                │
│  → Agent decisions, bugs, learnings, reflections        │
├─────────────────────────────────────────────────────────┤
│  LAYER 4: In-Memory (Process RAM) ⚠️ Non-Durable        │
│  → Folders, Active sessions, Active runs, SSE clients   │
└─────────────────────────────────────────────────────────┘
```

---

## 2. PROJECTS — Kaise Store Hote Hain

### Primary Store: PostgreSQL `projects` table

```
User: POST /api/projects { name: "Todo App" }
        ↓
main.ts handler:
    slug = "todo-app"
    sandboxPath = AGENT_PROJECT_ROOT + "/" + slug + "-" + Date.now()
              = "/home/runner/.sandbox/todo-app-1718186400000"
        ↓
db.insert(projects).values({
    name: "Todo App",
    sandboxPath: "/home/runner/.sandbox/todo-app-1718186400000",
    status: "idle"
}).returning()
        ↓
PostgreSQL: projects table mein row insert
```

### Filesystem: Sandbox Directory

```
AGENT_PROJECT_ROOT/
└── todo-app-1718186400000/     ← Project ka isolated folder
    ├── src/
    │   ├── App.tsx             ← Agent-generated files
    │   └── main.tsx
    ├── package.json
    └── index.html
```

### Project Lifecycle States
```
idle       ← Naya project, koi run nahi
running    ← Active agent run chal rahi hai
completed  ← Run successfully complete
failed     ← Run failed
```

### Degraded Mode (No DATABASE_URL)
```typescript
// degraded-project-store.ts — In-memory fallback
class DegradedProjectStore {
  private projects: Map<number, DegradedProjectRecord>;

  create(data) { ... }   // RAM mein store
  list()       { ... }   // RAM se return
  get(id)      { ... }   // RAM se fetch
  update(id)   { ... }   // RAM mein update
}
// ⚠️ Server restart pe sab kuch gone
```

---

## 3. AGENT RUNS — Kaise Store Hote Hain

### Primary Store: PostgreSQL `agent_runs` table

```
chatOrchestrator.startRun({ projectId, goal })
        ↓
Step 1: In-memory mein register karo (immediate)
    runManager.register(runId, { projectId, goal, status: 'running' })

Step 2: DB mein persist karo (best-effort, async)
    runWriter.create({
        id: runId,              // UUID
        projectId,
        goal,
        status: 'running',
        startedAt: new Date()
    })
    // ⚠️ Best-effort: DB fail hone pe run continue karta hai
        ↓
Run during execution:
    DB: No real-time updates (status stays 'running')
    In-memory: runManager tracks active state
        ↓
Run complete/_failRun():
    db.update(agent_runs).set({
        status: 'completed' | 'failed' | 'cancelled',
        endedAt: new Date(),
        result: { success, summary, ... }
    })
```

### Run Status Flow
```
runManager (in-memory)    →   agent_runs (PostgreSQL)
    register('running')   →       insert(status: 'running')
    update('completed')   →       update(status: 'completed', endedAt)
    update('failed')      →       update(status: 'failed', endedAt)
```

### Active Run Recovery (Tab Reload)
```
GET /api/run/active?projectId=N
        ↓
DB query: latest 5 runs for project
    → filter: status === 'running'
    → return first match
        ↓
Frontend SSE reattach with lastEventId
```

---

## 4. CHAT MESSAGES — Kaise Store Hote Hain

### Primary Store: PostgreSQL `chat_messages` table

```
Message Store Flow:
        ↓
User message:
    messageService.store({
        projectId,
        runId,
        role: 'user',
        content: "Build me a todo app"
    })

Agent response (streaming):
    streamManager → tokens SSE pe stream karta hai
        ↓ (run complete hone pe)
    messageService.store({
        role: 'assistant',
        content: completeResponse,
        tokensUsed: 1234
    })

Tool calls:
    messageService.store({
        role: 'tool',
        content: toolOutput,
        toolCalls: [{ name: 'write_file', args: {...}, result: {...} }]
    })
```

### Chat History Load
```
GET /api/chat/messages?projectId=N&runId=X
        ↓
db.select()
  .from(chatMessages)
  .where(eq(chatMessages.projectId, N))
  .orderBy(asc(chatMessages.createdAt))
```

### Message Roles
| Role | Kaun | Content |
|---|---|---|
| `user` | Human input | Plain text goal/question |
| `assistant` | AI response | Streamed response text |
| `tool` | Tool output | Tool execution result |
| `system` | System messages | Context, instructions |

---

## 5. TOOL EXECUTIONS — Kaise Store Hote Hain

### Primary Store: PostgreSQL `tool_executions` table

```
Tool dispatch flow:
        ↓
dispatch('write_file', { filePath: 'src/App.tsx', content: '...' }, ctx)
        ↓
Dispatcher:
    executionId = uuid()
    startedAt = Date.now()

    // Pre-execution store
    db.insert(tool_executions).values({
        executionId,
        runId: ctx.runId,
        projectId: ctx.projectId,
        toolName: 'write_file',
        toolCategory: 'filesystem',
        status: 'running',
        argsJson: { filePath, content },
        startedAt
    })
        ↓
    execute tool handler...
        ↓
    // Post-execution update
    db.update(tool_executions).set({
        status: 'success' | 'failed',
        resultJson: result,
        errorText: error?.message,
        durationMs: Date.now() - startedAt,
        endedAt: new Date()
    })
```

### Tool Execution Query (Audit)
```sql
-- Ek run ke sare tools
SELECT tool_name, status, duration_ms, started_at
FROM tool_executions
WHERE run_id = 'run-uuid-here'
ORDER BY started_at ASC;

-- Slow tools find karo
SELECT tool_name, AVG(duration_ms) as avg_ms
FROM tool_executions
WHERE status = 'success'
GROUP BY tool_name
ORDER BY avg_ms DESC;

-- Failed tools
SELECT tool_name, error_text, args_json
FROM tool_executions
WHERE status = 'failed'
  AND project_id = 1
ORDER BY started_at DESC
LIMIT 20;
```

---

## 6. CONSOLE LOGS — Kaise Store Hote Hain

### Primary Store: PostgreSQL `console_logs` table

```
Runtime process stdout/stderr:
        ↓
terminalStreamBroker receives output line
        ↓
logRepository.store({
    projectId,
    stream: 'stdout' | 'stderr',
    line: 'Server listening on port 3000',
    ts: new Date()
})
        ↓
Simultaneously: SSE event broadcast to frontend
    bus.emit('terminal', { line, stream, ts })
```

### Log Retrieval
```
GET /api/terminal/sessions/:id/logs
        ↓
logRepository.getForProject(projectId, { limit: 500 })
        ↓
db.select()
  .from(consoleLogs)
  .where(eq(consoleLogs.projectId, projectId))
  .orderBy(desc(consoleLogs.ts))
  .limit(500)
```

---

## 7. MEMORY PLATFORM — Kaise Store Hota Hai

### Memory Storage Stack

```
Agent calls: memoryEngine.store({
    content: "User prefers React over Vue",
    category: "decisions",
    tags: ["frontend", "framework"],
    meta: { runId, projectId }
})
        ↓
Step 1: Chunking
    LargeContent → chunks[] (agar content > threshold)

Step 2: Embedding
    chunks[] → vectors[] (numerical representation)

Step 3: Repository Store
    memoryRepository.save({
        id: uuid(),
        content,
        category,    // decisions | bugs | learning | reflection
        tags,
        meta,
        vector,
        createdAt
    })

Step 4: Persistence
    → Vector store (file-based ya in-memory)
    → Optional: DB backup
```

### Memory Categories

| Category | Kab Store Hoti Hai | Kya Store Hota Hai |
|---|---|---|
| `decisions` | Run complete hone pe | Architecture choices, tech selections |
| `bugs` | Verifier error detect kare | Error pattern + fix |
| `learning` | Agent kuch naya discover kare | Patterns, best practices |
| `reflection` | Supervisor phase end pe | Self-assessment, improvement notes |

### Memory Recall Flow
```
Agent run start:
memoryEngine.recall({
    query: "React todo app authentication",
    categories: ["decisions", "bugs"],
    limit: 10
})
        ↓
Vector similarity search
        ↓
Reranking (relevance score)
        ↓
Top-N entries return
        ↓
buildMemoryContextString(entries)
    = "Past decisions:\n- Use React hooks...\nKnown bugs:\n- ..."
        ↓
Inject into LLM prompt context
```

---

## 8. CHECKPOINTS — Kaise Store Hote Hain

### Primary Store: PostgreSQL `checkpoints` + Filesystem

```
Run complete hone pe:
checkpointService.create({
    projectId,
    runId,
    trigger: 'auto'
})
        ↓
Step 1: Workspace scan
    scanWorkspace(sandboxPath)
    → sare files list karo

Step 2: Content capture
    fileSnapshots = {}
    for each file:
        fileSnapshots[relativePath] = readFileSync(file, 'utf8')

Step 3: Git SHA capture (agar available)
    gitSha = captureGitSha(sandboxPath)

Step 4: DB store
    db.insert(checkpoints).values({
        checkpointId: uuid(),
        projectId,
        runId,
        trigger: 'auto',
        status: 'stable',
        gitCommitSha: gitSha,
        fileCount: files.length,
        createdFiles: [...],
        modifiedFiles: [...],
        deletedFiles: [...],
        fileSnapshots: { ... }  // JSONB column
    })

Step 5: SSE event
    bus.emit('checkpoint', { checkpointId, projectId, fileCount })
```

### Checkpoint Size Warning
`fileSnapshots` JSONB column mein poore file contents store hote hain. Bade projects mein yeh column bahut bada ho sakta hai.

### Rollback Flow
```
POST /api/checkpoints/:checkpointId/rollback
        ↓
checkpoint = db.select().from(checkpoints).where(eq(...))
        ↓
fileSnapshots.forEach((content, path) => {
    safeWriteFile(join(sandboxPath, path), content)
})
        ↓
db.insert(rollback_history).values({
    checkpointId,
    projectId,
    status: 'completed',
    restoredFiles: Object.keys(fileSnapshots)
})
        ↓
bus.emit('file-change', { type: 'rollback', projectId })
```

---

## 9. IN-MEMORY STATE — Non-Durable

Yeh data **process restart pe reset ho jaata hai**:

| State | Module | Kya Rakhta Hai | Risk |
|---|---|---|---|
| **Folders** | `main.ts` array | Folder names + membership | Reset on restart |
| **Active Runs** | `runManager` | Running run entries | Run status lost |
| **Conversations** | `conversationManager` | Message history in-memory | Context lost |
| **Terminal Sessions** | `sessionManager` | Active SSH-like sessions | Sessions drop |
| **Runtime Processes** | `runtimeManager` | Spawned child processes | Orphan processes |
| **SSE Clients** | `sseManager` | Connected browser clients | Auto-disconnect |
| **Orchestration State** | `orchestrationState` | Active run state | Run recovery limited |
| **Preview Cache** | `previewSessionStore` | Preview iframe state | Cache cleared |

---

## 10. FILESYSTEM SANDBOX — Structure

```
AGENT_PROJECT_ROOT/                  (default: .sandbox/)
├── default-project/                 ← Seeded on boot
│   └── (empty or initial files)
│
├── my-todo-app-1718186400000/       ← User project 1
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   └── ...
│   ├── public/
│   ├── package.json
│   └── index.html
│
└── my-blog-1718190000000/           ← User project 2
    └── ...
```

### Safe Filesystem Operations
`server/infrastructure/checkpoints/safe-fs.util.ts` provide karta hai:
```typescript
safeWriteFile(path, content)   // Atomic write (temp file → rename)
safeDeleteFile(path)           // Backup before delete
safeBackup(path)               // Explicit backup
```

---

## 11. REDIS / QUEUE — Optional Persistence

### Current Status
`REDIS_URL` set nahi hai → **Null implementations active**:

```typescript
// NullRedisClient — sab operations no-op
redis.get(key)   → null
redis.set(...)   → void
redis.del(...)   → void

// NullQueue — jobs drop ho jaate hain
queue.add('job', data) → warning log, no actual queue
```

### Agar Redis Configure Karo
```
REDIS_URL=redis://localhost:6379
        ↓
redis: IoRedis client active
queue: BullMQ Queue active
        ↓
Capabilities enabled:
- Distributed caching
- Background job processing
- Reliable task queues
- Agent run persistence across restarts
```

---

## 12. DATA RETENTION SUMMARY

| Data Type | Store | Durability | Reset On |
|---|---|---|---|
| Projects | PostgreSQL | ✅ Persistent | Never (explicit delete only) |
| Agent Runs | PostgreSQL | ✅ Persistent | Never |
| Chat Messages | PostgreSQL | ✅ Persistent | Never |
| Tool Executions | PostgreSQL | ✅ Persistent | Never |
| Checkpoints | PostgreSQL + JSONB | ✅ Persistent | Explicit delete |
| Console Logs | PostgreSQL | ✅ Persistent | Never |
| Source Code Files | Filesystem Sandbox | ✅ Persistent | Rollback / explicit delete |
| Memory Entries | Vector Store | ✅ Persistent | Manual clear |
| Folders | In-memory | ❌ Non-durable | Process restart |
| Active Sessions | In-memory | ❌ Non-durable | Process restart |
| Active Runs | In-memory + DB | ⚠️ Partial | Restart (DB recoverable) |
| SSE Connections | In-memory | ❌ Non-durable | Disconnect |
