# FILESYSTEM TOOLCHAIN DEEP SCAN AUDIT — FINAL REPORT

**Date:** 2026-06-01  
**Scope:** `server/tools/` ↔ `server/file-explorer/` relationship audit  
**Mode:** Analysis only — no code changes made

---

## 1. TOTAL FILES SCANNED

| Area | Files |
|---|---|
| `server/tools/` | **253 files** |
| `server/file-explorer/` | **87 files** |
| **Total** | **340 files** |

---

## 2. TOOL REGISTRY MAP

**Boot flow** (`main.ts` → `tool-loader.ts` → `sealRegistry`):

```
loadAllTools()                        [server/tools/registry/tool-loader.ts]
  ├── registerFilesystemTools()       [server/tools/filesystem/registry/register-filesystem-tools.ts]
  │     41 tools (read/write/edit/delete/move/clone/search/structure/folders)
  ├── registerTerminalTools()         [server/tools/terminal/registry/register-terminal-tools.ts]
  ├── registerVerifierTools()         [server/tools/verifier/registry/register-verifier-tools.ts]
  ├── registerBrowserTools()          [server/tools/browser/registry/register-browser-tools.ts]
  ├── registerCodingTools()           [server/tools/coding/registry/register-coding-tools.ts]
  └── registerPlannerTools()          [server/tools/planner/register-planner-tools.ts]
→ sealRegistry()    ← registry is locked after all registrations
```

**Tool categories:**

| Category | Registration File |
|---|---|
| `filesystem` | `tools/filesystem/registry/register-filesystem-tools.ts` |
| `terminal` | `tools/terminal/registry/register-terminal-tools.ts` |
| `verifier` | `tools/verifier/registry/register-verifier-tools.ts` |
| `browser` | `tools/browser/registry/register-browser-tools.ts` |
| `coding` | `tools/coding/registry/register-coding-tools.ts` |
| `planner` | `tools/planner/register-planner-tools.ts` |

**Registry implementation** (`tool-registry.ts`):
- `Map<string, ToolDefinition>` — in-memory singleton
- `registerTool()` / `getTool()` / `listTools()` / `sealRegistry()`
- Exports `unifiedRegistry` shim for backward compat with routes

---

## 3. IMPORT GRAPH — CROSS-MODULE BOUNDARY

**Evidence from grep scan:**

```
grep "file-explorer" server/tools/**   → ZERO RESULTS
grep "readService|writeService|..."    → ZERO RESULTS
grep "server/tools" server/file-explorer/** → ZERO RESULTS
```

**Confirmed verdict:**

```
server/tools/          ←──── ZERO imports ────→   server/file-explorer/
```

**These two modules are hermetically isolated. No cross-dependency exists in either direction.**

---

## 4. DEPENDENCY GRAPH

### `server/tools/filesystem/` internal chain:

```
read-file.ts  (tool handler)
  └── lib/files/file-reader.ts
        └── lib/utils/filesystem-utils.ts
              └── node:fs  (import { promises as fs } from 'node:fs')   ← DISK

write-file.ts  (tool handler)
  └── lib/files/file-writer.ts
        └── lib/utils/filesystem-utils.ts
              └── node:fs

patch-file.ts  (tool handler)
  └── lib/files/patch-file.ts
        ├── lib/files/file-reader.ts
        └── lib/files/file-writer.ts
              └── node:fs

search-text.ts  (tool handler)
  └── lib/search/text-search.ts
        ├── lib/files/file-reader.ts
        └── lib/folders/folder-scanner.ts
              └── lib/utils/filesystem-utils.ts → node:fs

scan-folder.ts  (tool handler)
  └── lib/folders/folder-scanner.ts
        └── lib/utils/filesystem-utils.ts → node:fs
```

### `server/file-explorer/` internal chain:

```
ExplorerOrchestrator  [orchestrator/explorer.orchestrator.ts]
  └── services/read/read.service.ts
        └── repositories/filesystem.repository.ts
              └── node:fs  (import fs from 'fs')   ← DISK

  └── services/write/write.service.ts
        └── repositories/filesystem.repository.ts → node:fs

  └── services/search/search.service.ts
        └── repositories/filesystem.repository.ts → node:fs

  └── services/history/history.service.ts
        ├── services/read/read.service.ts
        └── services/write/write.service.ts → node:fs
```

---

