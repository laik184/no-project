# Orchestration Dependency Audit Report

**Generated:** 2026-06-01
**Scope:** `server/orchestration/index.ts` — full import trace + file-explorer dependency check

---

## PHASE 1 — IMPORT TRACE: `server/orchestration/index.ts`

### Exact files that import the public barrel

**File 1:** `main.ts` — line 16
```ts
import { initOrchestration, createOrchestrationRouter }
  from './server/orchestration/index.ts';
```

**File 2:** `server/chat/orchestration/chat-orchestrator.ts` — line 17
```ts
import { orchestrate, runManager }
  from '../../orchestration/index.ts';
```

### Files that import sub-paths directly (bypassing the barrel)

| File | Import path | Export used |
|---|---|---|
| `server/chat/controllers/run-controller.ts:8` | `'../../orchestration/core/run-manager.ts'` | `runManager` |
| `server/chat/llm/chat-responder.ts:18` | `'../../orchestration/types/orchestration.types.ts'` | `OrchestrationResult` (type) |

---

## PHASE 2 — ROUTE → CONTROLLER TRACE

**File:** `server/file-explorer/routes/file-explorer.routes.ts`

### Canonical routes (mounted at `/api/file-explorer`)

```
GET  /api/file-explorer/tree        → ctrl.getTree()
GET  /api/file-explorer/read        → ctrl.readFile()
POST /api/file-explorer/write       → ctrl.writeFile()
POST /api/file-explorer/create      → ctrl.createEntry()
POST /api/file-explorer/rename      → ctrl.renameEntry()
POST /api/file-explorer/delete      → ctrl.deleteEntry()
POST /api/file-explorer/duplicate   → ctrl.duplicateEntry()
POST /api/file-explorer/upload      → ctrl.uploadFiles()
GET  /api/file-explorer/download    → ctrl.downloadZip()
GET  /api/file-explorer/search      → ctrl.searchFiles()
GET  /api/file-explorer/metadata    → ctrl.getMetadata()
GET  /api/file-explorer/history     → ctrl.getHistory()
GET  /api/file-explorer/git-status  → ctrl.getGitStatus()
GET  /api/file-explorer/insights    → ctrl.getInsights()
GET  /api/file-explorer/health      → ctrl.health()
```

### Legacy aliases (mounted via `legacyFileRouter` at `/api`)

```
GET  /api/list-files            → ctrl.getTree()
GET  /api/read-file             → ctrl.readFile()
POST /api/save-file             → ctrl.writeFile()
POST /api/rename-file           → ctrl.renameEntry()
POST /api/delete-file           → ctrl.deleteEntry()
POST /api/duplicate-file        → ctrl.duplicateEntry()
GET  /api/files/stat            → ctrl.getMetadataFlat()   ← flat {ok,size,mtime}
GET  /api/file/history          → ctrl.getHistory()
POST /api/file/undo             → ctrl.undoFile()
POST /api/file/conflict-check   → ctrl.conflictCheck()
```

---

## PHASE 3 — CONTROLLER → ORCHESTRATOR TRACE

**File:** `server/file-explorer/controllers/file-explorer.controller.ts`

### Exact import (line 8)
```ts
import { explorerOrchestrator } from '../orchestrator/index.ts';
```

**Resolved path:** `server/file-explorer/orchestrator/index.ts`
> This is the file-explorer's own local orchestrator — **NOT** `server/orchestration/index.ts`

### Methods called

```
ctrl.getTree()          → explorerOrchestrator.getTree(projectPath, showHidden)
ctrl.readFile()         → explorerOrchestrator.readFile(filePath)
ctrl.writeFile()        → explorerOrchestrator.writeFile(filePath, content, mtime)
ctrl.createEntry()      → explorerOrchestrator.createEntry(filePath, isFolder, content)
ctrl.renameEntry()      → explorerOrchestrator.renameEntry(oldPath, newPath)
ctrl.deleteEntry()      → explorerOrchestrator.deleteEntry(targetPath)
ctrl.duplicateEntry()   → explorerOrchestrator.duplicateEntry(sourcePath, destPath)
ctrl.uploadFiles()      → explorerOrchestrator.uploadFiles(files)
ctrl.downloadZip()      → explorerOrchestrator.downloadZip(projectPath)
ctrl.searchFiles()      → explorerOrchestrator.search(q, projectPath, caseSensitive)
ctrl.getMetadata()      → explorerOrchestrator.getMetadata(filePath)
ctrl.getHistory()       → explorerOrchestrator.getHistory(filePath)
ctrl.getGitStatus()     → explorerOrchestrator.getGitStatus()
ctrl.getInsights()      → explorerOrchestrator.getInsights()
ctrl.getMetadataFlat()  → explorerOrchestrator.getMetadata(filePath) + flatten response
ctrl.undoFile()         → explorerOrchestrator.undoFile(filePath)
ctrl.conflictCheck()    → explorerOrchestrator.conflictCheck(filePath, baseVersionId)
```

---

## PHASE 4 — ORCHESTRATOR TRACE

**File:** `server/file-explorer/orchestrator/explorer.orchestrator.ts`

