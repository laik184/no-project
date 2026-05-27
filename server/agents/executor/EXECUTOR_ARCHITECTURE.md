# Executor Agent — Deep Architecture Map

**Location:** `server/agents/executor/`  
**Total Files:** 93 TypeScript files  
**Purpose:** Autonomous code execution agent — receives a planned task list from the Planner Agent, then writes files, runs commands, and iterates until each task is done.

---

## Execution Flow (Request to Result)

```
Supervisor
  └─► executor-agent.ts          (public API — validate input, create session)
        └─► core/executor-engine.ts     (main loop — dequeue tasks, call executeTask)
              └─► execution/task-executor.ts   (per-task strategy: LLM loop OR static steps)
                    ├─► llm/tool-loop.ts         [LLM path — if OPENROUTER_API_KEY set]
                    │     ├─► llm/tool-dispatcher.ts  → filesystem + runtime tools
                    │     └─► llm/prompt-builder.ts   → system + task prompts
                    └─► execution/step-runner.ts  [Static path — deterministic fallback]
                          ├─► filesystem/file-writer.ts / patch-file.ts / etc.
                          └─► runtime/shell-executor.ts / npm-manager.ts
```

---

## Folder-by-Folder Breakdown

---

### 📁 Root

| File | Kya Karta Hai |
|------|---------------|
| `executor-agent.ts` | **Public API** — Supervisor yahan se call karta hai. Input validate karta hai (Zod), session create karta hai, `runExecutorEngine()` call karta hai, result return karta hai. `initializeExecutor()` aur `shutdownExecutor()` lifecycle methods bhi yahan hain. |

---

### 📁 `core/` — Engine Core

| File | Kya Karta Hai |
|------|---------------|
| `executor-engine.ts` | **Main execution loop.** `ExecutionQueue` se tasks dequeue karta hai, `executeTask()` call karta hai, overall timeout manage karta hai (default 120s), events emit karta hai, final result build karta hai. |
| `execution-context.ts` | **Run ke liye ek bundle.** Workspace init karta hai, `ExecutionState` + `ExecutionQueue` + `IsolatedContext` + `runtimeMonitor` — sab ek jagah banata hai. Run ke baad `releaseExecutionContext()` se cleanup. |
| `execution-session.ts` | **Session lifecycle tracker.** Har run ke liye `ExecutorSession` object banata hai (sessionId, status: idle→running→completed/failed, tasksDone count). In-memory Map mein store. |
| `execution-state.ts` | **Real-time run state.** `currentTaskId`, `tasksDone`, `tasksFailed`, `status` track karta hai. `executionState.init()` → `setCurrentTask()` → `recordTaskDone()` → `setStatus()` flow follow karta hai. |

---

### 📁 `execution/` — Task & Step Execution

| File | Kya Karta Hai |
|------|---------------|
| `task-executor.ts` | **Dual-mode task runner.** Agar LLM key available hai aur task category eligible hai → `runToolLoop()` call karta hai (LLM path). Warna → `interpretTask()` + `runStep()` (static path). Failure memory mein record karta hai. |
| `step-runner.ts` | **Static step dispatcher.** 19 step types handle karta hai: `write_file`, `read_file`, `patch_file`, `edit_file`, `delete_file`, `list_directory`, `search_files`, `run_command`, `npm_install`, `npm_run`, `run_tests`, `checkpoint`, aur saare `generate_*` types. |
| `execution-queue.ts` | **Priority queue.** Tasks ko priority (critical > high > normal > low) ke hisaab se sort karta hai, FIFO same priority mein. `enqueue()`, `dequeue()`, `peek()`, `isEmpty()` methods. |
| `execution-history.ts` | **Step audit log.** Har step ka result (success/fail, duration, output, error) per-run in-memory store karta hai. Max 500 entries per run. `countFailures()` / `countSuccesses()` expose karta hai. |

---

### 📁 `llm/` — LLM Tool-Calling Loop *(New)*