## 5. FILESYSTEM TOOL AUDIT TABLE

| Tool Name | Tool File | Calls Into | Final I/O |
|---|---|---|---|
| `fs_read_file` | `read/read-file.ts` | `lib/files/file-reader.ts` → `filesystem-utils.ts` | `node:fs` (`fs.readFile`) |
| `fs_write_file` | `write/write-file.ts` | `lib/files/file-writer.ts` → `filesystem-utils.ts` | `node:fs` (`fs.writeFile`) |
| `fs_patch_file` | `edit/patch-file.ts` | `lib/files/patch-file.ts` → reader + writer | `node:fs` (read + write) |
| `fs_search_text` | `search/search-text.ts` | `lib/search/text-search.ts` → folder-scanner + file-reader | `node:fs` |
| `fs_scan_folder` | `structure/scan-folder.ts` | `lib/folders/folder-scanner.ts` | `node:fs` (`fs.readdir`, `fs.stat`) |
| `fs_read_lines` | `read/read-lines.ts` | `lib/files/file-reader.ts` | `node:fs` |
| `fs_delete_file` | `delete/delete-file.ts` | `lib/files/file-deleter.ts` | `node:fs` |
| `fs_move_file` | `move/move-file.ts` | `lib/files/file-mover.ts` | `node:fs` |
| `fs_search_regex` | `search/search-regex.ts` | `lib/search/regex-search.ts` | `node:fs` |
| `fs_find_imports` | `search/find-imports.ts` | `lib/search/dependency-search.ts` | `node:fs` |

**Key finding: ZERO tools import from `file-explorer`. ALL use their own `lib/` stack → `node:fs` directly.**

---

## 6. FILE EXPLORER OWNERSHIP MAP

| Capability | Owner File | Uses `filesystemRepository`? |
|---|---|---|
| Tree generation | `services/tree/tree.service.ts` | ✅ Yes |
| File read | `services/read/read.service.ts` | ✅ Yes |
| File write | `services/write/write.service.ts` | ✅ Yes |
| File create | `services/create/create.service.ts` | ✅ Yes |
| File rename | `services/rename/rename.service.ts` | ✅ Yes |
| File delete | `services/delete/delete.service.ts` | ✅ Yes |
| File duplicate | `services/duplicate/duplicate.service.ts` | ✅ Yes |
| Upload | `services/upload/upload.service.ts` | ✅ Yes |
| Download/ZIP | `services/download/download.service.ts` | ✅ Yes |
| Full-text search | `services/search/search.service.ts` | ✅ Yes |
| File metadata | `services/metadata/metadata.service.ts` | ✅ Yes |
| **Version history / undo** | `services/history/history.service.ts` | ✅ Yes |
| **Undo/restore** | `orchestrator/explorer.orchestrator.ts` | Via historyService |
| **Conflict detection** | `orchestrator/explorer.orchestrator.ts` | Via writeService |
| Git status | `services/git-status/git-status.service.ts` | ❌ (runs git CLI) |
| Realtime events | `realtime/file-events.service.ts` | ❌ (event emitter) |
| Pinned files | `services/pinned/pinned.service.ts` | Via DB repo |
| Recent files | `services/recent/recent.service.ts` | Via DB repo |
| Open editors | `services/open-editors/open-editors.service.ts` | Via DB repo |

**File Explorer exclusively serves the human UI layer** (HTTP → controller → orchestrator → services).  
It has rich UI-specific features: history/undo, conflict detection, realtime events, metadata cache, pinned/recent state.

---

## 7. TOOL → FILE EXPLORER RELATIONSHIP

```
AI Tools (server/tools/filesystem/*)
  ↓ imports
lib/ layer (file-reader, file-writer, folder-scanner…)
  ↓ imports
filesystem-utils.ts
  ↓
node:fs

File Explorer (server/file-explorer/*)
  ↓ imports
filesystemRepository
  ↓
node:fs

Connection between the two: NONE.
```

**They hit the same disk via completely separate code paths.**

---

## 8. EXACT CALL GRAPH — AI EXECUTION PATH

