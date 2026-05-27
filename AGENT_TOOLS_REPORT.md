# Nura-X Agent Tools Report
**Generated:** 2026-05-27  
**Total Agents:** 8  
**Total Tools / Functions:** 87

---

## Summary Table

| Agent | Tools Count | Primary Role |
|---|---|---|
| CoderX | 4 | LLM tool-loop + code generation |
| Filesystem | 36 | File & folder I/O |
| Terminal | 28 | Shell, npm, ports, processes |
| Browser | 19 | UI validation & automation |
| Executor | 18 | Plan task execution (step types) |
| Verifier | 6 | Build, test, typecheck, health |
| Planner | 1 | Goal decomposition |
| Supervisor | 1 | Orchestration controller |
| **TOTAL** | **113** | |

---

## 1. CoderX Agent — LLM Tool Loop
**Location:** `server/agents/coderx/`  
**Role:** Core code generation engine using ReAct-style LLM loop.

| # | Tool Name | Parameters | Returns | Description |
|---|---|---|---|---|
| 1 | `write_file` | `path` (str), `content` (str) | `DispatchResult` | Nayi file likhta hai, directory bhi banata hai |
| 2 | `read_file` | `path` (str) | `DispatchResult` (content) | File ka content padhta hai |
| 3 | `edit_file` | `path` (str), `old_content` (str), `new_content` (str) | `DispatchResult` | File ka specific hissa replace karta hai |
| 4 | `generate_api` | `resource` (str), `fields` (str, comma-sep) | `DispatchResult` | Express CRUD API generate karta hai |

**Supporting Functions:**
- `registerTool(meta)` — Naya tool register karo
- `getTool(name)` — Tool ka metadata lo
- `getAllTools()` — Sare registered tools ki list
- `getToolsByCategory(category)` — Category se tools filter karo
- `runToolLoop(opts)` — Full LLM iteration loop chalaao

---

## 2. Filesystem Agent — File & Folder Operations
**Location:** `server/agents/filesystem/`  
**Role:** Sandboxed file system access with full CRUD + search.

### File Operations (11 tools)

| # | Tool Name | Parameters | Returns | Description |
|---|---|---|---|---|
| 1 | `readFile` | `path`, `projectId` | `string` | File content padhta hai |
| 2 | `readLines` | `path`, `start`, `end` | `string[]` | Specific lines padhta hai |
| 3 | `fileExistsInSandbox` | `path`, `projectId` | `boolean` | File exist karta hai ya nahi check karo |
| 4 | `getFileMetadata` | `path`, `projectId` | `FileMetadata` | Size, mtime, type etc. |
| 5 | `getFileSize` | `path`, `projectId` | `number` | File ka size bytes mein |
| 6 | `writeFile` | `path`, `content`, `overwrite?` | `WriteResult` | File likhta hai |
| 7 | `writeFileIfAbsent` | `path`, `content` | `WriteResult` | Sirf tab likhta hai jab file nahi ho |
| 8 | `ensureFile` | `path`, `content` | `WriteResult` | File create ya update karo |
| 9 | `patchFile` | `path`, `oldStr`, `newStr` | `PatchResult` | First match replace karo |
| 10 | `patchFileAll` | `path`, `oldStr`, `newStr` | `PatchResult` | Sare matches replace karo |
| 11 | `deleteFileFromSandbox` | `path`, `projectId` | `DeleteResult` | File delete karo |
| 12 | `deleteMultipleFiles` | `paths[]`, `projectId` | `DeleteResult[]` | Multiple files delete karo |
| 13 | `cloneFile` | `src`, `dest`, `projectId` | `CloneResult` | File copy karo |
| 14 | `moveFile` | `src`, `dest`, `projectId` | `MoveResult` | File move karo |
| 15 | `renameFile` | `path`, `newName`, `projectId` | `RenameResult` | File rename karo |
| 16 | `appendToFile` | `path`, `content` | `void` | File ke end mein add karo |
| 17 | `replaceLine` | `path`, `lineNo`, `content` | `void` | Specific line replace karo |
| 18 | `insertAt` | `path`, `lineNo`, `content` | `void` | Specific position par insert karo |
| 19 | `replaceAll` | `path`, `search`, `replace` | `number` | Sari occurrences replace karo |

