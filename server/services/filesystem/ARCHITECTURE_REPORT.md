# Filesystem Service Architecture Report
**Date:** 2026-06-02  
**Scope:** `server/tools/filesystem/` ↔ `server/services/filesystem/` ↔ `server/file-explorer/`  

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI Agent Request                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              LAYER 1 — TOOL DEFINITIONS                         │
│         server/tools/filesystem/{category}/*.ts                 │
│                                                                 │
│  • Input validation (assertInputPath, assertInputString)        │
│  • ToolDefinition shape (name, schema, permissions, timeout)    │
│  • handler() calls the correct service method                   │
│  • NO filesystem I/O, NO business logic here                   │
└────────────────────────────┬────────────────────────────────────┘
                             │  imports via
                             │  server/services/filesystem/index.ts (barrel)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              LAYER 2 — SERVICE BARREL                           │
│         server/services/filesystem/index.ts                     │
│                                                                 │
│  Single import surface. Exports two categories:                 │
│                                                                 │
│  ① FE Services (for file-explorer UI routes)                   │
│     readService, writeService, deleteService, treeService,      │
│     searchService, metadataService, clipboardService,           │
│     historyService, recentService, pinnedService,               │
│     openEditorsService, gitStatusService, insightsService,      │
│     dependencyAnalysisService, scannerService, uploadService,   │
│     downloadService, renameService, duplicateService,           │
│     createService                                               │
│                                                                 │
│  ② Tool Services (for AI agent tools)                           │
│     readToolService, writeToolService, deleteToolService,       │
│     cloneToolService, moveToolService, folderToolService,       │
│     searchToolService, structureToolService                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
               ┌─────────────┴──────────────┐
               │                            │
               ▼                            ▼
┌──────────────────────────┐  ┌─────────────────────────────────┐
│  LAYER 3A — FE SERVICES  │  │  LAYER 3B — TOOL SERVICES       │
│  server/services/        │  │  server/services/filesystem/    │
│  filesystem/{category}/  │  │  {category}/tool.service.ts     │
│  *.service.ts            │  │  or {name}.service.ts           │
│                          │  │                                 │
│  Business logic for the  │  │  Thin façades. Delegate 100%    │
│  File Explorer UI:       │  │  to lib/ infra functions.       │
│  • size/binary guards    │  │  No business logic.             │
│  • FE_CONFIG limits      │  │                                 │
│  • UI-shaped responses   │  │  readToolService                │
│  • Clipboard state       │  │  writeToolService               │
│  • History tracking      │  │  deleteToolService              │
│  • Pinned/Recent lists   │  │  cloneToolService               │
│                          │  │  moveToolService                │
│  Import from:            │  │  folderToolService              │
│  ../../file-explorer/    │  │  searchToolService              │
│    config, guards,       │  │  structureToolService           │
│    repositories,         │  │                                 │
│    utils, contracts      │  │  Import from:                   │
│                          │  │  ../../../tools/filesystem/lib/ │
└──────────────┬───────────┘  └──────────────┬──────────────────┘
               │                             │
               ▼                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              LAYER 4 — REPOSITORIES                             │
│         server/file-explorer/repositories/                      │
│                                                                 │
│  filesystem.repository.ts  — fs.statSync, fs.readdirSync etc.  │
│  git.repository.ts         — execSync('git status --short')    │
│  metadata.repository.ts    — file MIME/metadata reads          │
│  editors.repository.ts     — open editor state (in-memory)     │
│  history.repository.ts     — file change history (in-memory)   │
│  pinned.repository.ts      — pinned paths (in-memory)          │
│  recent.repository.ts      — recently opened (in-memory)       │
│                                                                 │
│  RULE: Only repositories may call child_process / raw fs sync  │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│              LAYER 4B — LIB / INFRASTRUCTURE                    │
│         server/tools/filesystem/lib/                            │
│                                                                 │
│  files/     — file-reader, file-writer, file-editor,           │
│               file-cloner, file-mover, file-deleter,           │
│               file-renamer, patch-file                          │
│  folders/   — folder-reader, folder-creator, folder-deleter,   │
│               folder-cloner, folder-mover, folder-renamer,     │
│               folder-scanner, folder-structure                  │
│  search/    — file-search, text-search, regex-search,          │
│               dependency-search                                 │
│  structure/ — structure-builder, structure-reader,             │
│               structure-patcher, scaffold-generator,           │
│               structure-validator                               │
│  validation/— path-validator, sandbox-validator,               │
│               file-validator, integrity-validator,             │
│               replacement-validator                             │
│  utils/     — filesystem-utils, path-utils, diff-utils,        │
│               traversal-utils                                   │
│  workspace/ — workspace-manager, snapshot-manager,             │
│               workspace-history, isolation-manager             │
│                                                                 │
│  RULE: Lib may only import from Node.js built-ins +            │
│        sibling lib files. Never imports services or tools.     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Import Chain — Concrete Example

**Agent calls `fs_read_file`:**

```
AI Agent
  └─► handler() in read/read-file.ts
        assertInputPath(input.path)                  ← validation layer
        readToolService.read({ sandboxRoot, path })  ← calls service via barrel
          └─► ReadToolService.read()                 ← services/filesystem/read/tool.service.ts
                readFile({ sandboxRoot, path })      ← delegates to lib
                  └─► lib/files/file-reader.ts
                        assertReadOperation()        ← sandbox guard
                        readTextFile(absolutePath)   ← Node.js fs.readFile
```

**FE UI calls `GET /api/file-explorer/file`:**

```
HTTP Request
  └─► file-explorer/routes → controller
        readService.readFile(filePath)               ← calls FE service
          └─► ReadService.readFile()                 ← services/filesystem/read/read.service.ts
                resolveSafe(filePath)                ← file-explorer/guards
                filesystemRepository.stat(abs)       ← file-explorer/repositories
                hasBinaryContent(buffer)             ← file-explorer/utils
                → ReadResponse { ok, content, ... }  ← file-explorer/contracts
```

---

## 3. Import Status Audit (89 total tool files)

| Status | Count | Files |
|--------|-------|-------|
| ✅ Via barrel (`services/filesystem/index.ts`) | **40** | All agent tool handlers (clone, delete, edit, folders, move, read, search, structure, write) |
| ✅ Direct type-only (intentional) | **1** | `shared/filesystem-types.ts` — re-exports `ScanEntry`, `ImportEntry` etc. (types not in barrel) |
| ✅ No import needed | **48** | `lib/**` (38 infra), `validation/**` (4), `shared/context+errors+result` (3), `index.ts`, `registry/` |

**Zero files bypass the barrel for service instance imports.** ✅

---

## 4. Workflow Architecture Assessment

### ✅ What Is Working Correctly

| Principle | Status | Evidence |
|-----------|--------|---------|
| Single import surface | ✅ | All 40 tool files use `services/filesystem/index.ts` |
| Tool layer owns zero I/O | ✅ | Tool handlers only call `assertInput*` + service method |
| Service layer owns zero raw I/O | ✅ | Tool services are pure façades over lib/ |
| Lib layer is dependency-free | ✅ | lib/ imports only Node.js built-ins + sibling lib files |
| Repository isolation | ✅ | Only `repositories/` calls `execSync`, `fs.statSync` sync |
| Sandbox enforcement | ✅ | `assertReadOperation / assertWriteOperation / assertDeleteOperation` in every lib path |
| Typed contracts | ✅ | No `any` — all service methods have typed inputs and outputs |
| Fail-closed | ✅ | Every lib function throws on violation; tools surface the error |

### ⚠️ Gaps / Risks Found

#### GAP-01 — Two parallel service namespaces in one barrel
**Where:** `server/services/filesystem/index.ts`  
**Issue:** FE services (`readService`) and Tool services (`readToolService`) are co-exported from the same barrel. A tool could accidentally import `readService` (FE service, syncs with `filesystemRepository`) instead of `readToolService` (async, sandboxed).  
**Risk:** Medium — mismatch causes sync vs async behaviour difference.  
**Fix:** Split barrel into two:
```
server/services/filesystem/index.ts        ← FE services only
server/services/filesystem/tools.index.ts  ← Tool services only
```
Tool files import from `tools.index.ts`, FE routes import from `index.ts`.

#### GAP-02 — FE services moved but internal imports still reference `../../file-explorer/`
**Where:** All moved `*.service.ts` files in `server/services/filesystem/{category}/`  
**Issue:** After the move from `server/file-explorer/services/`, internal imports were updated to `../../file-explorer/config/`, `../../file-explorer/guards/` etc. This creates a cross-module dependency: `server/services/` → `server/file-explorer/`.  
**Risk:** Low currently, but creates tight coupling — `file-explorer/` internals cannot be refactored without touching `services/filesystem/`.  
**Fix (future):** Extract `file-explorer/config`, `file-explorer/guards`, `file-explorer/repositories` into a shared `server/shared/file-explorer-core/` that both modules depend on.

#### GAP-03 — `shared/filesystem-types.ts` imports types directly from subfolders
**Where:** `server/tools/filesystem/shared/filesystem-types.ts`  
**Issue:** Imports `ScanEntry`, `ScanResult`, `ImportEntry` etc. directly from `services/filesystem/scanner/index.ts` and `services/filesystem/dependency-analysis/index.ts` because the barrel only exports service instances, not types.  
**Risk:** Low — intentional, not a bug.  
**Fix:** Add type-only exports to the barrel:
```ts
export type { ScanEntry, ScanResult, ScanWithFiltersOptions } from './scanner/index.ts';
export type { ImportEntry, ExportEntry, UsageEntry }          from './dependency-analysis/index.ts';
```

#### GAP-04 — Tool services in `read/`, `write/`, `delete/`, `search/` share folder with FE services
**Where:** `server/services/filesystem/read/` contains `read.service.ts` (FE) + `tool.service.ts` (agent).  
**Issue:** Same folder holds two different service types with different contracts and callers. Increases cognitive load.  
**Risk:** Low — no runtime impact.  
**Fix (future):** Move tool services into dedicated `server/services/filesystem/agent/{category}/` subfolder.

---

## 5. Data Flow Summary

```
┌──────────────┐    ┌──────────────┐    ┌───────────────────────┐
│  AI Agent    │    │  File        │    │  Tool Registry        │
│  (LLM call)  │    │  Explorer UI │    │  (38 tools registered)│
└──────┬───────┘    └──────┬───────┘    └──────────┬────────────┘
       │ tool call          │ HTTP req               │ at boot
       ▼                   ▼                        ▼
┌──────────────────────────────────────────────────────────────┐
│               server/tools/filesystem/                       │
│                  handler() functions                         │
└──────────────────────────┬───────────────────────────────────┘
                           │ imports via barrel
                           ▼
┌──────────────────────────────────────────────────────────────┐
│          server/services/filesystem/index.ts                 │
│        (20 FE services + 8 tool services)                    │
└────────────┬──────────────────────────┬───────────────────────┘
             │                          │
             ▼                          ▼
┌────────────────────────┐   ┌──────────────────────────────┐
│  FE Services           │   │  Tool Services               │
│  (UI-shaped, sync/     │   │  (async, sandboxed,          │
│   guarded by FE rules) │   │   delegate to lib/)          │
└────────────┬───────────┘   └──────────────┬───────────────┘
             │                              │
             ▼                              ▼
┌────────────────────────┐   ┌──────────────────────────────┐
│  file-explorer/        │   │  tools/filesystem/lib/       │
│  repositories/         │   │  (pure async infra)          │
│  (sync fs + git)       │   │                              │
└────────────────────────┘   └──────────────────────────────┘
```

---

## 6. Verdict

| Category | Score |
|----------|-------|
| Layer separation | 9/10 |
| Import discipline | 10/10 |
| Barrel consistency | 10/10 |
| Fail-closed pattern | 10/10 |
| Coupling risk | 7/10 (GAP-01, GAP-02) |
| **Overall** | **9.2/10** |

**Architecture is sound and production-ready.** The two main improvements worth scheduling are GAP-01 (split the barrel) and GAP-02 (extract `file-explorer` internals into shared core) — both are refactor items, not blockers.
