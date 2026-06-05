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