### Folder Operations (10 tools)

| # | Tool Name | Parameters | Returns | Description |
|---|---|---|---|---|
| 20 | `readFolder` | `path`, `projectId` | `FolderEntry[]` | Folder ka contents list karo |
| 21 | `readFolderNames` | `path`, `projectId` | `string[]` | Sirf naam list karo |
| 22 | `readFileEntries` | `path`, `projectId` | `FolderEntry[]` | Sirf files list karo |
| 23 | `readSubfolderEntries` | `path`, `projectId` | `FolderEntry[]` | Sirf subfolders list karo |
| 24 | `createFolder` | `path`, `projectId` | `CreateFolderResult` | Naya folder banao |
| 25 | `createFolders` | `paths[]`, `projectId` | `CreateFolderResult[]` | Multiple folders banao |
| 26 | `deleteFolder` | `path`, `projectId` | `DeleteFolderResult` | Folder delete karo |
| 27 | `cloneFolder` | `src`, `dest`, `projectId` | `CloneFolderResult` | Folder copy karo |
| 28 | `moveFolder` | `src`, `dest`, `projectId` | `MoveFolderResult` | Folder move karo |
| 29 | `renameFolder` | `path`, `newName`, `projectId` | `RenameFolderResult` | Folder rename karo |
| 30 | `scanFolder` | `path`, `glob?`, `recursive?` | `ScanResult` | Glob pattern se files dhundho |
| 31 | `scanFilesByExtension` | `path`, `ext`, `projectId` | `ScanResult` | Extension se files dhundho |
| 32 | `getFolderStructure` | `path`, `depth?` | `TreeNode[]` | Tree structure lo |
| 33 | `renderAsciiTree` | `nodes[]` | `string` | ASCII tree render karo |
| 34 | `getAsciiTree` | `path`, `depth?` | `string` | Path se directly ASCII tree lo |

### Search Operations (7 tools)

| # | Tool Name | Parameters | Returns | Description |
|---|---|---|---|---|
| 35 | `findByName` | `name`, `projectId` | `string[]` | Naam se files dhundho |
| 36 | `findByExtension` | `ext`, `projectId` | `string[]` | Extension se files dhundho |
| 37 | `findByPattern` | `pattern`, `projectId` | `string[]` | Glob pattern se dhundho |
| 38 | `listFilesInDir` | `dir`, `projectId` | `string[]` | Directory ki files list karo |
| 39 | `searchText` | `query`, `path`, `caseSensitive?` | `TextSearchResult[]` | Text ke liye grep karo |
| 40 | `searchRegex` | `pattern`, `path`, `flags?` | `RegexSearchResult[]` | Regex se search karo |
| 41 | `findImports` | `file`, `projectId` | `ImportEntry[]` | File ke imports dhundho |
| 42 | `findExports` | `file`, `projectId` | `ExportEntry[]` | File ke exports dhundho |
| 43 | `findSymbolUsages` | `symbol`, `projectId` | `SymbolUsage[]` | Symbol kahin use ho raha hai |

---

## 3. Terminal Agent — Shell & Process Management
**Location:** `server/agents/terminal/`  
**Role:** Secure command execution, npm, port management, process lifecycle.

### Shell Execution (6 tools)

| # | Tool Name | Parameters | Returns | Description |
|---|---|---|---|---|
| 1 | `shellExecute` | `command`, `cwd`, `timeoutMs?` | `ExecutionResult` | Shell command safely run karo |
| 2 | `runCommand` | `opts (ExecutionOptions)` | `ExecutionResult` | Generic command runner |
| 3 | `spawnProcess` | `command`, `opts` | `{process, pid}` | Long-running background process start karo |
| 4 | `terminateProcess` | `pid` | `void` | Process ko SIGTERM bhejo |
| 5 | `forceKill` | `pid` | `void` | Process ko SIGKILL karo |
| 6 | `registerTimeout` / `cancelTimeout` / `isExpired` | `runId`, `ms` | `void/bool` | Execution timeout manage karo |

### NPM Tools (8 tools)