| File | Kya Karta Hai |
|------|---------------|
| `tool-loop.ts` | **Main autonomous loop.** Max 30 iterations mein LLM ko tools call karne deta hai. Repeated-call detection hai. `task_complete` tool se stop hota hai. Failure memory se errors inject karta hai prompt mein. |
| `llm-client.ts` | **Shared OpenAI client.** `OPENROUTER_API_KEY` ya `AI_INTEGRATIONS_OPENROUTER_API_KEY` use karta hai. Model `LLM_MODEL` env var se (default: `openai/gpt-4o-mini`). Singleton pattern. |
| `prompt-builder.ts` | **Prompt factory.** System prompt likhta hai (sandbox rules, tool usage guidelines). Task message mein — task title/description, project files list, relevant code snippets, previous failures inject karta hai. |
| `response-parser.ts` | **LLM response parser.** OpenAI `choice` object se tool calls extract karta hai, args JSON parse karta hai, unknown tool names skip karta hai. `buildAssistantMessage()` + `buildToolResultMessage()` bhi yahan. |
| `completion-detector.ts` | **Loop exit logic.** 5 stop reasons check karta hai: `task_complete` tool call, `max_iterations`, `repeated_tool_call` (same args 2+ times recently), `no_tool_calls`, `llm_stop`. |
| `tool-observation.ts` | **Tool result recorder.** Har tool call ka observation (tool name, args, status, summary, duration) per-run store karta hai. LLM ko recent failures dikhata hai. |
| `tool-context.ts` | **Project context builder.** File list leta hai, keywords se relevant files score karta hai, top 4 files ke snippets (600 chars) fetch karta hai — sab LLM prompt ke liye. |
| `tool-dispatcher.ts` | **Tool router.** 10 tools ke liye concrete implementations call karta hai: `write_file` → `fileWriter`, `edit_file` → `patchFile`, `run_command` → `shellExecutor`, etc. Validation pehle, execution baad mein. |

---

### 📁 `tools/` — Tool Contracts *(New)*

| File | Kya Karta Hai |
|------|---------------|
| `tool-schema.ts` | **OpenAI function schemas.** 10 tools ke liye `ChatCompletionTool[]` array define karta hai: `write_file`, `read_file`, `edit_file`, `delete_file`, `list_directory`, `search_files`, `run_command`, `npm_install`, `run_tests`, `task_complete`. |
| `tool-contracts.ts` | **TypeScript input types.** Har tool ke liye interface: `WriteFileInput`, `EditFileInput`, `RunCommandInput`, etc. `tool-dispatcher.ts` mein type-safe casting ke liye use hota hai. |
| `tool-result.ts` | **Result envelope.** `{ status: 'ok'|'error', output, error?, filePath?, meta? }` — har tool yahi return karta hai. `ok()`, `err()`, `summarise()` helper functions. |
| `tool-validator.ts` | **Input validation.** Dispatcher se pehle chalata hai — path traversal check, required fields check, type checks. Fail-closed: koi bhi invalid input immediately reject. |
| `tool-registry.ts` | **Tool metadata store.** Har tool ke liye `{ category, mutates, idempotent }` metadata. `isValidToolName()`, `listMutatingTools()` expose karta hai. |

---

### 📁 `filesystem/` — File System Operations

| File | Kya Karta Hai |
|------|---------------|
| `file-writer.ts` | **Sandbox file writer.** Path + content validate karta hai, `permissionManager.assertWrite()` se permission check, parent directories auto-create, UTF-8 mein likhta hai. `writeIfAbsent()` bhi available. |
| `file-reader.ts` | **Sandbox file reader.** Path validate karke UTF-8 read karta hai. `readLines()` (slice support), `exists()`, `getSize()` helpers. |
| `file-editor.ts` | **Line-level editor** (legacy). `append()`, `replaceAll()` (regex), `replaceLine()` (1-indexed), `insertAt()`. *Note: `edit_file` step ab `patch-file.ts` use karta hai, yeh legacy hai.* |
| `patch-file.ts` | **Surgical edit engine** *(New)*. `old_string` exact match dhundhta hai → `new_string` se replace. Agar string nahi mila → clear error with hint. `patchFile()` (first occurrence) + `patchFileAll()` (all occurrences). |
| `replacement-validator.ts` | **Patch validator** *(New)*. old_string non-empty hai, 50KB se chhota hai; new_string string hai, 100KB se chhota hai; dono same nahi. Pehle `validateFilePath()` bhi. |
| `diff-engine.ts` | **Text diff utility** *(New)*. `lineDiff()` — before/after compare, ±2 lines context dikhata hai. `formatDiff()` string mein, `diffStats()` added/removed count. |
| `file-search.ts` | **Search engine.** `listDir()` — recursive ya flat file listing. `findByExtension()` — extension se filter. `grep()` — literal string search across all files with line numbers. |
| `directory-reader.ts` | **Directory lister** *(New)*. `readDirectory()` — entries ke saath type (`file`/`directory`) aur size bytes. `node_modules`, `.git`, `dist`, `build`, `.cache` skip karta hai. `formatListing()` string output. |
| `grep-search.ts` | **Advanced search** *(New)*. `grepLiteral()` — plain text search. `grepRegex()` — regex search (falls back to literal on invalid pattern). `formatGrepResult()` — `file:line: content` format. |
| `safe-delete.ts` | **Safe file deletion** *(New)*. `package.json`, `tsconfig.json`, `.gitignore` jaise protected files block karta hai. Directories block. `pathManager` se boundary check. |
| `path-manager.ts` | **Path resolver.** `resolve()` — traversal check karke sandbox root se absolute path. `relative()`, `isSafe()`, `src()`, `server()` convenience methods. |

