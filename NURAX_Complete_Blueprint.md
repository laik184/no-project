# 🔵 NURAX — COMPLETE FULL STACK AGENTIC VIBE CODER BLUEPRINT
### Version 2.0 | Service + Repository Layer Included | Enterprise-Grade

> **"Idea dalo. Baaki AI karta hai."**
> Ab properly layered — Agent → Service → Repository → Database

---

## ⚡ PART 1: SYSTEM TRUTH (Jo competitors se seekha)

| Platform | Kya sikha | Kya galat hai |
|---|---|---|
| Cursor | MTP layers → low latency | Credit-based pricing → user hostility |
| Devin | Sandboxed VM verification | Infinite error loops |
| Windsurf | Plan + Action dual timeline | Rigid user adherence needed |
| Aider | Tree-sitter AST + PageRank memory | No GUI for non-devs |
| Bolt.new | Browser-native full-stack | No async execution |
| Jules | Async cloud VM parallelism | No real-time feedback |
| Manus | Masked token logit routing | DOM fragility |

**NURAX ka advantage:** Sabka best uthao, sabki galti avoid karo.

---

## 🏗️ PART 2: AGENT HIERARCHY — L1/L2/L3

```
USER INPUT
    │
    ▼
┌─────────────────────────────────────────┐
│   L1: SUPERVISOR AGENT                  │
│   → Plan timeline maintain karo         │
│   → Delegates to L2/L3 agents           │
│   → Context window manage karo          │
└───────────┬─────────────────────────────┘
            │
     ┌──────┴──────────────────────┐
     ▼                             ▼
┌──────────────┐           ┌──────────────────┐
│ L2: ARCHITECT│           │ L2: CODER AGENT  │
│ Natural lang │           │ GRPO + MTP layers│
│ → Exec graph │           │ Rapid code gen   │
│ → DB schemas │           │ Tool-loop: Think │
└──────┬───────┘           │ → Tool → Observe │
       │                   └──────┬───────────┘
       │                          │
  ┌────┴──────┐            ┌──────┴────────────┐
  │L2:NAVIGATOR│           │ L2: VERIFIER       │
  │Tree-sitter │           │ Firecracker VM     │
  │AST + PageRank│         │ Stack trace catch  │
  │Repo Map    │           │ Recursive patches  │
  └────────────┘           └───────────────────┘
       │
  ┌────┴───────────────────────────────────┐
  │              L3 AGENTS                 │
  │  ┌────────────┐  ┌──────────────────┐  │
  │  │TOOL DISPATCH│  │BROWSER AGENT(CUA)│  │
  │  │MCP + Masked │  │Live DOM testing  │  │
  │  │Token Logits │  │Screenshot verify │  │
  │  └────────────┘  └──────────────────┘  │
  │  ┌─────────────────────────────────┐   │
  │  │ SYNTHESIZER AGENT               │   │
  │  │ Milvus RAG + Doc generation     │   │
  │  │ Audio changelog + Slide gen     │   │
  │  └─────────────────────────────────┘   │
  └────────────────────────────────────────┘
```

**IRON RULE — Kabhi break mat karo:**
```
Agent → Service (ALLOWED ✅)
Service → Repository (ALLOWED ✅)
Repository → Database (ALLOWED ✅)

Agent → Repository (FORBIDDEN ❌)
Agent → Database (FORBIDDEN ❌)
Tool → Repository (FORBIDDEN ❌)
Tool → Database (FORBIDDEN ❌)
```

---

## 🔄 PART 3: OFFICIAL DEPENDENCY FLOW

```
Frontend (React)
    ↓
Orchestrator (Plan Timeline)
    ↓
L1: Supervisor Agent
    ↓
L2: Planner / Architect Agent
    ↓
L2: Coder / Verifier / Navigator Agent
    ↓
─────────────── SERVICE LAYER ───────────────
    ↓
ProjectService / ExecutionService / MemoryService
FilesystemService / VerificationService / ToolService
AgentService / WorkspaceService / DeploymentService
ResearchService / DocumentationService / PresentationService
    ↓
─────────────── REPOSITORY LAYER ────────────
    ↓
ProjectRepository / RunRepository / TaskRepository
MemoryRepository / VectorRepository / ToolRepository
AgentRepository / EventRepository / CheckpointRepository
    ↓
─────────────── DATABASE / FILESYSTEM ───────
    ↓
PostgreSQL (Drizzle ORM) + Milvus (Vector) + .sandbox/ (Files)
```