```
explorerOrchestrator.getTree()
  └→ treeService.getTree()

explorerOrchestrator.readFile()
  └→ readService.readFile()
  └→ recentService.add()                    [side effect — tracks recent files]

explorerOrchestrator.writeFile()
  └→ historyService.snapshotBeforeWrite()
  └→ writeService.saveFile()
  └→ fileEventsService.onModified()         [SSE publish → TOPIC.FILE]

explorerOrchestrator.createEntry()
  └→ createService.createEntry()
  └→ fileEventsService.onCreated()          [SSE publish → TOPIC.FILE]

explorerOrchestrator.renameEntry()
  └→ renameService.rename()
  └→ fileEventsService.onRenamed()          [SSE publish → TOPIC.FILE]

explorerOrchestrator.deleteEntry()
  └→ deleteService.delete()
  └→ fileEventsService.onDeleted()          [SSE publish → TOPIC.FILE]

explorerOrchestrator.duplicateEntry()
  └→ duplicateService.duplicate()
  └→ fileEventsService.onCreated()          [SSE publish → TOPIC.FILE]

explorerOrchestrator.uploadFiles()
  └→ uploadService.upload()
  └→ fileEventsService.onUploaded()         [SSE publish → TOPIC.FILE]

explorerOrchestrator.downloadZip()
  └→ downloadService.download()

explorerOrchestrator.search()
  └→ searchService.search()
     └→ filesystemRepository.walkFiles()   [only layer allowed fs access]

explorerOrchestrator.getMetadata()
  └→ metadataService.getMeta()
     └→ filesystemRepository.stat()
     └→ metadataRepository.set()

explorerOrchestrator.getHistory()
  └→ historyService.getHistory()
     └→ historyRepository.getHistory()

explorerOrchestrator.getGitStatus()
  └→ gitStatusService.getStatus()

explorerOrchestrator.getInsights()
  └→ insightsService.getInsights()
     └→ filesystemRepository.walkFiles()

explorerOrchestrator.undoFile()
  └→ historyService.getHistory()
  └→ historyService.restoreVersion()
  └→ fileEventsService.onModified()         [SSE publish → TOPIC.FILE]

explorerOrchestrator.conflictCheck()
  └→ historyService.getHistory()
```

---

## PHASE 5 — MASTER ORCHESTRATOR CHECK

**Question:** Does any file inside `server/file-explorer/` import `server/orchestration/index.ts`?

### Grep evidence (actual output)

```
server/file-explorer/controllers/file-explorer.controller.ts:8:
  import { explorerOrchestrator } from '../orchestrator/index.ts';

server/file-explorer/orchestrator/index.ts:1:
  export { explorerOrchestrator } from './explorer.orchestrator.ts';
```

### Answer

**NO.**

No file inside `server/file-explorer/` imports `server/orchestration/index.ts`.

The only `../orchestrator` import in file-explorer resolves to
`server/file-explorer/orchestrator/index.ts` — the module's own local orchestrator.
The master `server/orchestration/index.ts` is completely separate and invisible to
the file-explorer module.

---

## PHASE 6 — COMPLETE DEPENDENCY GRAPH

```
main.ts
├─ imports → server/orchestration/index.ts
│               exports: orchestrate, initOrchestration,
│                        createOrchestrationRouter, runManager
│               called at:
│                 main.ts:91  → app.use('/api/orchestration', createOrchestrationRouter())
│                 main.ts:115 → initOrchestration()
│
├─ imports → server/chat/index.ts  (chatOrchestrator facade)
│               └─ server/chat/orchestration/chat-orchestrator.ts
│                     imports → server/orchestration/index.ts  ← ONLY OTHER CONSUMER
│                       calls → orchestrate({ runId, projectId, sandboxRoot, goal })
│                       calls → runManager.register()
│                       calls → runManager.setStatus()
│                       calls → runManager.get()
│
└─ imports → server/file-explorer/index.ts
                └─ server/file-explorer/routes/file-explorer.routes.ts
                      └─ server/file-explorer/controllers/file-explorer.controller.ts
                            imports → server/file-explorer/orchestrator/index.ts  ← LOCAL ONLY
                                        └─ explorer.orchestrator.ts
                                              ├─ treeService
                                              ├─ readService
                                              ├─ writeService
                                              ├─ createService
                                              ├─ renameService
                                              ├─ deleteService
                                              ├─ duplicateService
                                              ├─ uploadService
                                              ├─ downloadService
                                              ├─ searchService
                                              ├─ metadataService
                                              ├─ historyService
                                              ├─ gitStatusService
                                              ├─ insightsService
                                              ├─ recentService
                                              └─ fileEventsService  (SSE → TOPIC.FILE)
                                                    └─ filesystemRepository  ← only fs/path layer
                                                    └─ historyRepository
                                                    └─ metadataRepository
```

---

## FINAL ANSWER TABLE

| Question | Answer | Evidence |
|---|---|---|
| Who imports `server/orchestration/index.ts`? | **`main.ts`** and **`server/chat/orchestration/chat-orchestrator.ts`** | `main.ts:16`, `chat-orchestrator.ts:17` |
| Which methods are called from `main.ts`? | `initOrchestration()`, `createOrchestrationRouter()` | `main.ts:91`, `main.ts:115` |
| Which methods are called from `chat-orchestrator.ts`? | `orchestrate()`, `runManager.register/setStatus/get` | `chat-orchestrator.ts:79,127,204,244,259,274` |
| Does any `server/file-explorer/` file import it? | **NO** | Grep: only `'../orchestrator/index.ts'` (local) found |
| What does `file-explorer.controller.ts` import? | `server/file-explorer/orchestrator/index.ts` (own local orchestrator) | `controller.ts:8` |