---

### 📁 `memory/` — Per-Run Memory *(New)*

| File | Kya Karta Hai |
|------|---------------|
| `failure-memory.ts` | **Error pattern tracker.** Run ke andar kahan kahan fail hua record karta hai. `getRecent(runId, n)` se LLM prompt mein inject hota hai taaki same mistake na ho. Max 20 entries per run. |
| `execution-memory.ts` | **Task completion log.** Har completed/failed/skipped task ka status, artifacts, summary, duration store. `toSummary()` string form mein. |
| `tool-memory.ts` | **Tool call history.** Duplicate call detect karta hai (`isDuplicate()`). Successful vs failed calls count. Per-run store. |
| `runtime-memory.ts` | **Runtime event log.** Process crashes, port up/down, health signals track karta hai. `getCrashes()`, `hasCrash()`, `toSummary()`. Max 50 events per run. |

---

### 📁 `context/` — Project Context Builders *(New)*

| File | Kya Karta Hai |
|------|---------------|
| `file-context.ts` | **Relevant file finder.** Keywords se files score karta hai, top matches ke content snippets (600 chars) return karta hai. `node_modules`, `.git`, `dist` skip. |
| `project-context.ts` | **Project summary builder.** `package.json` read karke name, description, tech stack detect karta hai. `hasFrontend`, `hasBackend`, `hasDatabase` booleans. Entry point files list. |
| `architecture-context.ts` | **Pattern detector.** Architecture pattern (monorepo/fullstack-single/frontend-only/backend-only), CSS framework (Tailwind/CSS-modules), test framework (Vitest/Jest), routing lib (wouter/react-router), state lib (TanStack Query/Zustand/Redux) detect karta hai. |
| `dependency-context.ts` | **Package.json reader.** `dependencies` + `devDependencies` extract karta hai. `hasPackage(name)` helper. `formatDependencies()` short form for prompts. |

---

### 📁 `browser/` — Browser Feedback Integration *(New)*

| File | Kya Karta Hai |
|------|---------------|
| `browser-context.ts` | **Browser snapshot store.** Browser Agent ke snapshots (URL, console errors, network errors, screenshot path) per-run store karta hai. `hasErrors()`, `getErrors()` expose. |
| `console-analysis.ts` | **Console error analyzer.** Raw browser logs mein se errors/warnings/uncaught extract karta hai. Pattern matching se actionable suggestions: "missing npm package", "undefined variable", "auth error", etc. |
| `screenshot-analysis.ts` | **Screenshot checker.** File size heuristic use karta hai — agar PNG 5KB se chhoti hai toh blank page likely hai. Future mein vision model se replace hoga. |
| `browser-feedback.ts` | **Aggregator.** Console analysis + screenshot analysis combine karke `BrowserFeedback` object banata hai. `formatBrowserFeedback()` string LLM mein inject ho sakta hai. |

---

### 📁 `planning/` — Task Planning & Strategy

| File | Kya Karta Hai |
|------|---------------|
| `task-interpreter.ts` | **Static step builder.** `PlanTask` receive karke `ExecutionStep[]` return karta hai (static path ke liye). Category se primary step type decide karta hai, npm_install step add karta hai setup ke liye, validate + checkpoint steps har task mein. |
| `execution-strategy.ts` | **Task strategy decider.** `determineStrategy()` — task category se `executionMode` (sequential/parallel), `fileStrategy` (create/edit), `codeStrategy` (template/generated), `requiresNpm`, `requiresShell` decide karta hai. |
| `action-selector.ts` | **Action type mapper.** `PlanTask` → `PlannedAction` (type: generate_code/write_files/run_npm/run_shell/validate). Strategy ke basis pe decide. Batch processing ke liye `actionsForTasks()`. |
| `tool-selection.ts` | **Tool-to-step mapping.** Har `StepType` ke liye kaun sa tool (file_writer/file_editor/shell_executor/npm_manager/validator) use hoga — `ToolSelection` object mein primary + fallback. |