---

## 🧠 PART 4: MEMORY ARCHITECTURE — 4 Layers

### Layer 1: Project Memory (AST-Based)
```
Tree-sitter → Repository parse
    ↓
AST banao (classes, functions, deps)
    ↓
PageRank algorithm apply karo:
  - User prompt mein mentioned file: 10x boost
  - Currently open file: 50x boost
  - Recently modified: 5x boost
    ↓
"Repo Map" → Context mein sirf relevant nodes
Result: 10MB codebase → 2KB intelligent summary
```

### Layer 2: Execution Memory (Self-Summarizing)
```
Har 10 tool calls ke baad:
  → Agent apna progress summarize kare
  → "Todo list" context window ke END mein inject karo
  → (End = highest attention weight)
Purpose: Context collapse rokna 32K+ tokens pe
```

### Layer 3: Workspace Memory (Live)
```
chokidar → file system watch
  → File change → AST update
  → Relevant nodes recalculate
  → Coder agent ko fresh repo map do
```

### Layer 4: Long-Term Memory (Vector DB)
```
Milvus vector database:
  → Har run ka pattern save karo
  → Error → fix mapping store karo
  → Similar future request → past solution retrieve
```

---

## 🛠️ PART 5: SERVICE LAYER — Complete Definitions

> **Rule: Business logic SIRF service mein. Agent directly repository call nahi karega.**

---

### 5.1 ProjectService
**File:** `server/services/project.service.ts`

**Responsibilities:**
- Create Project (UUID assign, rootPath set, DB persist)
- Delete Project (cascade files + runs + memory cleanup)
- Load Project (metadata + last run state)
- Update Project Settings
- List Projects (user ke saare projects)

```typescript
interface IProjectService {
  createProject(input: CreateProjectInput): Promise<Project>;
  deleteProject(projectId: string): Promise<void>;
  loadProject(projectId: string): Promise<ProjectWithState>;
  updateSettings(projectId: string, settings: ProjectSettings): Promise<Project>;
  listProjects(): Promise<Project[]>;
}
```

**Depends on:** `ProjectRepository`, `WorkspaceService`, `FilesystemService`

---

### 5.2 WorkspaceService
**File:** `server/services/workspace.service.ts`

**Responsibilities:**
- Open Workspace (.sandbox/{id}/ initialize karo)
- Close Workspace (state save + cleanup)
- Workspace State manage (idle/active/locked)
- File Cache maintain (hot files in memory)
- Workspace lock (concurrent access prevent)

```typescript
interface IWorkspaceService {
  openWorkspace(projectId: string): Promise<WorkspaceHandle>;
  closeWorkspace(projectId: string): Promise<void>;
  getState(projectId: string): WorkspaceState;
  lockWorkspace(projectId: string): Promise<ReleaseFn>;
  getCachedFile(projectId: string, path: string): string | null;
}
```

**Depends on:** `ProjectRepository`, `FilesystemService`

---

### 5.3 FilesystemService
**File:** `server/services/filesystem.service.ts`

**Responsibilities:**
- Create File (path validation + write)
- Read File (cache-first)
- Write File (atomic write + cache invalidate)
- Patch File (diff apply — agent ka primary tool)
- Move / Rename File
- Delete File (soft delete + audit log)
- Watch File changes (chokidar integration)

```typescript
interface IFilesystemService {
  createFile(projectId: string, path: string, content: string): Promise<FileNode>;
  readFile(projectId: string, path: string): Promise<string>;
  writeFile(projectId: string, path: string, content: string): Promise<void>;
  patchFile(projectId: string, path: string, diff: FileDiff): Promise<PatchResult>;
  moveFile(projectId: string, from: string, to: string): Promise<void>;
  deleteFile(projectId: string, path: string): Promise<void>;
  listDirectory(projectId: string, dir: string): Promise<FileTree>;
  watchChanges(projectId: string, cb: FileChangeCb): Unsubscribe;
}
```

**Depends on:** `WorkspaceService` — no repository (filesystem IS the store)

---

### 5.4 MemoryService
**File:** `server/services/memory.service.ts`

**Responsibilities:**
- Conversation Memory: Chat history store + retrieve
- Execution Memory: Self-summarizing todo list inject
- Workspace Memory: Active AST nodes + open files
- Long-Term Memory: Vector DB upsert/query (Milvus)
- Memory Pruning: Token limit ke hisaab se trim

