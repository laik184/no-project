# 🔵 HVP BLUEPRINT — Agentic Vibe Coder AI
### Replit Par Same System Banana — Complete Guide
**Version:** 1.0 | **Language:** Hinglish | **Level:** Intermediate → Advanced

---

> **YEH DOCUMENT KYA HAI?**
> Yeh ek step-by-step blueprint hai jo explain karta hai ki NURA-X jaise
> Agentic AI Vibe Coder ko Replit par kaise banaya jaata hai — architecture
> se lekar har ek file, pattern, aur system cycle tak.
> Koi bhi developer is document ko padh ke same system build kar sakta hai.

---

## 📋 TABLE OF CONTENTS

1. [System Ka Idea — Kya Banana Hai?](#1-system-ka-idea)
2. [Replit Environment Setup](#2-replit-environment-setup)
3. [Database Blueprint](#3-database-blueprint)
4. [Backend Architecture](#4-backend-architecture)
5. [Event Bus — Real-time System](#5-event-bus)
6. [Agent System — 7 Agents](#6-agent-system)
7. [Orchestration Engine](#7-orchestration-engine)
8. [Tool Registry System](#8-tool-registry-system)
9. [Fail-Closed Verification](#9-fail-closed-verification)
10. [Frontend Architecture](#10-frontend-architecture)
11. [Chat Page Cycle](#11-chat-page-cycle)
12. [Console Pipeline](#12-console-pipeline)
13. [Preview System](#13-preview-system)
14. [File Explorer System](#14-file-explorer-system)
15. [Memory System](#15-memory-system)
16. [Complete System Cycle](#16-complete-system-cycle)
17. [Folder Structure](#17-folder-structure)
18. [Tech Stack Checklist](#18-tech-stack-checklist)
19. [Build Order — Step by Step](#19-build-order)

---

## 1. SYSTEM KA IDEA — KYA BANANA HAI? {#1-system-ka-idea}

```
USER ek app idea deta hai
        ↓
AI Agent apne aap:
  ✅ Plan banata hai
  ✅ Code likhta hai
  ✅ Errors fix karta hai
  ✅ Preview dikhata hai
  ✅ Deploy karta hai

= AUTONOMOUS VIBE CODER AI
```

**Core Value Proposition:**
- User ko sirf idea dena hai
- Baaki sab system karta hai
- Real-time progress dikhta hai
- Self-healing — errors khud fix karta hai
- Checkpoints — rollback possible

---

## 2. REPLIT ENVIRONMENT SETUP {#2-replit-environment-setup}

### `.replit` File (Must Have)
```toml
modules = ["nodejs-20", "web", "bash"]

[nix]
channel = "stable-25_05"

[agent]
expertMode = true
stack = "FULLSTACK_JS"
integrations = ["javascript_openrouter_ai_integrations:2.0.0"]

[[workflows.workflow]]
name = "Start application"
author = "agent"

[workflows.workflow.metadata]
outputType = "webview"

[[workflows.workflow.tasks]]
task = "shell.exec"
args = "npm run dev"
waitForPort = 5000        # Vite frontend port

[[ports]]
localPort = 5000          # Frontend (user dekh sakta hai)
externalPort = 80

[[ports]]
localPort = 3001          # Backend API (internal)
externalPort = 3002

[userenv]
[userenv.shared]
LLM_BASE_URL   = "https://openrouter.ai/api/v1"
LLM_MODEL      = "openai/gpt-4o-mini"
AGENT_PROJECT_ROOT = ".sandbox"
```

### Required Secrets (Replit Secrets Tab mein add karo)
```
OPENROUTER_API_KEY   → AI calls ke liye (MUST HAVE)
DATABASE_URL         → Replit auto-provide karta hai
SESSION_SECRET       → Random string
```

### `package.json` Scripts
```json
{
  "scripts": {
    "dev":     "concurrently -k -n api,web -c blue,magenta \"npm:dev:api\" \"npm:dev:web\"",
    "dev:api": "tsx watch main.ts",
    "dev:web": "vite",
    "build":   "vite build",
    "start":   "tsx main.ts",
    "db:push": "drizzle-kit push"
  }
}
```

### Key Dependencies
```bash
# Backend
npm install express tsx drizzle-orm pg ws chokidar uuid zod

# Frontend
npm install react react-dom vite wouter @tanstack/react-query
npm install @monaco-editor/react lucide-react tailwindcss

# AI
npm install openai

# Dev
npm install -D concurrently typescript drizzle-kit
```

---

## 3. DATABASE BLUEPRINT {#3-database-blueprint}

**File:** `shared/schema.ts`

```typescript
import { pgTable, text, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

// ─── 1. PROJECTS ──────────────────────────────────────────
// Har ek user ka sandboxed workspace
export const projects = pgTable("projects", {
  id:          text("id").primaryKey(),        // UUID
  name:        text("name").notNull(),
  description: text("description"),
  rootPath:    text("root_path").notNull(),    // .sandbox/project-id/
  status:      text("status").default("idle"), // idle | running | error
  createdAt:   timestamp("created_at").defaultNow(),
});

// ─── 2. AGENT RUNS ────────────────────────────────────────
// Har ek AI execution session
export const agentRuns = pgTable("agent_runs", {
  id:          text("id").primaryKey(),
  projectId:   text("project_id").references(() => projects.id),
  goal:        text("goal").notNull(),          // User ka app idea
  status:      text("status").default("running"),
  // running | completed | failed | cancelled
  mode:        text("mode").default("tool-loop"),
  // tool-loop | planned | dag | pipeline
  result:      jsonb("result"),
  errorLog:    text("error_log"),
  startedAt:   timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// ─── 3. CHAT MESSAGES ─────────────────────────────────────
export const chatMessages = pgTable("chat_messages", {
  id:        text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id),
  runId:     text("run_id"),
  role:      text("role").notNull(),   // user | assistant | tool
  content:   text("content"),
  toolCalls: jsonb("tool_calls"),      // [{id, name, arguments}]
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── 4. AGENT EVENTS (Real-time log) ──────────────────────
export const agentEvents = pgTable("agent_events", {
  id:        text("id").primaryKey(),
  runId:     text("run_id").notNull(),
  projectId: text("project_id").notNull(),
  type:      text("type").notNull(),
  // agent.thinking | agent.tool_call | agent.complete | run.lifecycle
  phase:     text("phase"),
  agentName: text("agent_name"),
  payload:   jsonb("payload"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// ─── 5. TOOL EXECUTIONS ───────────────────────────────────
export const toolExecutions = pgTable("tool_executions", {
  id:         text("id").primaryKey(),
  runId:      text("run_id").notNull(),
  toolName:   text("tool_name").notNull(),
  arguments:  jsonb("arguments"),
  result:     jsonb("result"),
  status:     text("status"),            // success | error | timeout
  durationMs: integer("duration_ms"),
  createdAt:  timestamp("created_at").defaultNow(),
});

// ─── 6. DIFF QUEUE ────────────────────────────────────────
// Agent ke proposed file changes (approve/reject)
export const diffQueue = pgTable("diff_queue", {
  id:          text("id").primaryKey(),
  projectId:   text("project_id").notNull(),
  runId:       text("run_id"),
  filePath:    text("file_path").notNull(),
  oldContent:  text("old_content"),
  newContent:  text("new_content").notNull(),
  status:      text("status").default("pending"),
  // pending | approved | rejected
  createdAt:   timestamp("created_at").defaultNow(),
});

// ─── 7. CHECKPOINTS ───────────────────────────────────────
export const checkpoints = pgTable("checkpoints", {
  id:          text("id").primaryKey(),
  projectId:   text("project_id").notNull(),
  runId:       text("run_id"),
  label:       text("label"),            // "after-phase-1", "pre-build"
  snapshotPath: text("snapshot_path"),   // zip file location
  metadata:    jsonb("metadata"),
  createdAt:   timestamp("created_at").defaultNow(),
});
```

---

## 4. BACKEND ARCHITECTURE {#4-backend-architecture}

**File:** `main.ts`

```typescript
import express from 'express';
import { createServer } from 'http';

const app  = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(express.json({ limit: '10mb' }));

// ─── API Routes ───────────────────────────────────────────
app.use('/api/projects',    createProjectsRouter());
app.use('/api/run',         createRunRouter());        // ← Main agent trigger
app.use('/api/fs',          createFsRouter());
app.use('/api/chat',        chatOrchestrator.buildChatRouter());
app.use('/api/checkpoints', createCheckpointsRouter());
app.use('/api/verify',      createFailClosedRouter()); // ← Verification engine
app.use('/api/tools',       createToolsRouter());
app.use('/api/memory',      createMemoryRouter());

// ─── Real-time ────────────────────────────────────────────
app.use(chatOrchestrator.buildSseRouter());  // SSE events

// ─── Health ───────────────────────────────────────────────
app.get('/health',          (_req, res) => res.json({ status: 'ok' }));
app.get('/api/health/llm',  checkLlmHealth);

// ─── Server ───────────────────────────────────────────────
const server = createServer(app);
chatOrchestrator.attachWebSocket(server);    // WebSocket for terminal

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`[app] API running on port ${PORT}`);
  await runtimeManager.init();
  initOrchestration();
});

// ─── Graceful Shutdown ────────────────────────────────────
process.on('SIGTERM', async () => {
  await runtimeManager.shutdown();
  server.close(() => process.exit(0));
});
```

---

## 5. EVENT BUS — REAL-TIME SYSTEM {#5-event-bus}

**File:** `server/infrastructure/events/bus.ts`

```
YEH SYSTEM KA NERVOUS SYSTEM HAI
Har component yahan se baat karta hai
```

```typescript
// bus.ts — Singleton Typed Event Emitter
import { EventEmitter } from 'events';

// ─── Event Types ──────────────────────────────────────────
export interface BusEvents {
  'agent.event':           AgentEventPayload;
  'run.lifecycle':         LifecyclePayload;     // started|running|completed|failed
  'console.log':           ConsoleLinePayload;
  'file.change':           FileChangePayload;
  'tool.execution':        ToolExecutionPayload;
  'preview.lifecycle':     PreviewStatePayload;  // idle|starting|running|error
  'agent.diff':            DiffPayload;
  'checkpoint.created':    CheckpointPayload;
  'runtime.observation':   RuntimePayload;
  'debug.lifecycle':       DebugPayload;
  'process.crashed':       CrashPayload;         // ← CrashResponder sunta hai
}

// ─── Singleton ────────────────────────────────────────────
class AppEventBus extends EventEmitter {
  emit<K extends keyof BusEvents>(event: K, payload: BusEvents[K]): boolean {
    return super.emit(event as string, payload);
  }
  on<K extends keyof BusEvents>(event: K, listener: (p: BusEvents[K]) => void) {
    return super.on(event as string, listener);
  }
}

export const bus = new AppEventBus();

// ─── Usage Example ────────────────────────────────────────
// Emit:
bus.emit('run.lifecycle', { runId, projectId, status: 'completed' });

// Listen:
bus.on('process.crashed', (payload) => crashResponder.handle(payload));
```

### SSE Manager — Frontend Tak Events Pohonchana

```typescript
// server/infrastructure/events/sse/sse-manager.ts

class SseManager {
  private connections = new Map<string, Response[]>();

  // Client connect karta hai
  addConnection(projectId: string, res: Response, topics: string[]) {
    res.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    });
    this.connections.set(projectId, [...(this.connections.get(projectId) || []), res]);
  }

  // Event broadcast karo
  broadcast(projectId: string, topic: string, data: unknown) {
    const clients = this.connections.get(projectId) || [];
    const payload = `data: ${JSON.stringify({ topic, data })}\n\n`;
    clients.forEach(res => res.write(payload));
  }
}

// Bus se SSE ko wire karo:
bus.on('run.lifecycle', (p) => sseManager.broadcast(p.projectId, 'lifecycle', p));
bus.on('agent.event',   (p) => sseManager.broadcast(p.projectId, 'agent', p));
bus.on('console.log',   (p) => sseManager.broadcast(p.projectId, 'console', p));
bus.on('file.change',   (p) => sseManager.broadcast(p.projectId, 'file', p));
```

---

## 6. AGENT SYSTEM — 7 AGENTS {#6-agent-system}

```
AGENT = AI + Tools + Memory + Instructions

Har Agent:
  1. System Prompt milta hai (uska role)
  2. Tools milte hain (kya kar sakta hai)
  3. Context milta hai (pehle kya hua)
  4. LLM se decision leta hai
  5. Action karta hai
  6. Result observe karta hai
  7. Loop repeat karta hai
```

### Agent 1: PLANNER AGENT
**File:** `server/agents/planning/planner.agent.ts`

```typescript
// Goal → Phases mein todta hai

interface ExecutionPlan {
  phases: Phase[];
  complexity: 'simple' | 'moderate' | 'complex';
}

interface Phase {
  id:           string;
  name:         string;           // "Setup", "Frontend", "Backend"
  objective:    string;           // Kya karna hai
  tools:        string[];         // Kaun se tools lagenge
  verification: string[];         // Success criteria
  dependsOn:    string[];         // Pehle kaunsa phase complete ho
}

async function plan(goal: string): Promise<ExecutionPlan> {
  const response = await llm.chatWithTools([
    { role: 'system', content: PLANNER_SYSTEM_PROMPT },
    { role: 'user',   content: `Goal: ${goal}` }
  ], plannerTools);
  return parseExecutionPlan(response.content);
}
```

### Agent 2: TOOL-LOOP AGENT (Main Executor)
**File:** `server/agents/core/tool-loop/tool-loop.agent.ts`

```typescript
// THINK → TOOL → OBSERVE → REPEAT

async function runToolLoop(goal: string, context: AgentContext) {
  const messages: Message[] = [
    { role: 'system', content: buildSystemPrompt(context) },
    { role: 'user',   content: goal }
  ];

  while (true) {
    // 1. LLM se decision lo (streaming)
    const response = await llm.streamChatWithTools(messages, ALL_TOOLS, {
      onToken: (token) => bus.emit('agent.event', { type: 'token', token })
    });

    // 2. Tool call hai?
    if (response.toolCalls.length === 0) break; // Done

    // 3. Har tool execute karo
    for (const toolCall of response.toolCalls) {
      const result = await toolExecutor.execute(toolCall, context);

      // 4. Result ko messages mein add karo (LLM context)
      messages.push({ role: 'tool', content: result, tool_call_id: toolCall.id });
    }

    // 5. Loop continue
    messages.push({ role: 'assistant', ...response });
  }
}
```

### Agent 3: BROWSER AGENT
**File:** `server/agents/browser/browser-agent.ts`

```typescript
// Visual verification — app sahi dikh raha hai?

async function verifyBrowser(url: string) {
  const page = await playwright.chromium.launch().newPage();
  await page.goto(url);

  return {
    domStable:       await checkDomStability(page),
    hydrationErrors: await detectHydrationErrors(page),
    consoleErrors:   await collectConsoleErrors(page),
    responsive:      await checkResponsiveLayout(page),
    screenshot:      await page.screenshot({ fullPage: true }),
  };
}
```

### Agent 4: CRASH RESPONDER
**File:** `server/agents/recovery/crash-responder.ts`

```typescript
// process.crashed event sunta hai → auto-recover

bus.on('process.crashed', async (payload) => {
  const strategy = classifyError(payload.error);

  if (strategy === 'rollback') {
    await checkpointManager.restore(payload.projectId, 'last-stable');
  } else if (strategy === 'fix') {
    await runFixItLoop(payload);   // Agent khud fix karta hai
  }
});
```

### Agent 5: REFLECTION ENGINE
**File:** `server/engine/intelligence/reflection-engine.ts`

```typescript
// Verification fail? → analyze → feedback

async function reflect(failure: VerificationFailure): Promise<ReflectionReport> {
  const analysis = await llm.complete(
    `Failure: ${failure.stage}\nError: ${failure.error}\nAnalyze and suggest fix:`
  );
  return {
    rootCause:   analysis.rootCause,
    suggestion:  analysis.fix,
    confidence:  analysis.confidence,
    injectBack:  true   // Agent ke context mein dalo
  };
}
```

### Agent 6: SECURITY AGENT
```typescript
// Code likha gaya → scan karo

async function scanCode(filePath: string, content: string) {
  return {
    vulnerabilities: await detectVulnerabilities(content),
    secretsExposed:  await detectSecrets(content),    // API keys, passwords
    sqlInjection:    await detectSqlInjection(content),
    xssVectors:      await detectXss(content),
  };
}
```

### Agent 7: RECOVERY MANAGER
```typescript
// Lock-guarded, timeout-protected recovery

async function startRecovery(runId: string) {
  if (recoveryLock.isLocked(runId)) return;  // Double recovery prevent

  await recoveryLock.acquire(runId);
  try {
    await withTimeout(
      performRecovery(runId),
      RECOVERY_TIMEOUT_MS
    );
  } finally {
    recoveryLock.release(runId);
  }
}
```

---

## 7. ORCHESTRATION ENGINE {#7-orchestration-engine}

**File:** `server/orchestration/core/orchestration-engine.ts`

```
YEH SYSTEM KA BRAIN HAI
Har run is engine se guzarta hai
```

```typescript
// 11-Step Pipeline
async function executeOrchestration(input: EngineInput): Promise<EngineResult> {
  const state: OrchestrationState = {
    phase:        'observe',
    status:       'running',
    phaseHistory: [],
    errorLog:     [],
    score:        0,
  };

  try {
    // Phase 1: OBSERVE — goal samjho
    await observe(input, state);

    // Phase 2: ANALYZE — complexity classify karo
    await analyze(input, state);

    // Phase 3: PLAN — strategy banao
    const plan = await planExecution(input, state);

    // Phase 4: ROUTE — execution mode choose karo
    const executor = executionRouter.route(plan);

    // Phase 5: EXECUTE — actual kaam karo
    await executor.run(input, state);

    // Phase 6: VERIFY — kaam sahi hua?
    const verification = await verificationEngine.run(input.projectId);

    // Phase 7: BROWSER — UI check karo
    await browserAgent.verify(getPreviewUrl(input.projectId));

    // Phase 8: REFLECT — failures analyze karo (if any)
    if (!verification.passed) await reflectionEngine.reflect(verification);

    // Phase 9: SCORE — quality grade do
    state.score = scoreEngine.grade(verification, state);

    // Phase 10: LEARN — patterns save karo
    await memoryManager.savePatterns(state);

    // Phase 11: COMPLETE — checkpoint + done
    await checkpointManager.save(input.projectId, 'run-complete');
    bus.emit('run.lifecycle', { status: 'completed', ...input });

    return { success: true, score: state.score };
  } catch (err) {
    bus.emit('run.lifecycle', { status: 'failed', error: err.message, ...input });
    return { success: false, error: err.message };
  }
}

// ─── Execution Router ─────────────────────────────────────
function route(plan: ExecutionPlan): Executor {
  if (plan.complexity === 'simple')  return new ToolLoopExecutor();
  if (plan.phases.length > 1)        return new PhasedExecutor();
  if (plan.hasParallel)              return new DagExecutor();
  return new PipelineExecutor();
}
```

---

## 8. TOOL REGISTRY SYSTEM {#8-tool-registry-system}

**Files:** `server/tools/registry/`, `server/tools/categories/`

```typescript
// ─── Tool Interface ───────────────────────────────────────
interface Tool {
  name:        string;
  description: string;         // LLM ko batao tool kya karta hai
  category:    ToolCategory;
  terminal:    boolean;        // True = run complete (task_complete)
  parameters: {
    type: 'object';
    properties: Record<string, JSONSchemaProperty>;
    required: string[];
  };
  run(args: unknown, ctx: ToolContext): Promise<ToolResult>;
}

// ─── Registry ─────────────────────────────────────────────
class UnifiedToolRegistry {
  private tools = new Map<string, RegisteredTool>();

  register(tool: Tool) {
    this.tools.set(tool.name, { ...tool, registeredAt: Date.now() });
    console.log(`[tool-registry] Registered: ${tool.name}`);
  }

  async execute(name: string, args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool not found: ${name}`);

    bus.emit('tool.execution', { name, status: 'started', ...ctx });

    try {
      // 1. Validate args
      validateArgs(tool, args);

      // 2. Security check
      await securityGate.check(name, args, ctx);

      // 3. Execute with timeout
      const result = await withTimeout(
        tool.run(args, ctx),
        TOOL_TIMEOUT_MS
      );

      bus.emit('tool.execution', { name, status: 'success', result, ...ctx });
      return result;
    } catch (err) {
      bus.emit('tool.execution', { name, status: 'error', error: err.message, ...ctx });
      throw err;
    }
  }
}

// ─── 15 Tool Categories (49 Tools) ───────────────────────
const TOOL_CATEGORIES = {
  file:       ['read_file', 'write_file', 'delete_file', 'move_file', 'list_dir'],
  shell:      ['shell_execute', 'shell_background'],
  git:        ['git_commit', 'git_diff', 'git_log', 'git_restore'],
  packages:   ['npm_install', 'npm_uninstall'],
  browser:    ['browser_screenshot', 'browser_navigate', 'browser_click'],
  security:   ['security_scan', 'secrets_detect'],
  auth:       ['generate_auth_session', 'generate_jwt', 'generate_bcrypt'],
  database:   ['db_query', 'db_migrate'],
  network:    ['http_request', 'check_port'],
  analysis:   ['read_errors', 'type_check', 'lint'],
  testing:    ['run_tests', 'generate_tests'],
  deployment: ['deploy_app', 'get_deploy_status'],
  memory:     ['save_memory', 'read_memory'],
  search:     ['search_files', 'search_content'],
  diff:       ['propose_diff', 'apply_diff'],
};
```

---

## 9. FAIL-CLOSED VERIFICATION {#9-fail-closed-verification}

**Files:** `server/fail-closed/`

```
YAHI SYSTEM KO RELIABLE BANATA HAI
Code likha → verify karo → pass nahi? → self-heal
```

```typescript
// ─── 5-Stage Pipeline ─────────────────────────────────────
class VerificationCoordinator {
  async verify(projectId: string): Promise<VerificationResult> {

    // Stage 1: STATIC — TypeScript + Lint
    const static_ = await this.staticVerifier.run(projectId);
    if (!static_.passed) return this.fail('STATIC', static_.errors);

    // Stage 2: BUILD — npm run build
    const build = await this.buildVerifier.run(projectId);
    if (!build.passed) {
      await checkpointManager.save(projectId, 'pre-build-fail');
      return this.fail('BUILD', build.errors);
    }

    // Checkpoint save — build pass hua ✅
    await checkpointManager.save(projectId, 'post-build-success');

    // Stage 3: RUNTIME — port respond kar raha hai?
    const runtime = await this.runtimeVerifier.run(projectId);
    if (!runtime.passed) return this.fail('RUNTIME', runtime.errors);

    // Stage 4: PREVIEW — DOM/Visual check
    const preview = await this.previewVerifier.run(projectId);
    if (!preview.passed) return this.fail('PREVIEW', preview.errors);

    // Stage 5: RECONCILE — final state match
    const reconcile = await this.stateReconciler.run(projectId);
    if (!reconcile.passed) return this.fail('RECONCILE', reconcile.errors);

    return { passed: true, grade: 'A', stages: [static_, build, runtime, preview, reconcile] };
  }

  private fail(stage: string, errors: string[]): VerificationResult {
    // Reflection Engine ko trigger karo
    reflectionEngine.reflect({ stage, errors });
    return { passed: false, stage, errors };
  }
}

// ─── Self-Healing Loop ────────────────────────────────────
// Verification fail → error context → agent wapas run
async function selfHeal(failure: VerificationResult, runId: string) {
  const feedback = await reflectionEngine.reflect(failure);

  // Agent ke messages mein inject karo
  await toolLoopAgent.resume(runId, {
    role:    'tool',
    content: `VERIFICATION FAILED at ${failure.stage}:\n${feedback.suggestion}`,
  });
}
```

---

## 10. FRONTEND ARCHITECTURE {#10-frontend-architecture}

**Stack:** React + Vite + Wouter + TanStack Query + Tailwind

```
client/
├── src/
│   ├── App.tsx               ← Routes define karo
│   ├── main.tsx              ← React entry point
│   ├── index.css             ← Tailwind + custom vars
│   │
│   ├── pages/                ← Har ek page
│   │   ├── Dashboard.tsx     ← Home — project list
│   │   ├── IDE.tsx           ← Main workspace
│   │   └── Preview.tsx       ← Live preview panel
│   │
│   ├── features/             ← Feature modules
│   │   ├── chat/             ← Chat panel
│   │   ├── file-explorer/    ← File tree
│   │   ├── console/          ← Log viewer
│   │   └── preview/          ← iframe preview
│   │
│   ├── hooks/                ← Custom hooks
│   │   ├── useAgentRunner.ts ← Run agent
│   │   ├── useRealtime.ts    ← SSE subscribe
│   │   └── useProject.ts     ← Project CRUD
│   │
│   └── lib/
│       └── queryClient.ts    ← TanStack Query setup
```

### `vite.config.ts` — Must Have Config
```typescript
export default defineConfig({
  plugins: [react()],
  root: 'client',
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,       // Replit proxy ke liye
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/sse': { target: 'http://localhost:3001', changeOrigin: true },
      '/ws':  { target: 'ws://localhost:3001',   ws: true },
    }
  }
});
```

---

## 11. CHAT PAGE CYCLE {#11-chat-page-cycle}

```typescript
// ─── 1. User Input ────────────────────────────────────────
// ChatInput.tsx
function ChatInput({ onSend }) {
  const [goal, setGoal] = useState('');
  return (
    <textarea
      value={goal}
      onChange={e => setGoal(e.target.value)}
      placeholder="Describe your app idea..."
    />
    <button onClick={() => onSend(goal)}>Send</button>
  );
}

// ─── 2. Agent Runner Hook ─────────────────────────────────
// hooks/useAgentRunner.ts
function useAgentRunner(projectId: string) {
  const queryClient = useQueryClient();

  const runMutation = useMutation({
    mutationFn: (goal: string) =>
      apiRequest('POST', '/api/run', { projectId, goal }),
    onSuccess: (data) => {
      // SSE subscribe karo immediately
      startRealtimeSubscription(data.runId);
    }
  });

  return { run: runMutation.mutate, isPending: runMutation.isPending };
}

// ─── 3. Real-time Events ─────────────────────────────────
// hooks/useRealtime.ts
function useRealtime(projectId: string) {
  useEffect(() => {
    const es = new EventSource(`/sse/project/${projectId}`);

    es.onmessage = (e) => {
      const { topic, data } = JSON.parse(e.data);

      switch (topic) {
        case 'agent':      handleAgentEvent(data);     break;
        case 'lifecycle':  handleLifecycle(data);      break;
        case 'console':    handleConsoleLog(data);     break;
        case 'file':       handleFileChange(data);     break;
        case 'checkpoint': handleCheckpoint(data);     break;
      }
    };

    return () => es.close();
  }, [projectId]);
}
```

---

## 12. CONSOLE PIPELINE {#12-console-pipeline}

```typescript
// ─── CaptureService — stdout/stderr pakdo ────────────────
class CaptureService {
  attach(process: ChildProcess, projectId: string) {
    process.stdout?.on('data', (chunk) => {
      const line: ConsoleLine = {
        id:        uuid(),
        projectId,
        content:   chunk.toString(),
        type:      'stdout',
        timestamp: Date.now(),
      };
      this.filterService.process(line);
    });

    process.stderr?.on('data', (chunk) => {
      this.filterService.process({ ...line, type: 'stderr', content: chunk.toString() });
    });
  }
}

// ─── FilterService — metadata extract karo ───────────────
class FilterService {
  process(line: ConsoleLine): ConsoleLine {
    // npm progress detect
    if (line.content.match(/added \d+ packages/)) line.meta = 'npm.success';

    // Vite URL detect
    if (line.content.match(/Local:\s+http/)) line.meta = 'vite.ready';

    // Error detect
    if (line.content.includes('Error:')) line.meta = 'error';

    // Frontend par bhejo
    bus.emit('console.log', line);
    return line;
  }
}

// ─── Frontend — ConsoleStream.tsx ─────────────────────────
function ConsoleView({ projectId }) {
  const [logs, setLogs] = useState<ConsoleLine[]>([]);

  useEffect(() => {
    // SSE se console.log events sun
    const unsub = realtimeClient.on('console', (line) => {
      setLogs(prev => [...prev, line]);
    });
    return unsub;
  }, [projectId]);

  return (
    <div className="console">
      {logs.map(log => (
        <div key={log.id} className={`log-line ${log.meta}`}>
          {log.content}
        </div>
      ))}
    </div>
  );
}
```

---

## 13. PREVIEW SYSTEM {#13-preview-system}

```typescript
// ─── State Machine ────────────────────────────────────────
type PreviewState = 'idle' | 'starting' | 'running' | 'error';

class PreviewLifecycleManager {
  private state: PreviewState = 'idle';

  transition(next: PreviewState) {
    this.state = next;
    bus.emit('preview.lifecycle', { state: next, projectId: this.projectId });
  }

  async start() {
    this.transition('starting');
    try {
      const port = await runtimeManager.startProject(this.projectId);
      await waitForPort(port);      // Port open hone tak wait karo
      this.transition('running');
    } catch (err) {
      this.transition('error');
    }
  }
}

// ─── Frontend — PreviewPanel.tsx ─────────────────────────
function PreviewPanel({ projectId }) {
  const [state, setState] = useState<PreviewState>('idle');
  const [url, setUrl]     = useState('');

  // SSE se preview.lifecycle events sun
  useEffect(() => {
    realtimeClient.on('preview.lifecycle', ({ state: s, port }) => {
      setState(s);
      if (s === 'running') setUrl(`/preview/${projectId}`);
    });
  }, []);

  if (state === 'idle')     return <div>Project not running</div>;
  if (state === 'starting') return <Spinner text="Starting..." />;
  if (state === 'error')    return <ErrorPanel />;

  return <iframe src={url} className="w-full h-full" />;
}
```

---

## 14. FILE EXPLORER SYSTEM {#14-file-explorer-system}

```typescript
// ─── Tree Service ─────────────────────────────────────────
async function buildTree(rootPath: string): Promise<TreeNode> {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });

  return {
    name:     path.basename(rootPath),
    path:     rootPath,
    type:     'directory',
    children: await Promise.all(
      entries
        .filter(e => !IGNORE_LIST.includes(e.name))  // node_modules, .git
        .map(async entry => {
          if (entry.isDirectory()) return buildTree(path.join(rootPath, entry.name));
          return { name: entry.name, path: path.join(rootPath, entry.name), type: 'file' };
        })
    )
  };
}

// ─── Watcher Service — Real-time ─────────────────────────
class WatcherService {
  start(projectId: string, rootPath: string) {
    const watcher = chokidar.watch(rootPath, {
      ignored:  /(node_modules|\.git)/,
      persistent: true
    });

    watcher.on('add',    path => bus.emit('file.change', { type: 'add',    path, projectId }));
    watcher.on('change', path => bus.emit('file.change', { type: 'change', path, projectId }));
    watcher.on('unlink', path => bus.emit('file.change', { type: 'delete', path, projectId }));
  }
}

// ─── Frontend — FileExplorer.tsx ─────────────────────────
function FileExplorer({ projectId }) {
  const [tree, setTree] = useState<TreeNode | null>(null);

  // Initial tree load
  const { data } = useQuery({
    queryKey: ['/api/file-explorer/tree', projectId],
  });

  // Real-time updates
  useEffect(() => {
    realtimeClient.on('file', ({ type, path }) => {
      setTree(prev => updateTreeNode(prev, type, path)); // Tree update karo
    });
  }, [projectId]);

  return <TreeView node={data} onFileClick={openInEditor} />;
}
```

---

## 15. MEMORY SYSTEM {#15-memory-system}

```typescript
// ─── Agent Memory — Project-specific ─────────────────────
// Files: .nura/ directory mein store hota hai

class MemoryManager {
  private basePath: string; // .nura/${projectId}/

  async saveArchitecture(content: string) {
    await fs.writeFile(`${this.basePath}/architecture.md`, content);
  }

  async saveDecision(decision: Decision) {
    const existing = await this.loadDecisions();
    existing.push(decision);
    await fs.writeFile(`${this.basePath}/decisions.json`, JSON.stringify(existing));
  }

  async appendRunHistory(run: RunSummary) {
    const line = JSON.stringify(run) + '\n';
    await fs.appendFile(`${this.basePath}/run-history.jsonl`, line);
  }

  async loadAll(): Promise<AgentMemory> {
    return {
      architecture: await this.loadArchitecture(),
      decisions:    await this.loadDecisions(),
      runHistory:   await this.loadRunHistory(),
    };
  }
}

// ─── Verified Memory — Fact vs Claim System ───────────────
// Claims = Speculative (agent ka guess)
// Facts  = Verified (tool output se confirmed)

interface AgentClaim {
  id:         string;
  claim:      string;
  confidence: number;         // 0-1
  status:     'UNVERIFIED' | 'PROMOTED' | 'REJECTED';
}

interface VerifiedFact {
  id:       string;
  fact:     string;
  evidence: Evidence[];       // Tool output se proof
  promotedAt: Date;
}

// Claims → Facts promotion:
// Agent claim karta hai → tool se verify hota hai → fact banta hai
```

---

## 16. COMPLETE SYSTEM CYCLE {#16-complete-system-cycle}

```
╔══════════════════════════════════════════════════════════════════╗
║                  COMPLETE SYSTEM CYCLE                           ║
║              "E-commerce website banao"                          ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  👤 USER                                                         ║
║  "E-commerce website banao with React and Node"                  ║
║       ↓ POST /api/run { projectId, goal }                        ║
║                                                                  ║
║  💬 CHAT PAGE                                                     ║
║  → useAgentRunner → POST /api/run                                ║
║  → SSE subscribe: agent + lifecycle + console + file             ║
║       ↓                                                          ║
║  ⚙️  RUN CONTROLLER                                               ║
║  → runId = uuid()                                                ║
║  → DB: agentRuns.insert({ runId, goal, status: 'running' })      ║
║  → bus.emit('run.lifecycle', { status: 'started' })              ║
║       ↓                                                          ║
║  🧠 ORCHESTRATION ENGINE (11 phases)                             ║
║  observe → analyze → plan → route...                             ║
║       ↓                                                          ║
║  📋 PLANNER AGENT                                                 ║
║  Phase 1: "Setup React + Express project"                        ║
║  Phase 2: "Create product listing UI"                            ║
║  Phase 3: "Add cart functionality"                               ║
║  Phase 4: "Setup database + API"                                 ║
║  Phase 5: "Add auth + checkout"                                  ║
║       ↓                                                          ║
║  🔁 TOOL-LOOP AGENT (Phase 1 shuru)                              ║
║  LLM: "I'll create package.json first"                           ║
║  → write_file("package.json", {...})  ← TOOL EXECUTE             ║
║  → bus.emit('file.change') → FILE EXPLORER updates ←            ║
║  LLM: "Now I'll create src/App.tsx"                              ║
║  → write_file("src/App.tsx", "...")   ← TOOL EXECUTE             ║
║  LLM: "Install dependencies"                                     ║
║  → shell_execute("npm install")       ← TOOL EXECUTE             ║
║  → stdout captured → CONSOLE live stream ←                      ║
║       ↓ Phase 1 complete                                         ║
║  🔁 TOOL-LOOP AGENT (Phase 2, 3, 4, 5...)                        ║
║  [Same cycle repeats for each phase]                             ║
║       ↓ All phases complete                                      ║
║  🚀 RUNTIME START                                                 ║
║  → runtimeManager.start("npm run dev")                           ║
║  → port 3001 detect → PREVIEW STATE: "running"                   ║
║  → frontend iframe load ←                                        ║
║       ↓                                                          ║
║  ✅ VERIFICATION ENGINE                                           ║
║  STATIC:    tsc --noEmit           PASS ✅                       ║
║  BUILD:     npm run build          PASS ✅                       ║
║  RUNTIME:   GET localhost:3001     PASS ✅                       ║
║  PREVIEW:   DOM stable, no errors  PASS ✅                       ║
║  RECONCILE: Final state check      PASS ✅                       ║
║       ↓                                                          ║
║  💾 CHECKPOINT SAVE                                              ║
║  → zip snapshot → DB store                                       ║
║  → bus.emit('run.lifecycle', { status: 'completed' })            ║
║  → SSE → Frontend shows "✅ Done!"                               ║
║                                                                  ║
║  [If any FAIL → Reflection → Self-heal → Loop again]            ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## 17. FOLDER STRUCTURE {#17-folder-structure}

```
project-root/
├── main.ts                           ← Express server entry
├── vite.config.ts                    ← Vite config
├── .replit                           ← Replit config (MUST HAVE)
├── drizzle.config.ts                 ← DB config
│
├── shared/
│   └── schema.ts                     ← Database schema
│
├── client/                           ← Frontend (React)
│   ├── index.html
│   └── src/
│       ├── App.tsx                   ← Routes
│       ├── main.tsx
│       ├── pages/
│       ├── features/
│       │   ├── chat/
│       │   ├── file-explorer/
│       │   ├── console/
│       │   └── preview/
│       ├── hooks/
│       └── lib/
│
└── server/                           ← Backend (Node.js)
    ├── api/                          ← Express routes
    ├── agents/                       ← 7 agents
    │   ├── core/tool-loop/
    │   ├── planning/
    │   ├── browser/
    │   ├── recovery/
    │   └── memory/
    ├── orchestration/                ← Engine + router
    │   └── core/orchestration-engine.ts
    ├── tools/                        ← 49 tools, 15 categories
    │   ├── registry/
    │   └── categories/
    ├── infrastructure/
    │   ├── events/bus.ts             ← Event bus
    │   ├── events/sse/               ← SSE manager
    │   └── runtime/                  ← Process manager
    ├── fail-closed/                  ← Verification pipeline
    ├── preview/                      ← Preview lifecycle
    ├── file-explorer/                ← File tree + watcher
    ├── console/                      ← Log capture + stream
    ├── chat/                         ← Chat orchestrator
    └── memory/                       ← Verified memory system
```

---

## 18. TECH STACK CHECKLIST {#18-tech-stack-checklist}

### Backend
- [ ] `express` — HTTP server
- [ ] `tsx` — TypeScript runner
- [ ] `drizzle-orm` + `pg` — Database ORM
- [ ] `ws` — WebSocket (terminal)
- [ ] `chokidar` — File watcher
- [ ] `openai` — LLM client (OpenRouter compatible)
- [ ] `zod` — Schema validation
- [ ] `uuid` — ID generation
- [ ] `playwright` — Browser automation
- [ ] `archiver` — Checkpoint zip

### Frontend
- [ ] `react` + `react-dom` — UI framework
- [ ] `vite` — Dev server + build
- [ ] `wouter` — Client-side routing
- [ ] `@tanstack/react-query` — Data fetching
- [ ] `@monaco-editor/react` — Code editor
- [ ] `tailwindcss` — Styling
- [ ] `lucide-react` — Icons

### Replit Integrations
- [ ] `javascript_openrouter_ai_integrations:2.0.0` — OpenRouter AI
- [ ] PostgreSQL Database — Replit auto-provide

---

## 19. BUILD ORDER — STEP BY STEP {#19-build-order}

```
STEP 1: Foundation (Day 1-2)
─────────────────────────────
□ .replit file setup
□ package.json + dependencies
□ shared/schema.ts (database tables)
□ main.ts (Express server skeleton)
□ vite.config.ts
□ npm run db:push

STEP 2: Event Bus + SSE (Day 2-3)
──────────────────────────────────
□ server/infrastructure/events/bus.ts
□ server/infrastructure/events/sse/sse-manager.ts
□ Wire bus events to SSE

STEP 3: Tool Registry (Day 3-4)
────────────────────────────────
□ server/tools/registry/tool-registry.ts
□ 5-10 basic tools (write_file, read_file, shell_execute)
□ server/api/tools.routes.ts

STEP 4: Basic Tool-Loop Agent (Day 4-6)
─────────────────────────────────────────
□ LLM client (OpenRouter)
□ server/agents/core/tool-loop/tool-loop.agent.ts
□ server/api/run.routes.ts
□ POST /api/run working

STEP 5: Frontend Basics (Day 6-8)
──────────────────────────────────
□ client/src/App.tsx (routing)
□ Dashboard page (project list)
□ Chat page (input + messages)
□ useRealtime hook (SSE)
□ useAgentRunner hook

STEP 6: Console + File Explorer (Day 8-10)
───────────────────────────────────────────
□ server/console/ pipeline
□ server/file-explorer/ + watcher
□ Frontend ConsoleView
□ Frontend FileTree

STEP 7: Preview System (Day 10-11)
────────────────────────────────────
□ server/infrastructure/runtime/runtime-manager.ts
□ server/preview/lifecycle/
□ Frontend PreviewPanel (iframe)

STEP 8: Planner + Orchestration (Day 11-14)
─────────────────────────────────────────────
□ server/agents/planning/planner.agent.ts
□ server/orchestration/core/orchestration-engine.ts
□ server/orchestration/execution/execution-router.ts

STEP 9: Verification + Self-Healing (Day 14-16)
─────────────────────────────────────────────────
□ server/fail-closed/ (5-stage pipeline)
□ Reflection engine
□ Self-healing loop

STEP 10: Checkpoints + Recovery (Day 16-18)
─────────────────────────────────────────────
□ Checkpoint save/restore
□ Crash responder
□ Recovery manager

STEP 11: Polish + Deploy (Day 18-20)
──────────────────────────────────────
□ Error handling improvements
□ Security scanning
□ Production build test
□ Replit deploy
```

---

## ⚡ QUICK REFERENCE — Key Patterns

| Pattern | Use Case | File |
|---------|----------|------|
| Singleton Event Bus | Global pub/sub | `bus.ts` |
| Scoped SSE | Per-project events | `sse-manager.ts` |
| Tool Registry | Central tool store | `tool-registry.ts` |
| Phase-Gate Pipeline | Orchestration | `orchestration-engine.ts` |
| Fact-Claim Promotion | Memory reliability | `memory/contracts/` |
| Fail-Closed Verification | Quality assurance | `fail-closed/` |
| State Machine | Preview lifecycle | `preview-lifecycle.ts` |
| Lock-Guarded Recovery | Crash handling | `recovery-manager.ts` |

---

*Blueprint by: NURA-X Deep Scan | Total Patterns: 8 | Total Components: 15 | Agents: 7*
*Follow this blueprint + same tech stack → Same system build ho jayega.*