---

### 📁 `recovery/` — Error Recovery

| File | Kya Karta Hai |
|------|---------------|
| `checkpoint-manager.ts` | **File snapshot system.** Har task complete hone pe sandbox files ka JSON snapshot banata hai. **In-memory + disk** dono mein save karta hai (`.sandbox/.checkpoints/`). `load()` se disk se restore, `pruneOlderThan()` se cleanup. |
| `rollback-manager.ts` | **File restorer.** Checkpoint se puri sandbox ya single file restore karta hai. `rollbackToCheckpoint()` → sara snapshot re-write. `rollbackFile()` → sirf ek file. |
| `retry-handler.ts` | **Retry wrapper.** `retryManager` ke upar thin wrapper. Default max 3 attempts, 500ms base delay, exponential backoff with jitter. Har retry pe `executorMetrics.recordRetry()` call. |
| `failure-recovery.ts` | **Error classifier.** Error message se category detect (`transient`/`file_system`/`command_error`/`validation`/`timeout`/`fatal`), phir recovery action suggest (`retry`/`skip`/`rollback`/`abort`). Fatal aur validation pe abort/skip, baaki retry. |

---

### 📁 `runtime/` — Process & Command Execution

| File | Kya Karta Hai |
|------|---------------|
| `shell-executor.ts` | **Core shell runner.** `spawn()` use karta hai (shell: false). `execute(command, cwd, timeoutMs)` — raw execution. `executeInSandbox(runId, projectId, command)` — workspace root mein. SIGTERM on timeout. |
| `npm-manager.ts` | **npm wrapper.** `install()` — packages allow/block check, `npm install [packages]` run. `runScript()` — `npm run <script>`. `writePackageJson()` — boilerplate package.json likhta hai. |
| `command-validator.ts` | **Command allowlist enforcer.** `validateCommand()` → `ValidatedCommand { executable, args, raw }`. Allowlist mein check karta hai, allowed subcommands bhi verify. `isNpmInstall()`, `isNpmRun()` helpers. |
| `runtime-monitor.ts` | **Health tracker.** Har step ke success/fail pe failure rate calculate karta hai. Rate 50% se upar → `healthy = false`. `isHealthy()` — `task-executor.ts` yeh check karke loop rok leta hai. |
| `process-manager.ts` | **Process registry.** Long-running processes (pid, command, status) track karta hai. `register()`, `markStopped()`, `markCrashed()`. `listRunning()` — active processes. |
| `stream-buffer.ts` | **Output buffer** *(New)*. Chunked streaming output accumulate karta hai. Hard cap 10MB. `tail(n)` — last N chars for LLM context. `onChunk` callback real-time mein chunks bhejta hai. |
| `process-stream.ts` | **Streaming process runner** *(New)*. `spawn()` ke stdout/stderr pe real-time callbacks. `StreamResult` mein full output + `truncated` flag. `StreamOptions` mein `onStdout`/`onStderr`. |
| `output-streamer.ts` | **SSE bridge** *(New)*. `executeWithStreaming()` — command chalata hai, har output line ko `execution.step.started` event ke roop mein bus pe emit karta hai. Frontend terminal mein real-time dikhta hai. |

---

### 📁 `sandbox/` — Sandbox Security

| File | Kya Karta Hai |
|------|---------------|
| `workspace-manager.ts` | **Sandbox root manager.** `init()` — project directory ensure. `getRoot()` — absolute root path. `resolvePath()` — relative to absolute. `isSafe()` — boundary check. `exists()` — file existence. |
| `isolation-manager.ts` | **Context registry.** Har run ke liye `IsolatedContext { contextId, projectId, runId, sandboxRoot }` banata hai. `validateAccess()` — path is sandbox mein hai ya nahi check. `release()` — cleanup. |
| `sandbox-validator.ts` | **Path boundary checker.** `validateSandboxPath()` — traversal detect, absolute path check, sandbox root ke andar hai ya nahi. `isSafeWorkspacePath()` — system dirs (`/etc`, `/proc`, etc.) block. |
| `permission-manager.ts` | **Write/execute gatekeeper.** `package.json`, `.env`, `node_modules/`, `.git/` mein write deny. Execute only `npm`, `npx`, `pnpm`, `node`, `tsc`, `tsx`. `assertWrite()` / `assertExecute()` throw on deny. |