```typescript
interface IMemoryService {
  // Conversation
  appendMessage(runId: string, msg: ChatMessage): Promise<void>;
  getHistory(runId: string, limit?: number): Promise<ChatMessage[]>;

  // Execution (self-summarizing)
  updateTodoList(runId: string, summary: string): Promise<void>;
  getTodoList(runId: string): Promise<string>;
  injectAtContextTail(runId: string): Promise<InjectionPayload>;

  // Workspace (AST-based)
  getRepoMap(projectId: string, prompt: string): Promise<RepoMap>;
  invalidateAstCache(projectId: string, changedPath: string): Promise<void>;

  // Long-Term (Vector)
  storePattern(pattern: ExecutionPattern): Promise<void>;
  queryPatterns(query: string, topK: number): Promise<ExecutionPattern[]>;

  // Pruning
  pruneContext(runId: string, maxTokens: number): Promise<PruneResult>;
}
```

**Depends on:** `MemoryRepository`, `VectorRepository`

---

### 5.5 AgentService
**File:** `server/services/agent.service.ts`

**Responsibilities:**
- Agent Registration (system start pe register)
- Agent Discovery (name se agent instance lo)
- Agent Health Check (alive? busy? error state?)
- Agent Lifecycle (start / pause / kill)
- Agent Metrics (tokens used, tool calls, latency)

```typescript
interface IAgentService {
  registerAgent(agent: AgentDefinition): void;
  getAgent<T extends BaseAgent>(name: AgentName): T;
  getHealthStatus(): Record<AgentName, AgentHealth>;
  pauseAgent(name: AgentName, runId: string): Promise<void>;
  killAgent(name: AgentName, runId: string): Promise<void>;
  getMetrics(name: AgentName): AgentMetrics;
}
```

**Depends on:** `AgentRepository`, `bus` (EventBus)

---

### 5.6 ToolService
**File:** `server/services/tool.service.ts`

**Responsibilities:**
- Register Tool (schema validation ke saath)
- Resolve Tool (name → executable instance)
- Permission Check (security gate)
- Tool Analytics (usage, failure rate, latency p99)
- Tool Recovery (structured variation inject on fail)

```typescript
interface IToolService {
  registerTool(tool: ToolDefinition): void;
  resolveTool(name: string): RegisteredTool;
  checkPermission(name: string, ctx: ToolContext): Promise<boolean>;
  executeTool(name: string, args: unknown, ctx: ToolContext): Promise<ToolResult>;
  getAnalytics(name: string): ToolAnalytics;
  triggerRecovery(name: string, failedArgs: unknown): RecoveryVariant;
}
```

**Depends on:** `ToolRepository`, `bus`

---

### 5.7 ExecutionService
**File:** `server/services/execution.service.ts`

**Responsibilities:**
- Create Run (agent run record)
- Update Run Status (running/completed/failed/cancelled)
- Create Task (sub-unit of a run)
- Update Task Status
- Manage Phases (plan ke phases track karo)
- Recovery (crash pe last stable state restore)
- Step Limit Enforcement (infinite loop prevent)

```typescript
interface IExecutionService {
  createRun(input: CreateRunInput): Promise<AgentRun>;
  updateRunStatus(runId: string, status: RunStatus): Promise<void>;
  createTask(runId: string, task: TaskInput): Promise<Task>;
  updateTask(taskId: string, update: TaskUpdate): Promise<void>;
  getRunState(runId: string): Promise<RunState>;
  incrementStepCount(runId: string): Promise<number>; // returns current
  isStepLimitReached(runId: string): Promise<boolean>;
  cancelRun(runId: string, reason: string): Promise<void>;
}
```

**Depends on:** `RunRepository`, `TaskRepository`, `CheckpointRepository`

---

### 5.8 VerificationService
**File:** `server/services/verification.service.ts`

**Responsibilities:**
- TypeCheck (tsc --noEmit)
- Build Verification (npm run build)
- Runtime Check (app start + health ping)
- Test Runner (jest/vitest execute)
- Validation Gate (fail-closed — sab pass hone ke baad hi expose)
- Error Summarization (raw stack → human-readable)

```typescript
interface IVerificationService {
  runTypecheck(projectId: string): Promise<VerifyResult>;
  runBuild(projectId: string): Promise<VerifyResult>;
  runHealthCheck(projectId: string): Promise<VerifyResult>;
  runTests(projectId: string): Promise<VerifyResult>;
  runFullSuite(projectId: string): Promise<FullVerifyReport>;
  summarizeError(rawError: string): Promise<string>; // human-readable
}
```