| # | Tool Name | Parameters | Returns | Description |
|---|---|---|---|---|
| 7 | `npmInstall` | `runId`, `projectId`, `packages[]` | `ExecutionResult` | npm install run karo |
| 8 | `npmCi` | `runId`, `projectId` | `ExecutionResult` | npm ci (clean install) run karo |
| 9 | `npmRunScript` | `runId`, `projectId`, `script`, `timeoutMs?` | `ExecutionResult` | npm run {script} chalaao |
| 10 | `npmTest` | `runId`, `projectId` | `ExecutionResult` | npm test run karo |
| 11 | `npmBuild` | `runId`, `projectId` | `ExecutionResult` | npm run build karo |
| 12 | `writePackageJson` | `projectId`, `pkg` | `void` | package.json likhna |
| 13 | `getLockfileStatus` | `projectId` | `LockfileStatus` | package-lock.json status check karo |
| 14 | `deleteLockfile` | `projectId` | `boolean` | Lock file delete karo |
| 15 | `validatePackageName` | `pkg` | `ValidationResult` | Package naam safe hai? |
| 16 | `validatePackageList` | `packages[]` | `ValidationResult` | Package list validate karo |

### Port Management (6 tools)

| # | Tool Name | Parameters | Returns | Description |
|---|---|---|---|---|
| 17 | `resolvePort` | `runId`, `projectId` | `number` | Run ke liye free port assign karo |
| 18 | `releasePort` | `port` | `void` | Port free karo |
| 19 | `releaseAllForRun` | `runId` | `void` | Run ke sare ports free karo |
| 20 | `getAssignedPort` | `runId` | `number\|null` | Kaunsa port assign hai? |
| 21 | `isPortInUse` | `port`, `host?` | `boolean` | Port use ho raha hai? |
| 22 | `scanPortRange` | `start`, `end` | `number[]` | Range mein kaunse ports open hain |
| 23 | `findFreePort` | `start?` | `number` | Pehla free port dhundho |

### Process Lifecycle (8 tools)

| # | Tool Name | Parameters | Returns | Description |
|---|---|---|---|---|
| 24 | `onProcessStarted` | `runId`, `pid`, `command` | `void` | Process start ka event |
| 25 | `onProcessExited` | `runId`, `pid`, `code` | `void` | Process exit ka event |
| 26 | `cleanupRun` | `runId` | `void` | Run ke sare processes clean karo |
| 27 | `processManager.start` | `runId`, `opts` | `Process` | Process start karo |
| 28 | `processManager.stop` | `runId` | `void` | Process stop karo |
| 29 | `processMonitor.watch` | `pid`, `runId` | `void` | Process ki health monitor karo |
| 30 | `processRegistry.register` | `pid`, `meta` | `void` | Process registry mein daalo |
| 31 | `processHistory.record` | `runId`, `entry` | `void` | Process history save karo |

---

## 4. Browser Agent — UI Automation & Validation
**Location:** `server/agents/browser/`  
**Role:** Playwright-based headless browser, E2E UI testing.

### Navigation (5 tools)

| # | Tool Name | Parameters | Returns | Description |
|---|---|---|---|---|
| 1 | `navigateToUrl` | `page`, `url`, `runId` | `boolean` | URL par navigate karo |
| 2 | `reloadPage` | `page`, `runId` | `boolean` | Page reload karo |
| 3 | `waitForLoad` | `page`, `runId`, `timeoutMs?` | `boolean` | Page load hone ka wait karo |
| 4 | `runUserFlow` | `page`, `flow[]`, `runId` | `FlowResult` | Multi-step user journey run karo |
| 5 | `testViewport` | `page`, `viewport`, `runId` | `ViewportResult` | Specific screen size test karo |
| 6 | `runResponsiveTests` | `page`, `url`, `runId` | `ResponsiveResult[]` | Mobile/Tablet/Desktop test karo |

### Interaction (5 tools)