---

### 📁 `validation/` — Input & Output Validation

| File | Kya Karta Hai |
|------|---------------|
| `command-safety.ts` | **Shell command security.** `rm -rf`, `sudo`, `shutdown`, `curl | bash` jaise patterns block. 35+ allowed executables allowlist (npm, vite, drizzle-kit, vitest, eslint, etc.). |
| `file-integrity.ts` | **Path & content validator.** `validateFilePath()` — traversal, null byte, absolute path, length, system dirs check. `validateFileContent()` — string type + 1MB limit. `checkSandboxBoundary()`. |
| `output-validator.ts` | **Generator output checker.** `validateGeneratedCode()` — content non-empty hai ya nahi. `validateCommandOutput()` — exit code 0 hai ya nahi, stderr check. |
| `execution-validator.ts` | **Result struct validator.** `validateStepResult()` — stepId, boolean success, non-negative duration. `validateTaskResult()` — taskId, stepsRun >= 0. Warn if success with 0 steps. |
| `typescript-validator.ts` | **TypeScript type checker** *(New)*. `npx tsc --noEmit --pretty false` run karta hai. `tsconfig.json` nahi mila toh skip. Errors `error TS\d+` pattern se extract. |
| `syntax-validator.ts` | **Syntax checker** *(New)*. JSON ke liye `JSON.parse()`. JS/TS ke liye brace/paren/bracket balance count (string literals skip). Mismatch mila toh error. |
| `import-validator.ts` | **Import resolver** *(New)*. Relative imports (`from './...'`) extract karta hai, disk pe exist check karta hai (multiple extensions try). `missingImports[]` list return. |
| `runtime-validator.ts` | **Runtime sanity checker** *(New)*. Empty files, TODO markers, "not implemented" stubs, only-imports files, `process.exit()` calls detect karta hai. |
| `package-validator.ts` | **Package.json validator** *(New)*. `name`, `version` fields, `build`/`dev` scripts check. `extractPackageNames()` — code mein se import kiye packages list. `isPackageInstalled()` — package.json mein hai ya nahi. |

---

### 📁 `coding/` — Static Code Generators (Template Engine)

| File | Kya Karta Hai |
|------|---------------|
| `frontend-generator.ts` | `generatePage()`, `generateComponent()`, `generateLayout()`, `generateHook()` — React/TypeScript boilerplate. Templates se content generate. |
| `backend-generator.ts` | `generateRoute()` (Express route file), `generateController()`, `generateService()`, `generateMiddleware()` — backend boilerplate. |
| `api-generator.ts` | `generateCrudEndpoints()` — ek resource ke liye GET/POST/PUT/DELETE handler files. |
| `auth-generator.ts` | `generateAuthSystem()` — authentication system files (middleware, routes, types). |
| `database-generator.ts` | `generateSchema()` — Drizzle ORM schema file for a named entity. |
| `component-generator.ts` | `generateReactComponent()` — simple functional component with props. |

---

### 📁 `templates/` — Code Templates

| File | Kya Karta Hai |
|------|---------------|
| `react-template.ts` | React page, layout, hook template strings. Generators yahan se import karte hain. |
| `express-template.ts` | Express route + middleware template strings. |
| `api-template.ts` | REST API handler template. |
| `auth-template.ts` | Auth middleware + JWT template. |
| `crud-template.ts` | Full CRUD controller template. |

---

### 📁 `types/` — TypeScript Contracts

| File | Kya Karta Hai |
|------|---------------|
| `executor.types.ts` | Top-level types: `ExecutorInput` (runId, projectId, goal, plan), `ExecutorResult`, `TaskExecutionResult`, `ExecutorSession`, `ExecutorStatus`. |
| `execution.types.ts` | Step-level types: `StepType` (19 types), `StepInput` (filePath, fileContent, **oldString, newString**, command, query), `ExecutionStep`, `StepResult`, `CheckpointData` (with diskPath), `ExecutionHistoryEntry`. |

---

### 📁 `events/` — Event System