**Depends on:** `ExecutionService`, `FilesystemService`

---

### 5.9 ResearchService
**File:** `server/services/research.service.ts`

**Responsibilities:**
- Web Search (external APIs)
- RAG Query (Milvus vector search)
- Citation Engine (har answer ke saath source)
- Knowledge Graph Build (codebase se relations extract)

```typescript
interface IResearchService {
  webSearch(query: string): Promise<SearchResult[]>;
  ragQuery(query: string, projectId: string): Promise<RagResult>;
  buildKnowledgeGraph(projectId: string): Promise<KnowledgeGraph>;
  getCitedAnswer(query: string, sources: string[]): Promise<CitedAnswer>;
}
```

**Depends on:** `VectorRepository`, `MemoryService`

---

### 5.10 DocumentationService
**File:** `server/services/documentation.service.ts`

**Responsibilities:**
- Auto-generate Docs (code change ke baad)
- Architecture Docs (system overview)
- API Docs (routes + schemas)
- Summary Reports (run summary)

```typescript
interface IDocumentationService {
  generateDocs(projectId: string): Promise<DocBundle>;
  generateArchitectureDoc(projectId: string): Promise<string>;
  generateApiDocs(projectId: string): Promise<string>;
  generateRunSummary(runId: string): Promise<string>;
}
```

**Depends on:** `ResearchService`, `FilesystemService`, `RunRepository`

---

### 5.11 PresentationService
**File:** `server/services/presentation.service.ts`

**Responsibilities:**
- Slides generate (Gamma-style card-based)
- Architecture diagrams
- Export (PDF/PPTX)
- Audio Changelog (text → audio)

```typescript
interface IPresentationService {
  generateSlides(input: SlideInput): Promise<SlideBundle>;
  generateDiagram(type: DiagramType, data: unknown): Promise<string>; // SVG
  exportToPdf(slideBundle: SlideBundle): Promise<Buffer>;
  generateAudioChangelog(runId: string): Promise<AudioUrl>;
}
```

**Depends on:** `DocumentationService`, `ResearchService`

---

### 5.12 DeploymentService
**File:** `server/services/deployment.service.ts`

**Responsibilities:**
- Build for production
- Deploy (Replit/Vercel/custom)
- Rollback (checkpoint se)
- Environment Management (dev/staging/prod)

```typescript
interface IDeploymentService {
  buildForProduction(projectId: string): Promise<BuildArtifact>;
  deploy(projectId: string, env: Environment): Promise<DeployResult>;
  rollback(projectId: string, checkpointId: string): Promise<void>;
  getDeploymentStatus(projectId: string): Promise<DeployStatus>;
}
```

**Depends on:** `CheckpointRepository`, `ExecutionService`, `FilesystemService`

---

## 🗄️ PART 6: REPOSITORY LAYER — Complete Definitions

> **Rule: No business logic. Sirf persistence — read/write/query.**

---

### 6.1 ProjectRepository
**File:** `server/repositories/project.repository.ts`

**Store:** `projects` table

```typescript
interface IProjectRepository {
  create(data: NewProject): Promise<Project>;
  findById(id: string): Promise<Project | null>;
  findAll(): Promise<Project[]>;
  update(id: string, data: Partial<Project>): Promise<Project>;
  delete(id: string): Promise<void>;
}
```

---

### 6.2 RunRepository
**File:** `server/repositories/run.repository.ts`

**Store:** `agent_runs` table

```typescript
interface IRunRepository {
  create(data: NewRun): Promise<AgentRun>;
  findById(runId: string): Promise<AgentRun | null>;
  findByProject(projectId: string): Promise<AgentRun[]>;
  updateStatus(runId: string, status: RunStatus): Promise<void>;
  updateResult(runId: string, result: unknown): Promise<void>;
  markCompleted(runId: string): Promise<void>;
  markFailed(runId: string, errorLog: string): Promise<void>;
}
```

---

### 6.3 TaskRepository
**File:** `server/repositories/task.repository.ts`

**Store:** `tasks` table (naya table — blueprint extension)

```typescript
interface ITaskRepository {
  create(data: NewTask): Promise<Task>;
  findByRun(runId: string): Promise<Task[]>;
  updateStatus(taskId: string, status: TaskStatus): Promise<void>;
  findPending(runId: string): Promise<Task[]>;
  findFailed(runId: string): Promise<Task[]>;
}
```