| # | Tool Name | Parameters | Returns | Description |
|---|---|---|---|---|
| 7 | `clickElement` | `page`, `selector`, `runId` | `boolean` | Element par click karo |
| 8 | `fillInput` | `page`, `selector`, `value`, `runId` | `boolean` | Input field mein type karo |
| 9 | `selectOption` | `page`, `selector`, `value`, `runId` | `boolean` | Dropdown se option choose karo |
| 10 | `waitForElement` | `page`, `selector`, `timeoutMs?` | `ElementHandle` | Element aane ka wait karo |
| 11 | `waitForVisible` | `page`, `selector` | `boolean` | Element visible hone ka wait karo |
| 12 | `isElementPresent` | `page`, `selector` | `boolean` | Element exist karta hai? |
| 13 | `isElementVisible` | `page`, `selector` | `boolean` | Element visible hai? |
| 14 | `countElements` | `page`, `selector` | `number` | Kitne elements match karte hain |
| 15 | `captureUIState` | `page`, `runId` | `UIState` | Puri UI ka state capture karo |

### Validation & Capture (8 tools)

| # | Tool Name | Parameters | Returns | Description |
|---|---|---|---|---|
| 16 | `validateUI` | `page`, `runId`, `opts?` | `UIValidationResult` | UI errors, blank screen check karo |
| 17 | `takeScreenshot` | `page`, `runId`, `label?` | `string` (path) | Screenshot lo |
| 18 | `takeElementScreenshot` | `page`, `selector`, `runId` | `string` (path) | Specific element ka screenshot |
| 19 | `detectCrash` | `page`, `runId` | `CrashReport` | Page crash detect karo |
| 20 | `attachCrashListener` | `page`, `runId` | `void` | Crash listener lagao |
| 21 | `attachConsoleErrorCatcher` | `page`, `runId` | `void` | JS console errors pakdo |
| 22 | `compareScreenshots` | `baseline`, `current` | `DiffResult` | Visual diff check karo |
| 23 | `collectPerformanceTiming` | `page` | `PerformanceTiming` | Page load timings lo |
| 24 | `validatePerformance` | `page`, `thresholds?` | `PerfValidation` | Performance thresholds check karo |

---

## 5. Executor Agent — Plan Task Execution
**Location:** `server/agents/executor/`  
**Role:** Plan tasks ko ek-ek step mein execute karta hai.

### Step Types (Execution Tools)

| # | Step Type | Input Fields | Description |
|---|---|---|---|
| 1 | `generate_frontend` | `name`, `category` (page/layout/hook) | React page, layout ya hook generate karo |
| 2 | `generate_backend` | `name` | Express route generate karo |
| 3 | `generate_api` | `name` | Full CRUD API generate karo |
| 4 | `generate_database` | `name` | Database schema generate karo |
| 5 | `generate_auth` | — | Auth system generate karo |
| 6 | `generate_component` | `name` | React component generate karo |
| 7 | `write_file` | `filePath`, `fileContent` | File directly likhna |
| 8 | `read_file` | `filePath` | File padhna |
| 9 | `edit_file` | `filePath`, `oldString`, `newString` | File mein surgical replace |
| 10 | `patch_file` | `filePath`, `oldString`, `newString` | File patch (same as edit_file) |
| 11 | `delete_file` | `filePath` | File delete karo |
| 12 | `list_directory` | `filePath`, `recursive?` | Directory contents list karo |
| 13 | `search_files` | `query`, `filePath?` | Codebase mein grep karo |
| 14 | `npm_install` | `args?` | npm install run karo |
| 15 | `npm_run` | `command` | npm run {script} chalaao |
| 16 | `run_command` | `command` | Arbitrary shell command |
| 17 | `run_tests` | `command?` | Test suite run karo |
| 18 | `validate_output` | `description?` | Validation checkpoint |
| 19 | `checkpoint` | — | State snapshot save karo |

---

## 6. Verifier Agent — Quality Assurance
**Location:** `server/agents/verifier/`  
**Role:** Execution ke baad code quality validate karna.

| # | Tool Name | Parameters | Returns | Description |
|---|---|---|---|---|
| 1 | `runVerification` | `VerificationInput` | `VerificationResult` | Full verification cycle run karo |
| 2 | `runBuild` | `runId`, `projectId` | `BuildResult` | Project build karo, errors check karo |
| 3 | `runTests` | `runId`, `projectId` | `TestResult` | Test suite execute karo |
| 4 | `runTypecheck` | `runId`, `projectId` | `TypecheckResult` | TypeScript compiler check |
| 5 | `checkServerHealth` | `url`, `runId` | `HealthResult` | Server endpoint ping karo |
| 6 | `failureRecovery.handle` | `runId`, `taskId`, `error`, `count` | `RecoveryDecision` | Failure pe kya karna hai decide karo |