```
User (chat message)
  ↓
server/chat/index.ts                              [chatOrchestrator facade]
  ↓
server/orchestration/orchestrator.ts              [OrchestrationSession]
  ↓
server/agents/planner/planner-agent.ts            [builds ExecutionPlan]
  ↓
server/agents/executor/executor-agent.ts          [runExecutorAgent()]
  ↓
server/agents/executor/execution/execution-loop.ts [runExecutionLoop()]
  ↓
server/agents/executor/coordination/dispatcher-client.ts [executeTool()]
  ↓  import { dispatch } from '../../../tools/registry/tool-dispatcher.ts'
server/tools/registry/tool-dispatcher.ts          [dispatch()]
  ↓  resolveToolWithPermissions() → definition.handler()
server/tools/registry/tool-resolver.ts            [getTool() from registry]
  ↓
server/tools/filesystem/read/read-file.ts         [handler: readFileTool]
  ↓  readFile({ sandboxRoot, path })
server/tools/filesystem/lib/files/file-reader.ts  [readFile()]
  ↓  assertReadOperation() + readTextFile()
server/tools/filesystem/lib/utils/filesystem-utils.ts [readTextFile()]
  ↓  fs.readFile(p, 'utf-8')
node:fs  ← DISK
```

**File Explorer is NEVER in this path.**

---

## 9. EXACT CALL GRAPH — FILE EXPLORER (HUMAN UI) PATH

```
HTTP Request (from React frontend)
  ↓
server/file-explorer/routes/file-explorer.routes.ts
  ↓
server/file-explorer/controllers/file-explorer.controller.ts
  ↓
server/file-explorer/orchestrator/explorer.orchestrator.ts
  ↓  (e.g. readFile → snapshotBeforeWrite → writeFile)
server/file-explorer/services/read/read.service.ts
server/file-explorer/services/write/write.service.ts
server/file-explorer/services/history/history.service.ts
  ↓  filesystemRepository.readText() / writeText()
server/file-explorer/repositories/filesystem.repository.ts
  ↓  fs.readFileSync() / fs.writeFileSync()
node:fs  ← DISK
```

---

## 10. DUPLICATE LOGIC MAP

| Logic Area | In `server/tools/filesystem/` | In `server/file-explorer/` | Verdict |
|---|---|---|---|
| **Read file** | `lib/files/file-reader.ts` | `services/read/read.service.ts` | ⚠️ DUPLICATE |
| **Write file** | `lib/files/file-writer.ts` | `services/write/write.service.ts` | ⚠️ DUPLICATE |
| **Path traversal guard** | `lib/validation/sandbox-validator.ts` | `guards/path.guard.ts` | ⚠️ DUPLICATE |
| **Folder scan / list dir** | `lib/folders/folder-scanner.ts` | `repositories/filesystem.repository.ts` (`readDir`, `walkFiles`) | ⚠️ DUPLICATE |
| **Full-text search** | `lib/search/text-search.ts` | `services/search/search.service.ts` | ⚠️ DUPLICATE |
| **File version history** | `lib/workspace/workspace-history.ts` | `services/history/history.service.ts` + `repositories/history.repository.ts` | ⚠️ DUPLICATE |
| **Whole-workspace snapshot** | `lib/workspace/snapshot-manager.ts` | — (not in FE) | ✅ Unique to tools |
| **Conflict detection** | — (not in tools) | `services/write/write.service.ts` (clientMtime drift) | ✅ Unique to FE |
| **Binary content guard** | — (not in tools) | `services/read/read.service.ts` + `utils/file.util.ts` | ✅ Unique to FE |
| **Realtime file events** | — (not in tools) | `realtime/file-events.service.ts` | ✅ Unique to FE |
| **node:fs style** | `filesystem-utils.ts` uses `fs.promises` (async) | `filesystem.repository.ts` uses `fs.readFileSync` (sync) | ⚠️ Different patterns |

**Confirmed duplicates: Read, Write, Path Traversal Guard, Folder Scan, Text Search, History — all implemented independently in both stacks with zero shared code.**

---

## 11. CURRENT ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────┐
│                        HUMAN UI LAYER                               │
│  React Frontend → HTTP → file-explorer.routes.ts                   │
│                          ↓                                          │
│                   ExplorerOrchestrator                              │
│                          ↓                                          │
│              Services (read/write/search/history/…)                 │
│                          ↓                                          │
│              filesystemRepository (fs SYNC)  →  node:fs            │
└─────────────────────────────────────────────────────────────────────┘

         ← ZERO cross-imports in either direction →