---

### 6.4 AgentRepository
**File:** `server/repositories/agent.repository.ts`

**Store:** `agent_registry` table (naya)

```typescript
interface IAgentRepository {
  register(data: AgentMetadata): Promise<void>;
  findByName(name: string): Promise<AgentMetadata | null>;
  updateHealth(name: string, health: AgentHealth): Promise<void>;
  updateMetrics(name: string, metrics: AgentMetrics): Promise<void>;
  findAll(): Promise<AgentMetadata[]>;
}
```

---

### 6.5 MemoryRepository
**File:** `server/repositories/memory.repository.ts`

**Store:** `chat_messages` + `execution_memory` tables

```typescript
interface IMemoryRepository {
  // Conversation
  appendMessage(data: NewChatMessage): Promise<ChatMessage>;
  getMessages(runId: string, limit?: number): Promise<ChatMessage[]>;
  deleteMessages(runId: string): Promise<void>;

  // Execution Memory
  upsertTodoList(runId: string, summary: string): Promise<void>;
  getTodoList(runId: string): Promise<string | null>;
}
```

---

### 6.6 VectorRepository
**File:** `server/repositories/vector.repository.ts`

**Store:** Milvus vector database

```typescript
interface IVectorRepository {
  upsert(collection: string, id: string, vector: number[], metadata: unknown): Promise<void>;
  search(collection: string, queryVector: number[], topK: number): Promise<VectorResult[]>;
  delete(collection: string, id: string): Promise<void>;
  createCollection(name: string, dim: number): Promise<void>;
  collectionExists(name: string): Promise<boolean>;
}
```

---

### 6.7 ToolRepository
**File:** `server/repositories/tool.repository.ts`

**Store:** `tool_definitions` + `tool_executions` tables

```typescript
interface IToolRepository {
  // Definitions
  registerTool(data: ToolDefinition): Promise<void>;
  findTool(name: string): Promise<ToolDefinition | null>;
  findAllTools(): Promise<ToolDefinition[]>;

  // Executions
  logExecution(data: NewToolExecution): Promise<ToolExecution>;
  findExecutions(runId: string): Promise<ToolExecution[]>;
  getFailureRate(toolName: string): Promise<number>;
}
```

---

### 6.8 EventRepository
**File:** `server/repositories/event.repository.ts`

**Store:** `agent_events` table

```typescript
interface IEventRepository {
  append(event: NewAgentEvent): Promise<AgentEvent>;
  findByRun(runId: string): Promise<AgentEvent[]>;
  findByType(type: string, limit: number): Promise<AgentEvent[]>;
  findByProject(projectId: string, since?: Date): Promise<AgentEvent[]>;
  pruneOld(beforeDate: Date): Promise<number>; // returns deleted count
}
```

---

### 6.9 CheckpointRepository
**File:** `server/repositories/checkpoint.repository.ts`

**Store:** `checkpoints` table

```typescript
interface ICheckpointRepository {
  create(data: NewCheckpoint): Promise<Checkpoint>;
  findByProject(projectId: string): Promise<Checkpoint[]>;
  findLatest(projectId: string): Promise<Checkpoint | null>;
  findByLabel(projectId: string, label: string): Promise<Checkpoint | null>;
  delete(checkpointId: string): Promise<void>;
}
```

---

## 🗃️ PART 7: DATABASE SCHEMA — Extended (Services + Repos ke liye)

**File:** `shared/schema.ts`