---

## 7. Planner Agent — Goal Decomposition
**Location:** `server/agents/planner/`  
**Role:** User goal ko structured execution plan mein todna.

| # | Tool Name | Parameters | Returns | Description |
|---|---|---|---|---|
| 1 | `createExecutionPlan` | `PlannerInput` (goal, projectId, etc.) | `PlannerResult` | Goal → phases → tasks breakdown |

**Internal Capabilities:**
- **App Classifier** — App ka type identify karo (crud/saas/ai_app/dashboard/ecommerce)
- **Complexity Scorer** — Plan ki complexity estimate karo (low/medium/high)
- **Goal Analyzer** — Natural language goal parse karo
- **Architecture Planners** — Frontend, Backend, Database, API ke alag plans banao
- **Milestone Generator** — Tasks ko logical sequence mein arrange karo
- **Dependency Graph** — Task ke inter-dependencies map karo

---

## 8. Supervisor Agent — Orchestration Controller
**Location:** `server/agents/supervisor/`  
**Role:** Poore agent swarm ka lifecycle manager.

| # | Tool Name | Parameters | Returns | Description |
|---|---|---|---|---|
| 1 | `runSupervisorCycle` | `OrchestrationContext` | `SupervisorRunResult` | Full Analyze→Plan→Execute→Verify cycle |

**Internal Capabilities:**
- **Agent Router** — Task ko sahi agent ke paas bhejo
- **Stuck Task Detector** — Hang/loop detect karo
- **Timeout Guardian** — Time limits enforce karo
- **Retry Controller** — Failed tasks ko retry karo
- **Phase Manager** — Analyze / Plan / Execute / Verify / Browser phases manage karo

---

## Full Tool Count by Category

| Category | Tools |
|---|---|
| File Read/Write/Patch | 19 |
| Folder Management | 15 |
| File/Code Search | 9 |
| Shell & Command Execution | 6 |
| NPM & Package Management | 10 |
| Port Management | 7 |
| Process Lifecycle | 8 |
| Browser Navigation | 6 |
| Browser Interaction | 9 |
| Browser Validation & Capture | 9 |
| Executor Step Types | 19 |
| Verifier QA Tools | 6 |
| LLM Tool Loop | 5 |
| Planner Capabilities | 6 |
| Supervisor Capabilities | 5 |
| **Grand Total** | **149** |

---

## Architecture Flow

```
User Goal
    │
    ▼
┌─────────────────────────────────────────────────┐
│  SUPERVISOR AGENT  (1 tool, 5 internal caps)    │
│  Orchestrates the full run lifecycle            │
└──────────┬───────────────────────────┬──────────┘
           │                           │
           ▼                           ▼
┌──────────────────┐       ┌──────────────────────┐
│  PLANNER AGENT   │       │   VERIFIER AGENT     │
│  1 tool          │       │   6 tools            │
│  Goal → Plan     │       │   Build/Test/Type    │
└────────┬─────────┘       └──────────────────────┘
         │                           ▲
         ▼                           │
┌──────────────────────────────────────────────────┐
│  EXECUTOR AGENT  (19 step types)                 │
│  Runs tasks one by one                           │
└───┬──────────────┬────────────┬─────────────────┘
    │              │            │
    ▼              ▼            ▼
┌────────┐  ┌──────────┐  ┌──────────┐
│ CoderX │  │Filesystem│  │ Terminal │
│ 4+5    │  │ 43 tools │  │ 31 tools │
│ tools  │  │          │  │          │
└────────┘  └──────────┘  └──────────┘
                                │
                                ▼
                        ┌──────────────┐
                        │ BROWSER      │
                        │ AGENT        │
                        │ 24 tools     │
                        └──────────────┘
```

---

*Report generated from deep scan of `server/agents/` — Nura-X Deployer v1.0.0*