| File | Kya Karta Hai |
|------|---------------|
| `event-types.ts` | 5 event names + payload interfaces: `execution.started`, `execution.step.started`, `execution.step.completed`, `execution.failed`, `execution.completed`. `ExecutorEventMap` typed union. |
| `executor-events.ts` | `TypedExecutorEmitter` — typed EventEmitter. `executorBus` singleton. Helper functions: `emitExecutionStarted()`, `emitStepStarted()`, `emitStepCompleted()`, `emitExecutionFailed()`, `emitExecutionCompleted()`. |
| `event-handlers.ts` | Bus listeners: `execution.started` → metrics start. `execution.step.completed` → failure metric on fail. `execution.completed` → metrics complete. `registerExecutorEventHandlers()` / `unregisterExecutorEventHandlers()`. |

---

### 📁 `telemetry/` — Logging & Metrics

| File | Kya Karta Hai |
|------|---------------|
| `executor-logger.ts` | `runLogger` ke upar wrapper. Har message mein `[executor]` prefix. `info()`, `warn()`, `error()`, `debug()`. `getLogs(runId)` — executor-only entries filter. |
| `executor-metrics.ts` | `metricsCollector` ke upar wrapper. Counters: `executions.started/completed/failed`, `retry.count`, `validation.failures`. Timings: `execution.duration`. |

---

### 📁 `utils/` — Shared Utilities

| File | Kya Karta Hai |
|------|---------------|
| `execution-helpers.ts` | ID generators (`generateExecutionId`, `generateStepId`, `generateCheckpointId`, `generateSessionId`). `elapsedMs()`. `stepTimeout()` — har step type ke liye timeout (3s–90s). `categoryToStepType()` mapping. |
| `code-utils.ts` | Code generation helpers. `toCamelCase()`, `toPascalCase()`, `toKebabCase()`. `fileHeader()`, `indentBlock()`, `wrapInTryCatch()`. Generators yahan se import karte hain. |
| `filesystem-utils.ts` | Path utilities: `hasTraversal()` — `..` detect. `normalizePath()` — backslash → forward slash. `joinSandboxPath()`, `safeRelativePath()`, `parentDir()`. |
| `validators.ts` | Zod schema for `ExecutorInput`. `validateExecutorInput()` (throws). `safeValidateExecutorInput()` (returns `ok/error`). `isNonEmptyString()`, `isValidFilePath()`, `isValidCommandString()`. |

---

## Dependency Architecture

```
executor-agent.ts
│
├── core/executor-engine.ts
│   ├── core/execution-context.ts   → sandbox/ + execution/execution-queue.ts
│   ├── core/execution-state.ts
│   ├── execution/task-executor.ts
│   │   ├── [LLM PATH] llm/tool-loop.ts
│   │   │   ├── llm/llm-client.ts       (OpenRouter)
│   │   │   ├── llm/tool-dispatcher.ts  → filesystem/ + runtime/
│   │   │   ├── llm/prompt-builder.ts   → llm/tool-context.ts → filesystem/
│   │   │   ├── llm/response-parser.ts
│   │   │   ├── llm/completion-detector.ts
│   │   │   ├── llm/tool-observation.ts
│   │   │   └── memory/failure-memory.ts
│   │   └── [STATIC PATH] execution/step-runner.ts
│   │       ├── filesystem/{file-writer, file-reader, patch-file, safe-delete, ...}
│   │       ├── runtime/{shell-executor, npm-manager}
│   │       ├── coding/{frontend, backend, api, auth, database, component}-generator.ts
│   │       └── recovery/checkpoint-manager.ts
│   └── events/executor-events.ts
│
├── events/event-handlers.ts        (telemetry wiring)
├── recovery/{retry-handler, failure-recovery, rollback-manager}
├── sandbox/{workspace-manager, isolation-manager, permission-manager}
├── telemetry/{executor-logger, executor-metrics}
└── validation/{command-safety, file-integrity, ...}
```

---

## Key Design Rules

1. **Fail-Closed** — har validator, permission check, path resolver → agar doubt hai toh throw/deny
2. **Dual-Mode Execution** — LLM key hai → autonomous loop; key nahi → deterministic templates
3. **No Silent Failures** — har error log hota hai + failure-memory mein record
4. **Single Responsibility** — har file ek kaam, ek concept
5. **Telemetry on Everything** — `executorLogger` + `executorBus` events har significant operation pe
6. **Sandbox Boundary** — koi bhi file operation `pathManager.resolve()` se guzarta hai

---

*Last updated: 2026-05-27 — Post LLM Tool Loop refactor (10 architectural gaps closed)*