```typescript
// ─── EXISTING 7 TABLES (unchanged) ───────────────────────
// projects, agent_runs, chat_messages, agent_events,
// tool_executions, diff_queue, checkpoints

// ─── NEW TABLES (Service/Repo layer ke liye) ─────────────

// 8. TASKS (ExecutionService → TaskRepository)
export const tasks = pgTable("tasks", {
  id:          text("id").primaryKey(),
  runId:       text("run_id").references(() => agentRuns.id),
  projectId:   text("project_id").references(() => projects.id),
  name:        text("name").notNull(),
  status:      text("status").default("pending"),
  // pending | running | completed | failed | skipped
  stepIndex:   integer("step_index").default(0),
  maxSteps:    integer("max_steps").default(50),
  result:      jsonb("result"),
  errorLog:    text("error_log"),
  startedAt:   timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt:   timestamp("created_at").defaultNow(),
});

// 9. AGENT REGISTRY (AgentService → AgentRepository)
export const agentRegistry = pgTable("agent_registry", {
  name:       text("name").primaryKey(),  // l1-supervisor, l2-coder, etc.
  level:      text("level").notNull(),    // L1 | L2 | L3
  status:     text("status").default("idle"),
  // idle | busy | paused | error
  health:     jsonb("health"),
  metrics:    jsonb("metrics"),           // tokens, tool_calls, avg_latency
  lastSeen:   timestamp("last_seen").defaultNow(),
  registeredAt: timestamp("registered_at").defaultNow(),
});

// 10. TOOL DEFINITIONS (ToolService → ToolRepository)
export const toolDefinitions = pgTable("tool_definitions", {
  name:        text("name").primaryKey(),
  description: text("description").notNull(),
  category:    text("category").notNull(),
  schema:      jsonb("schema").notNull(),  // JSON Schema
  terminal:    boolean("terminal").default(false),
  enabled:     boolean("enabled").default(true),
  createdAt:   timestamp("created_at").defaultNow(),
});

// 11. EXECUTION MEMORY (MemoryService → MemoryRepository)
export const executionMemory = pgTable("execution_memory", {
  runId:      text("run_id").primaryKey().references(() => agentRuns.id),
  todoList:   text("todo_list"),          // Self-summarized progress
  stepCount:  integer("step_count").default(0),
  updatedAt:  timestamp("updated_at").defaultNow(),
});

// 12. DEPLOYMENTS (DeploymentService → no dedicated repo, uses RunRepo)
export const deployments = pgTable("deployments", {
  id:          text("id").primaryKey(),
  projectId:   text("project_id").references(() => projects.id),
  environment: text("environment").notNull(), // dev | staging | prod
  status:      text("status").default("pending"),
  url:         text("url"),
  buildLog:    text("build_log"),
  checkpointId: text("checkpoint_id"),
  deployedAt:  timestamp("deployed_at"),
  createdAt:   timestamp("created_at").defaultNow(),
});
```

---

## 🔧 PART 8: TOOL SYSTEM — Deterministic Execution

### Problem:
LLM hallucinate karta hai tool names → infinite loop

### Solution: Masked Token Logits
```typescript
const TOOL_PREFIXES = [
  'fs_read', 'fs_write', 'fs_delete',
  'shell_exec', 'shell_kill',
  'browser_navigate', 'browser_click', 'browser_screenshot',
  'task_complete', 'task_fail'
]
// At inference time → probability mass sirf in prefixes pe
// Mathematical guarantee: hallucination impossible
```

### Tool Recovery (Manus Pattern):
```
Tool fail → SAME command retry mat karo
    ↓
ToolService.triggerRecovery() call karo
    ↓
Structured variation inject karo:
  - Alternate serialization template
  - Perturbed system phrasing
  - Different parameter order
    ↓
Attention mechanism break hoga → Agent nayi strategy dhundega
```

---

## ⚙️ PART 9: ORCHESTRATION — 2 Modes

### Mode A: Synchronous (Interactive Dev)
```
Human types → Agent sees in real-time
    ↓
Plan Timeline ← Both read/write → Action Timeline
    ↓
Human file edit → Agent recalculates IMMEDIATELY
    ↓
WorkspaceService.lockWorkspace() → Safe concurrent access
```

### Mode B: Asynchronous (Heavy Tasks)
```
GitHub issue / Chat command
    ↓
ExecutionService.createRun()
    ↓
Firecracker VM instantiate (isolated)
    ↓
Parallel subagents spawn
    ↓
Output = PR with diff (DiffQueue → approved/rejected)
    ↓
Human review → Merge / Reject
ExecutionService.isStepLimitReached() check every step
```

---

## 🛡️ PART 10: ERROR HANDLING PIPELINE

```
Code generate hua
    ↓
VerificationService.runFullSuite()
    ↓
    ├── PASS → DeploymentService.deploy() → User ko dikhao
    │
    └── FAIL
          ↓
          VerificationService.summarizeError() [raw JSON → human text]
          ↓
          ExecutionService incrementStepCount check
          ↓
          Retry limit check (max 3-5 attempts)
          ↓
          Still FAIL?
          ↓
          User ko: "Line 47 mein type mismatch — architecture guidance chahiye"
          MemoryService.storePattern(failurePattern) → Future mein avoid
```