┌─────────────────────────────────────────────────────────────────────┐
│                        AI AGENT LAYER                               │
│  Chat → Orchestrator → Planner → Executor                          │
│                                     ↓                               │
│                         dispatcher-client                           │
│                                     ↓                               │
│                         tool-dispatcher (sealed registry)           │
│                                     ↓                               │
│              tools/filesystem/* (41 tools)                          │
│                                     ↓                               │
│              lib/files/* + lib/utils/filesystem-utils.ts            │
│              (fs ASYNC)  →  node:fs                                 │
└─────────────────────────────────────────────────────────────────────┘

Both stacks hit the same disk through completely separate code paths,
duplicating core I/O logic independently.
```

---

## 12. RECOMMENDED ARCHITECTURE DIAGRAM

```
┌──────────────────┐    ┌──────────────────────────────┐
│   Human UI       │    │         AI Agent Layer        │
│  (file-explorer  │    │  Executor → dispatcher-client │
│   routes/ctrl)   │    │  → tool-dispatcher → tool     │
└────────┬─────────┘    └──────────────┬───────────────┘
         │                             │
         └──────────────┬──────────────┘
                        ↓
         ┌──────────────────────────────────┐
         │     server/workspace/ (NEW)      │
         │  Single shared async I/O layer:  │
         │  - sandbox-guard.ts              │
         │  - workspace-reader.ts           │
         │  - workspace-writer.ts           │
         │  - workspace-scanner.ts          │
         └───────────────┬──────────────────┘
                         ↓
                      node:fs
```

---

## 13. CENTRALIZATION SCORE

**Current: 2 / 10**

- Two fully independent filesystem stacks with zero sharing
- Duplicate path guards, read/write, search, history in both stacks
- No single source of truth for sandbox I/O
- AI writes bypass conflict detection and history snapshots entirely

---

## 14. REPLIT PARITY SCORE

**Current: 4 / 10**

| Replit Pattern | Present? | Notes |
|---|---|---|
| Agent → Tool → Workspace Service → Disk | ❌ | Tools bypass any shared layer |
| Single sandboxed I/O layer | ❌ | Two separate stacks |
| Tool dispatcher with retry/timeout/audit | ✅ | Well implemented |
| Sealed tool registry (boot-time lock) | ✅ | Correct pattern |
| Realtime events on file change | ✅ | FE layer only — AI writes emit nothing |
| Conflict detection on writes | ✅ | FE layer only — AI writes have no guard |
| Agent write triggering history snapshot | ❌ | AI tools write raw; no undo possible |

---

## 15. FILES THAT SHOULD IMPORT FROM A SHARED WORKSPACE LAYER

If a shared `server/workspace/` is extracted:

```
server/tools/filesystem/lib/files/file-reader.ts
server/tools/filesystem/lib/files/file-writer.ts
server/tools/filesystem/lib/files/patch-file.ts
server/tools/filesystem/lib/folders/folder-scanner.ts
server/tools/filesystem/lib/search/text-search.ts
server/tools/filesystem/lib/validation/sandbox-validator.ts
server/file-explorer/repositories/filesystem.repository.ts   (partial — traversal/guard only)
server/file-explorer/guards/path.guard.ts                     (replace with shared sandbox-guard)
```

---

## 16. FILES THAT SHOULD NOT IMPORT FROM FILE EXPLORER OR SHARED WORKSPACE

```
server/tools/registry/*                       ← pure registry, no I/O
server/tools/filesystem/lib/workspace/snapshot-manager.ts   ← whole-workspace AI snapshots
server/tools/terminal/*                       ← shell execution, unrelated
server/tools/verifier/*                       ← verification pipeline
server/tools/browser/*                        ← Playwright, unrelated
server/tools/coding/*                         ← code generation, LLM
server/file-explorer/services/history/*       ← UI undo/redo, per-file; not an AI concern
server/file-explorer/realtime/*               ← UI SSE events; AI must not trigger these
```

---

## 17. FINAL VERDICT — Should `server/tools` use `server/file-explorer`?

### **NO — in its current form.**

**Reasons:**

1. **Sync vs async mismatch.** `filesystemRepository` uses `fs.readFileSync` / `fs.writeFileSync` (synchronous). The tools layer uses `node:fs promises` (async). Merging would require converting the entire FE service stack to async — a large, risky refactor.

2. **UI concerns would leak into AI tools.** File Explorer owns: binary content detection, clientMtime conflict detection, realtime SSE event emission, metadata cache invalidation, recent/pinned/open-editor tracking. An AI `fs_write_file` should not emit a UI SSE event or invalidate a metadata cache as a side-effect.

3. **Incompatible config models.** `FE_CONFIG.sandboxRoot` is frozen at module-init from env vars. Tools resolve `sandboxRoot` dynamically from `ctx.sandboxRoot` per-call (can differ per run). These models cannot share the same config singleton.

4. **Both stacks are functionally correct.** The duplication is architectural waste, not a runtime bug.

---

## 18. FINAL VERDICT — Should File Explorer become the shared filesystem layer?

### **NO as-is. YES as an extracted `server/workspace/` module.**

**File Explorer is a UI-serving module** with UI-specific responsibilities bolted onto its I/O layer. It cannot serve as a neutral foundation.

The correct move is to **extract the pure I/O + path-guard logic** into a new `server/workspace/` module and have **both** the tools stack and the file-explorer services import from it.

---

## 19. EXACT MIGRATION PLAN

> This plan is recommended. No code has been changed in this audit.

### Step 1 — Create `server/workspace/` (new shared module)

```
server/workspace/
  sandbox-guard.ts       ← merge from:
                              tools/lib/validation/sandbox-validator.ts
                              file-explorer/guards/path.guard.ts
  workspace-reader.ts    ← async readFile, readLines, fileExists
  workspace-writer.ts    ← async writeFile, appendFile, ensureParentDir
  workspace-scanner.ts   ← async scanFolder, walkFiles, listDir
  index.ts               ← re-exports
```

**Rules for this module:**
- Async only (node:fs promises)
- Accepts `sandboxRoot: string` per-call — no global config
- Zero UI concerns: no events, no metadata, no conflict detection, no cache

### Step 2 — Migrate `server/tools/filesystem/lib/`

Update imports in:
```
lib/files/file-reader.ts         → from '../../workspace/workspace-reader.ts'
lib/files/file-writer.ts         → from '../../workspace/workspace-writer.ts'
lib/folders/folder-scanner.ts    → from '../../workspace/workspace-scanner.ts'
lib/search/text-search.ts        → (auto-resolved via folder-scanner)
lib/validation/sandbox-validator.ts → from '../../workspace/sandbox-guard.ts'
```

All 41 registered tools remain unchanged — they call the same lib API surface.

### Step 3 — Partially migrate `server/file-explorer/`

Keep `filesystemRepository` as-is for sync compatibility.  
Replace only the path-guard and traversal logic:
```
guards/path.guard.ts              → import { resolveSafe } from '../../workspace/sandbox-guard.ts'
repositories/filesystem.repository.ts → import walkFiles from '../../workspace/workspace-scanner.ts'
```

### Step 4 — Delete duplicated code

After migration is verified:
```
DELETE server/tools/filesystem/lib/utils/filesystem-utils.ts   (replaced by workspace-reader/writer)
DELETE server/tools/filesystem/lib/validation/sandbox-validator.ts  (replaced by sandbox-guard)
SIMPLIFY server/file-explorer/guards/path.guard.ts             (delegates to sandbox-guard)
```

### Step 5 — History: keep separate (by design)

| History Type | Location | Purpose | Action |
|---|---|---|---|
| Per-file content history (undo) | `file-explorer/services/history/` | Human IDE undo | Keep as-is |
| Whole-workspace snapshot (rollback) | `tools/lib/workspace/snapshot-manager.ts` | AI crash recovery | Keep as-is |

These serve genuinely different purposes. Do not merge.

---

## SUMMARY TABLE

| Question | Answer |
|---|---|
| Do AI tools use File Explorer? | **NO — zero imports in either direction** |
| Do AI tools use `node:fs` directly? | **YES — via `lib/utils/filesystem-utils.ts`** |
| Does duplicate filesystem architecture exist? | **YES — 6 areas of duplicated logic** |
| Should File Explorer be in AI execution path? | **NO — UI concerns, sync I/O, incompatible config** |
| Current architecture | **Two completely independent stacks, both hitting `node:fs`** |
| Better architecture | **Extract `server/workspace/` as shared async I/O layer** |
| Centralization score | **2 / 10** |
| Replit parity score | **4 / 10** |
| Should tools import file-explorer as-is? | **NO** |
| Should file-explorer become shared layer? | **NO as-is — extract a neutral `WorkspaceService` first** |