### Reward Hacking Prevention:
```
RL training mein strictly penalize karo:
  ❌ Broken tool schemas emit karna
  ❌ Excessive clarifying questions
  ❌ Scope creep (unrelated files modify karna)
  ✅ Decisive action reward karo
  ✅ Correct tool call reward karo
```

---

## 🖥️ PART 11: FRONTEND UX — 5 Panels

```
┌─────────────────────────────────────────────────────────┐
│                    NURAX IDE                            │
├─────────────┬──────────────────┬───────────────────────┤
│ CHAT PANEL  │  EXECUTION       │  LIVE PREVIEW         │
│             │  MONITOR         │                       │
│ @file inject│  Real-time       │  iframe sandbox       │
│ /architect  │  terminal        │  Port 5000            │
│ /execute    │  shell output    │  Auto-refresh         │
│ /rollback   │  npm logs        │                       │
├─────────────┴──────────────────┼───────────────────────┤
│ AGENT TIMELINE                 │  MEMORY VIEWER        │
│                                │                       │
│ [10:23] fs_write App.tsx ✅    │  Current context:     │
│ [10:24] shell_exec npm ✅      │  [repo_map: 1.2k tok] │
│ [10:25] browser_screenshot ✅  │  [chat: 3.4k tok]     │
│ ← Click any step to ROLLBACK → │  [prune button]       │
└────────────────────────────────┴───────────────────────┘
```

---

## 📦 PART 12: COMPLETE FOLDER STRUCTURE (v2.0 — Services + Repos included)

```
nurax/
├── .replit
├── main.ts
├── shared/
│   ├── schema.ts                    # 12 tables (7 original + 5 new)
│   └── types.ts                     # Shared interfaces
│
├── server/
│   │
│   ├── agents/                      # AGENT LAYER — only calls Services
│   │   ├── l1-supervisor/
│   │   ├── l2-architect/
│   │   ├── l2-coder/
│   │   ├── l2-navigator/
│   │   ├── l2-verifier/
│   │   ├── l3-browser/
│   │   ├── l3-tool-dispatcher/
│   │   └── l3-synthesizer/
│   │
│   ├── services/                    # ← NEW: SERVICE LAYER
│   │   ├── project.service.ts       # Create/delete/load projects
│   │   ├── workspace.service.ts     # Open/close/lock workspace
│   │   ├── filesystem.service.ts    # CRUD files + patch + watch
│   │   ├── memory.service.ts        # All 4 memory layers
│   │   ├── agent.service.ts         # Agent lifecycle + health
│   │   ├── tool.service.ts          # Tool register + execute + recover
│   │   ├── execution.service.ts     # Runs + tasks + step limit
│   │   ├── verification.service.ts  # Typecheck + build + test
│   │   ├── research.service.ts      # Web search + RAG + citations
│   │   ├── documentation.service.ts # Auto-docs generation
│   │   ├── presentation.service.ts  # Slides + diagrams + audio
│   │   └── deployment.service.ts    # Build + deploy + rollback
│   │
│   ├── repositories/                # ← NEW: REPOSITORY LAYER
│   │   ├── project.repository.ts    # projects table
│   │   ├── run.repository.ts        # agent_runs table
│   │   ├── task.repository.ts       # tasks table
│   │   ├── agent.repository.ts      # agent_registry table
│   │   ├── memory.repository.ts     # chat_messages + execution_memory
│   │   ├── vector.repository.ts     # Milvus client
│   │   ├── tool.repository.ts       # tool_definitions + tool_executions
│   │   ├── event.repository.ts      # agent_events table
│   │   └── checkpoint.repository.ts # checkpoints table
│   │
│   ├── infrastructure/
│   │   ├── events/
│   │   │   ├── bus.ts
│   │   │   └── sse-manager.ts
│   │   ├── memory/
│   │   │   ├── ast-manager.ts       # Tree-sitter (MemoryService uses this)
│   │   │   ├── pagerank.ts
│   │   │   └── vector-db.ts         # Milvus connection (VectorRepository uses this)
│   │   ├── sandbox/
│   │   │   └── vm-manager.ts
│   │   └── tools/
│   │       ├── registry.ts          # ToolService uses this
│   │       ├── masked-logits.ts
│   │       └── categories/
│   │
│   ├── orchestration/
│   │   ├── sync-mode.ts
│   │   ├── async-mode.ts
│   │   └── plan-timeline.ts
│   │
│   └── verification/
│       ├── fail-closed.ts           # VerificationService uses this
│       └── reward-shaper.ts
│
├── client/
│   ├── panels/
│   │   ├── ChatPanel.tsx
│   │   ├── ExecutionMonitor.tsx
│   │   ├── AgentTimeline.tsx
│   │   ├── MemoryViewer.tsx
│   │   └── LivePreview.tsx
│   └── App.tsx
│
└── .sandbox/
    └── {project-id}/
```

---

## 🚀 PART 13: BUILD ORDER — Exact Sequence (Updated)

```
Week 1: Foundation
  Day 1:   Replit setup + .replit + package.json
  Day 2:   DB Schema (12 tables) + drizzle-kit push
  Day 3:   Event Bus (bus.ts + sse-manager.ts)
  Day 4:   Repository Layer (9 repositories — thin wrappers only)
  Day 5-7: Core Services: ProjectService + WorkspaceService + FilesystemService

Week 2: Intelligence Layer
  Day 8:   MemoryService (Layer 1: AST + PageRank)
  Day 9:   MemoryService (Layer 2: Self-summarizing + Layer 3: Live)
  Day 10:  VectorRepository + MemoryService (Layer 4: Milvus)
  Day 11:  AgentService + ToolService (register/resolve/recover)
  Day 12:  ExecutionService (runs + tasks + step limits)
  Day 13-14: L2 Coder Agent (first agent using services — not DB directly)

Week 3: Agent + Orchestration
  Day 15:  L1 Supervisor + Plan Timeline
  Day 16:  L2 Architect + L2 Navigator
  Day 17:  VerificationService (typecheck + build + test)
  Day 18:  L2 Verifier (Firecracker VM)
  Day 19:  Orchestration Engine (sync + async modes)
  Day 20-21: Error handling + Reward shaper + Rollback

Week 4: External Layer + Frontend
  Day 22:  L3 Tool Dispatcher (MCP + masked logits)
  Day 23:  L3 Browser Agent (Playwright CUA)
  Day 24:  ResearchService + L3 Synthesizer (Milvus RAG)
  Day 25:  DocumentationService + PresentationService
  Day 26:  DeploymentService
  Day 27-28: 5-panel Frontend UI
  Day 29:  Memory Viewer + Diff approval system
  Day 30:  Integration test + end-to-end run
```

---

## 💡 PART 14: KILLER DIFFERENTIATORS

**1. Zero Credit Blame Policy**
Agent ki galti → VerificationService catches it → Agent fix kare → User ka paisa nahi jaata

**2. Flame Chart Ingestion**
Browser Agent → CPU profiling data read kare → Performance bugs autonomous fix

**3. Dual Timeline Editing**
Human mid-flight plan change kare → Agent INSTANTLY recalculates → No restart needed

**4. Citation-First Documentation**
Har code change → Synthesizer Agent → DocumentationService → Auto-updated docs with source links

**5. Adversarial RL Training**
Reward hacking mathematically impossible → Agent always attempts, never evades

**6. [NEW] Service Isolation Guarantee**
Agent kabhi direct DB call nahi karega → No circular dependency → No spaghetti code → Clean testable architecture

**7. [NEW] Repository = Single Source of Truth**
Har data operation ek jagah → Easy to mock in tests → Easy to swap DB in future

---

## 🎯 FINAL ARCHITECTURE RULE — Frame Karke Rakh Lo

```
NEVER:                    ALWAYS:
                          
Agent ──x──► DB           Agent ──► Service ──► Repository ──► DB
Agent ──x──► Repo         
Tool  ──x──► DB           Tool ──► ToolService ──► ToolRepository ──► DB
Tool  ──x──► Repo         
```

**Why this matters:**
- **Testability:** Service mock karo → Agent test isolated ho jaata hai
- **Swappability:** PostgreSQL → MongoDB? Sirf Repository badlo
- **Debuggability:** Bug kahan hai? Service logs dekho — sirf ek jagah
- **Circular deps ZERO:** Ek direction mein hi flow hai

---

## 🎯 ONE-LINE SUMMARY

> **NURAX = Cursor ka speed + Devin ka verification + Windsurf ka timeline + Aider ka memory + Enterprise-grade Service/Repository architecture — minus sabki pricing frustration**

Yeh sirf ek coding tool nahi hai.
Yeh pehla properly layered **autonomous software factory** hai.
Agent sochta hai. Service decide karta hai. Repository store karta hai. Database sirf data rakhta hai.
**Har layer apna kaam. Koi overlap nahi. Koi circular dependency nahi.**
