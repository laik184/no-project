# SERVER FILE EXPLORER — COMPLETE BLUEPRINT
## Backend Deep Scan + Folder Structure + Implementation Prompt

**Target Module:** `server/file-explorer/`
**Date:** 2026-06-01
**Stack:** Express + Node.js + TypeScript (ESM, `.ts` extensions, `tsx watch`)
**Constraint:** Zero tool-agent dependency. Pure HTTP service.

---

## PART 1 — BACKEND DEEP SCAN

### 1.1 Current Backend State

The backend currently handles file operations across **two separate locations** that are inconsistent with each other:

---

#### `server/preview/files/` — Existing File Service (4 files)

```
server/preview/files/
├── files.types.ts       ← Type definitions
├── files.service.ts     ← FilesService class (list, create, upload, download, delete, stat)
├── files.controller.ts  ← HTTP adapter (thin controller)
└── files.router.ts      ← Router — BLOATED: old routes + new inline routes + duplicate helpers
```

**`files.types.ts` — What it defines:**

| Type | Fields | Problem |
|------|--------|---------|
| `FileItem` | `name, path, isDirectory, size?, modifiedAt?, children[]` | Uses `isDirectory: boolean` — frontend expects `type: 'file' \| 'folder'` |
| `ListFilesResult` | `ok, files: FileItem[], total` | Returns `files[]` — frontend expects `tree[]` |
| `CreateFileInput` | `fileName, isFolder, content?, parentPath?` | Incomplete — no conflict detection |
| `FilesServiceConfig` | `rootPath, maxUploadSizeMb, excludePatterns` | No `showHidden` flag |

**`files.service.ts` — What it does:**

```
FilesService.list()       → buildTree (recursive readdir, async)
FilesService.create()     → mkdirSync / writeFileSync
FilesService.upload()     → writes multer buffer to rootPath (flat, no path preservation)
FilesService.download()   → archiver zip → buffer
FilesService.delete()     → rmSync / unlinkSync
FilesService.stat()       → statSync → size + mtime
```

**Problems in `files.service.ts`:**
- `buildTree()` is async for no reason (uses sync `fs.readdirSync` inside)
- No `rename()` method — missing entirely
- No `duplicate()` / copy method — missing entirely
- No `readFile()` method — missing entirely
- No `save()` / `writeFile()` with conflict detection — missing entirely
- Upload flattens all files to sandbox root (ignores directory structure from drag-drop folder upload)
- `assertSafePath()` is private — cannot be reused by new routes

**`files.router.ts` — Current state (PROBLEMATIC):**

```
OLD ROUTES (via filesController):
  GET    /api/files/list         → filesService.list()   ← returns FileItem[], NOT RawTreeNode[]
  POST   /api/files/create       → filesService.create()
  POST   /api/files/upload       → filesService.upload()
  GET    /api/files/download     → filesService.download()
  DELETE /api/files/*            → filesService.delete()
  GET    /api/files/stat         → filesService.stat()
  GET    /api/files/health       → healthCheck()

NEW ROUTES (inline, no service layer — added to fix 404 crashes):
  GET    /api/list-files         → inline buildTree()   ← DUPLICATE of filesService.list()
  GET    /api/read-file          → inline readFileSync  ← NO service, no abstraction
  POST   /api/save-file          → inline writeFileSync ← NO service, has conflict check
  POST   /api/rename-file        → inline renameSync    ← NO service, no abstraction
  POST   /api/delete-file        → inline unlinkSync    ← NO service, duplicates delete route
  POST   /api/duplicate-file     → inline cpRecursive() ← NO service, no abstraction
```

**Problems count in `files.router.ts`:**
1. `safePath()` function — 4 lines, defined inline in router
2. `buildTree()` function — 15 lines, DUPLICATE of `FilesService.buildTree()` (private)
3. `cpRecursive()` function — 12 lines, defined inline in router (should be in service)
4. `SANDBOX_ROOT` constant — duplicated; already defined in `FilesService` as `DEFAULT_CONFIG.rootPath`
5. `EXCLUDE` set — duplicated; already defined in `FilesService.config.excludePatterns`
6. Two completely different response shapes for list:
   - `GET /api/files/list` → `{ ok, files: FileItem[], total }` (old shape)
   - `GET /api/list-files` → `{ ok, tree: RawTreeNode[] }` (new shape, what frontend uses)

---

#### `server/infrastructure/` — Available Building Blocks

These exist and SHOULD be used by the new module:

| Export | File | Purpose |
|--------|------|---------|
| `bus` | `events/bus.ts` | Typed in-process event emitter |
| `emitFileChange(event)` | `events/file-change-emitter.ts` | Emits file changes to bus (`agent.event` key) |
| `sseManager` | `events/sse/sse-manager.ts` | SSE connection pool — fan-out to browser clients |
| `TOPIC` | `realtime/stream-topics.ts` | Canonical SSE topic names (`TOPIC.FILE = 'file'`) |
| `getProjectDir(id)` | `sandbox/sandbox.util.ts` | Returns `SANDBOX_ROOT/<id>` |
| `safeWriteFile(path, content)` | `checkpoints/safe-fs.util.ts` | Write with backup, never throws |
| `safeDeleteFile(path)` | `checkpoints/safe-fs.util.ts` | Delete safely, never throws |

**Critical bug found: SSE file events never reach the frontend**

```
Current flow:
  emitFileChange({ projectId, path, kind })
    → bus.emit('agent.event', payload)
      → sseManager listens to 'agent.event'
        → broadcastToTopic(TOPIC.AGENT, ...)   ← fans out to 'agent' SSE topic

Frontend listens:
  useRealtimeEvent("file")                     ← listens to TOPIC.FILE = 'file'

Result: MISMATCH — file change events go to 'agent' topic, never reach 'file' topic.
Frontend only gets file events when agents write via SSE.
When the user manually saves/renames/deletes, no SSE event fires to refresh other clients.
```

The new module must publish file mutation events to `TOPIC.FILE` via `sseManager.publish()`.

---

#### `server/agents/filesystem/` — What NOT to use

```
server/agents/filesystem/
├── core/               ← AI tool-loop execution core
├── coordination/       ← Multi-agent coordination contracts
├── execution/          ← LLM-driven execution pipeline
├── monitoring/         ← Agent telemetry
├── operations/         ← read/write/patch/delete/search operation handlers
├── telemetry/          ← Metrics collection
├── types/              ← Agent-specific types
├── utils/              ← Agent utilities
├── validation/         ← LLM output validation
└── filesystem-agent.ts ← Entry point
```

**This is an AI agent — it drives LLM tool calls. Do NOT import from it.**
The new `server/file-explorer/` module is a direct HTTP service, not an AI agent.
The filesystem agent and the file explorer module are independent; they share the same sandbox but through different paths.

---

### 1.2 Problems Summary Table

| # | Problem | Location | Severity |
|---|---------|----------|----------|
| 1 | `buildTree()` duplicated in router AND service | files.router.ts + files.service.ts | Critical |
| 2 | `safePath()` duplicated in router AND service | files.router.ts + files.service.ts | Critical |
| 3 | `SANDBOX_ROOT` / `EXCLUDE` defined twice | files.router.ts + files.service.ts | High |
| 4 | `readFile`, `save`, `rename`, `duplicate` have NO service layer | files.router.ts (inline only) | High |
| 5 | Old API (`/api/files/list`) returns wrong shape for frontend | files.controller.ts | High |
| 6 | `FileItem.isDirectory` ≠ `RawTreeNode.type` — type mismatch | files.types.ts | High |
| 7 | `emitFileChange` → wrong SSE topic → never reaches frontend | infrastructure/events/ | High |
| 8 | No `rename()` method in `FilesService` | files.service.ts | High |
| 9 | Upload ignores folder structure | files.service.ts | Medium |
| 10 | `buildTree()` is async but uses sync fs calls | files.service.ts | Medium |
| 11 | No SSE fan-out on manual file mutations | files.router.ts | Medium |
| 12 | No file watcher for external changes | (missing) | Medium |
| 13 | No search-in-files capability | (missing) | Low |
| 14 | `FilesService.assertSafePath()` is private, cannot be shared | files.service.ts | Low |

---

## PART 2 — PROPOSED FOLDER STRUCTURE

### `server/file-explorer/` — Complete Structure

```
server/file-explorer/
│
├── index.ts                              ← PUBLIC entry point — ONLY file consumers import
│
├── types.ts                              ← Shared types (aligned with frontend RawTreeNode)
│
├── config.ts                             ← Singleton config: SANDBOX_ROOT, EXCLUDE, limits
│
├── guards/
│   └── path.guard.ts                     ← assertSafePath() — single source of truth
│
├── services/
│   ├── tree.service.ts                   ← buildTree, statNode, countNodes
│   ├── read.service.ts                   ← readFile with encoding detection + stat
│   ├── write.service.ts                  ← saveFile with clientMtime conflict check
│   ├── rename.service.ts                 ← renameEntry (file or folder)
│   ├── delete.service.ts                 ← deleteEntry (file or folder, recursive)
│   ├── duplicate.service.ts              ← duplicateEntry (recursive copy)
│   ├── upload.service.ts                 ← multipart upload, preserves relative paths
│   ├── download.service.ts               ← zip download via archiver
│   └── search.service.ts                 ← grep-style search within sandbox files
│
├── events/
│   └── file-explorer.events.ts           ← publishes mutations to TOPIC.FILE via sseManager
│
├── watcher/
│   └── file-watcher.ts                   ← chokidar watcher → file-explorer.events
│
├── controller/
│   └── file-explorer.controller.ts       ← HTTP adapter: validate → service → respond → emit
│
└── router/
    └── file-explorer.router.ts           ← Express Router with all routes
```

**Total:** 17 files, clean hierarchy, zero dead code

---

### File-by-File Responsibilities

#### `index.ts` — Public Barrel

```typescript
// What it exports:
export { fileExplorerRouter } from './router/file-explorer.router.ts';
export { startFileWatcher, stopFileWatcher } from './watcher/file-watcher.ts';
export type {
  RawTreeNode, FileReadResult, FileSaveResult, FileRenameResult,
  FileDeleteResult, FileDuplicateResult, FileStatResult,
  FileUploadResult, FileSearchResult, FileExplorerConfig,
} from './types.ts';
```

**Rule:** Nothing else in the codebase imports from `./services/*` or `./guards/*` directly.
All consumers go through `index.ts`. This is enforced by convention, not by bundler.

---

#### `types.ts` — Shared Type Definitions

```typescript
// Tree node — exactly matches frontend RawTreeNode
export interface RawTreeNode {
  name:      string;
  type:      'file' | 'folder';
  children?: RawTreeNode[];
  size?:     number;       // bytes, only for files
  mtime?:    number;       // ms since epoch, only for files
}

// Response shapes
export interface FileReadResult {
  ok:           boolean;
  content?:     string;
  serverMtime?: number;
  modifiedAt?:  string;   // ISO string
  encoding?:    string;
  error?:       string;
}

export interface FileSaveResult {
  ok:           boolean;
  serverMtime?: number;
  conflict?:    boolean;  // true when clientMtime check fails
  error?:       string;
}

export interface FileRenameResult   { ok: boolean; error?: string; }
export interface FileDeleteResult   { ok: boolean; error?: string; }
export interface FileDuplicateResult{ ok: boolean; destPath?: string; error?: string; }

export interface FileStatResult {
  ok:     boolean;
  size?:  number;
  mtime?: number;
  isDir?: boolean;
  error?: string;
}

export interface UploadedFile {
  originalName: string;
  savedPath:    string;
  size:         number;
}

export interface FileUploadResult {
  ok:       boolean;
  uploaded: UploadedFile[];
  failed:   string[];
  error?:   string;
}

export interface FileSearchMatch {
  path:    string;
  line:    number;
  column:  number;
  text:    string;
  preview: string;
}

export interface FileSearchResult {
  ok:      boolean;
  matches: FileSearchMatch[];
  total:   number;
  error?:  string;
}

export interface FileExplorerConfig {
  sandboxRoot:      string;
  excludePatterns:  string[];
  showHidden:       boolean;
  maxUploadSizeMb:  number;
  maxReadSizeBytes: number;
}

// SSE event shape published to TOPIC.FILE
export interface FileExplorerEvent {
  type:      'created' | 'modified' | 'deleted' | 'renamed';
  path:      string;
  newPath?:  string;   // for rename events
  projectId: number;
  ts:        number;
}
```

---

#### `config.ts` — Singleton Configuration

```typescript
// Reads from env vars, provides typed defaults
// NEVER import process.env directly in services — import from here

export const FE_CONFIG: FileExplorerConfig = {
  sandboxRoot:      process.env.AGENT_PROJECT_ROOT ?? path.join(process.cwd(), '.sandbox'),
  excludePatterns:  ['node_modules', 'dist', '.cache', '.git', '.nura'],
  showHidden:       false,
  maxUploadSizeMb:  50,
  maxReadSizeBytes: 5 * 1024 * 1024,  // 5 MB max read
};
```

---

#### `guards/path.guard.ts` — Path Safety

```typescript
// Single source of truth for path traversal prevention
// Used by ALL services — never duplicate this logic

export function assertSafePath(absPath: string, sandboxRoot: string): void
export function resolveSafe(rel: string, sandboxRoot: string): string
export function isExcluded(name: string, patterns: string[]): boolean
```

---

#### `services/tree.service.ts`

```typescript
// Builds RawTreeNode[] tree from filesystem
// Respects config.excludePatterns and config.showHidden
// Attaches size + mtime to file nodes

export function buildTree(absDir: string, cfg: FileExplorerConfig): RawTreeNode[]
export function statNode(absPath: string): FileStatResult
export function countNodes(tree: RawTreeNode[]): { files: number; folders: number }
```

---

#### `services/read.service.ts`

```typescript
// Reads file content with:
//   - Binary detection (returns error if binary, not text dump)
//   - Size guard (rejects if > maxReadSizeBytes)
//   - mtime return for conflict detection
//   - encoding detection (utf-8 / latin1 fallback)

export function readFile(absPath: string, cfg: FileExplorerConfig): FileReadResult
```

---

#### `services/write.service.ts`

```typescript
// Writes file content with:
//   - clientMtime conflict check (409 if server mtime diverged > 1000ms)
//   - Parent directory auto-creation
//   - Returns serverMtime after write

export function saveFile(absPath: string, content: string, clientMtime?: number): FileSaveResult
```

---

#### `services/rename.service.ts`

```typescript
// Renames OR moves a file/folder
// Parent dir of destination auto-created
// Returns error if source does not exist

export function renameEntry(absOld: string, absNew: string): FileRenameResult
```

---

#### `services/delete.service.ts`

```typescript
// Deletes file (unlinkSync) or folder (rmSync recursive)
// Returns error if path does not exist

export function deleteEntry(absPath: string): FileDeleteResult
```

---

#### `services/duplicate.service.ts`

```typescript
// Copies file or recursively copies folder
// Destination parent auto-created
// Preserves file timestamps (copyFileSync with COPYFILE_FICLONE fallback)

export function duplicateEntry(absSrc: string, absDest: string): FileDuplicateResult
```

---

#### `services/upload.service.ts`

```typescript
// Accepts Express.Multer.File[]
// Preserves relative path from file.originalname (supports folder drag-drop)
// Guards each path with assertSafePath
// Returns uploaded[] + failed[] arrays

export function uploadFiles(files: Express.Multer.File[], cfg: FileExplorerConfig): FileUploadResult
```

---

#### `services/download.service.ts`

```typescript
// Zips sandbox root (or specific path) using archiver
// Returns Buffer + filename + mimeType

export async function downloadZip(absPath: string): Promise<{ ok: boolean; buffer?: Buffer; filename: string; mimeType: string; error?: string }>
```

---

#### `services/search.service.ts`

```typescript
// Grep-style search across all text files in sandbox
// Skips binary files, skips excluded patterns
// Returns up to 200 matches with line/column/preview context
// Query: plain string or regex string

export function searchInFiles(query: string, absRoot: string, cfg: FileExplorerConfig): FileSearchResult
```

---

#### `events/file-explorer.events.ts`

```typescript
// Publishes FileExplorerEvent to TOPIC.FILE via sseManager
// Called by controller AFTER successful mutations
// This is the fix for the SSE bug: file events now reach the 'file' topic

import { sseManager } from '../../infrastructure/index.ts';
import { TOPIC }       from '../../infrastructure/index.ts';

export function emitExplorerEvent(event: FileExplorerEvent): void {
  sseManager.publish(TOPIC.FILE, event);
}
```

---

#### `watcher/file-watcher.ts`

```typescript
// Optional: chokidar-based FS watcher for external changes
// (e.g. agent writes, git pulls, terminal edits)
// Debounces events by 200ms per path
// Calls emitExplorerEvent on change

// Graceful start/stop for server lifecycle
export function startFileWatcher(sandboxRoot: string): void
export function stopFileWatcher(): void
```

---

#### `controller/file-explorer.controller.ts`

```typescript
// Thin HTTP adapter — handles:
//   1. Input validation
//   2. Path resolution (rel → abs via resolveSafe)
//   3. Service call
//   4. SSE event emission after mutation (emitExplorerEvent)
//   5. HTTP response

// One method per route
export class FileExplorerController {
  listFiles(req, res): void      // GET /api/list-files
  readFile(req, res): void       // GET /api/read-file
  saveFile(req, res): void       // POST /api/save-file
  renameFile(req, res): void     // POST /api/rename-file
  deleteFile(req, res): void     // POST /api/delete-file
  duplicateFile(req, res): void  // POST /api/duplicate-file
  statFile(req, res): void       // GET /api/files/stat
  uploadFiles(req, res): void    // POST /api/files/upload
  downloadZip(req, res): void    // GET /api/files/download
  searchFiles(req, res): void    // GET /api/fe/search
  healthCheck(req, res): void    // GET /api/fe/health
}

export const fileExplorerController = new FileExplorerController();
```

---

#### `router/file-explorer.router.ts`

```typescript
// Express Router — mounts all routes
// Thin: only sets up routes + multer, delegates everything to controller

import multer from 'multer';
import { fileExplorerController as ctrl } from '../controller/file-explorer.controller.ts';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.get ('/list-files',      ctrl.listFiles.bind(ctrl));
router.get ('/read-file',       ctrl.readFile.bind(ctrl));
router.post('/save-file',       ctrl.saveFile.bind(ctrl));
router.post('/rename-file',     ctrl.renameFile.bind(ctrl));
router.post('/delete-file',     ctrl.deleteFile.bind(ctrl));
router.post('/duplicate-file',  ctrl.duplicateFile.bind(ctrl));
router.get ('/files/stat',      ctrl.statFile.bind(ctrl));
router.post('/files/upload',    upload.array('files', 50), ctrl.uploadFiles.bind(ctrl));
router.get ('/files/download',  ctrl.downloadZip.bind(ctrl));
router.get ('/fe/search',       ctrl.searchFiles.bind(ctrl));
router.get ('/fe/health',       ctrl.healthCheck.bind(ctrl));

export { router as fileExplorerRouter };
```

---

### Integration in `server/preview/index.ts`

After building the module, add it to the preview pipeline:

```typescript
// In server/preview/index.ts:
import { fileExplorerRouter, startFileWatcher } from '../file-explorer/index.ts';

// Add to PIPELINE_STAGES:
{ name: 'file-explorer', router: fileExplorerRouter, mountPath: '/' }

// After boot():
startFileWatcher(process.env.AGENT_PROJECT_ROOT ?? '.sandbox');
```

And **remove** the inline routes from `server/preview/files/files.router.ts` (the 6 routes added as hotfix):
- `GET /api/list-files`
- `GET /api/read-file`
- `POST /api/save-file`
- `POST /api/rename-file`
- `POST /api/delete-file`
- `POST /api/duplicate-file`

These will be served by `file-explorer.router.ts` instead.

---

### Complete Route Table

| Method | Path | Handler | Service | SSE Event? |
|--------|------|---------|---------|-----------|
| GET | `/api/list-files?projectPath=` | listFiles | tree.service | No |
| GET | `/api/read-file?filePath=` | readFile | read.service | No |
| POST | `/api/save-file` | saveFile | write.service | Yes: `modified` |
| POST | `/api/rename-file` | renameFile | rename.service | Yes: `renamed` |
| POST | `/api/delete-file` | deleteFile | delete.service | Yes: `deleted` |
| POST | `/api/duplicate-file` | duplicateFile | duplicate.service | Yes: `created` |
| GET | `/api/files/stat?path=` | statFile | tree.service | No |
| POST | `/api/files/upload` | uploadFiles | upload.service | Yes: `created` (per file) |
| GET | `/api/files/download` | downloadZip | download.service | No |
| GET | `/api/fe/search?q=&projectPath=` | searchFiles | search.service | No |
| GET | `/api/fe/health` | healthCheck | — | No |

---

## PART 3 — IMPLEMENTATION PROMPT

> Copy this entire prompt into a new AI agent session to build the module from scratch.

---

```
SYSTEM: You are a senior TypeScript/Node.js backend engineer implementing a production-grade Express module. Follow ALL rules exactly. Do not deviate.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Build server/file-explorer/ — a clean, self-contained HTTP module that serves all file explorer API endpoints.

This module replaces the inline routes currently scattered in server/preview/files/files.router.ts.
It has ZERO dependency on any AI agent, tool-loop, or LLM system.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Every file MUST be under 200 lines. Split intelligently if needed.
2. Every file MUST use `.ts` extension in import paths (e.g. import from './types.ts').
3. No `any` type unless absolutely unavoidable and marked with a // justification comment.
4. No `console.log` in services — use console.error only in catch blocks.
5. All errors must be returned as { ok: false, error: string } — never throw from service functions.
6. All services are pure synchronous functions (except download.service.ts which is async).
7. Only `index.ts` is the public API surface. Do NOT import internal sub-modules from outside.
8. Path traversal MUST be checked with assertSafePath from path.guard.ts — nowhere else.
9. Every exported function and interface MUST have a JSDoc comment.
10. Keep files under 200 LOC. Prefer many small files over one large file.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE STRUCTURE TO CREATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

server/file-explorer/
├── index.ts
├── types.ts
├── config.ts
├── guards/
│   └── path.guard.ts
├── services/
│   ├── tree.service.ts
│   ├── read.service.ts
│   ├── write.service.ts
│   ├── rename.service.ts
│   ├── delete.service.ts
│   ├── duplicate.service.ts
│   ├── upload.service.ts
│   ├── download.service.ts
│   └── search.service.ts
├── events/
│   └── file-explorer.events.ts
├── watcher/
│   └── file-watcher.ts
├── controller/
│   └── file-explorer.controller.ts
└── router/
    └── file-explorer.router.ts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INFRASTRUCTURE IMPORTS (already exist — use these)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Import ONLY from this barrel — never from sub-paths
import { bus, sseManager, TOPIC, emitFileChange, getProjectDir, safeWriteFile, safeDeleteFile } from '../../infrastructure/index.ts';

TOPIC.FILE = 'file'   ← use this for all file mutation SSE events

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPLEMENT EACH FILE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

────────────────────────────────────────
FILE 1: server/file-explorer/types.ts
────────────────────────────────────────
Define all interfaces listed in the blueprint above.
Key requirement: RawTreeNode.type MUST be 'file' | 'folder' (NOT isDirectory: boolean).
Include FileExplorerEvent interface with fields: type, path, newPath?, projectId, ts.

────────────────────────────────────────
FILE 2: server/file-explorer/config.ts
────────────────────────────────────────
Export a single FE_CONFIG constant of type FileExplorerConfig.
Read from process.env.AGENT_PROJECT_ROOT for sandboxRoot.
Defaults: excludePatterns = ['node_modules', 'dist', '.cache', '.git', '.nura'], maxUploadSizeMb = 50, maxReadSizeBytes = 5242880, showHidden = false.

────────────────────────────────────────
FILE 3: server/file-explorer/guards/path.guard.ts
────────────────────────────────────────
Export three functions:

  assertSafePath(absPath: string, sandboxRoot: string): void
    Throws Error('Path traversal denied') if absPath does not start with sandboxRoot.

  resolveSafe(rel: string, sandboxRoot: string): string
    Strips leading slashes from rel, resolves to absolute path, calls assertSafePath, returns absolute path.

  isExcluded(name: string, patterns: string[]): boolean
    Returns true if name matches any pattern exactly OR starts with '.'.

────────────────────────────────────────
FILE 4: server/file-explorer/services/tree.service.ts
────────────────────────────────────────
Export:

  buildTree(absDir: string, cfg: FileExplorerConfig): RawTreeNode[]
    Recursively reads absDir.
    Uses isExcluded() to skip entries.
    Folders: { name, type: 'folder', children: buildTree(child) }
    Files:   { name, type: 'file', size: stat.size, mtime: stat.mtimeMs }
    Sort: folders first, then alphabetically within type.
    Returns [] if absDir does not exist.

  statNode(absPath: string): FileStatResult
    Returns { ok, size, mtime, isDir } from fs.statSync.
    Returns { ok: false, error } if not found.

  countNodes(tree: RawTreeNode[]): { files: number; folders: number }
    Recursively counts files and folders in a tree.

────────────────────────────────────────
FILE 5: server/file-explorer/services/read.service.ts
────────────────────────────────────────
Export:

  readFile(absPath: string, cfg: FileExplorerConfig): FileReadResult
    - If file does not exist: return { ok: false, error: 'File not found' }
    - If file size > cfg.maxReadSizeBytes: return { ok: false, error: 'File too large' }
    - Detect binary: read first 8KB, check for null bytes → return { ok: false, error: 'Binary file' }
    - Read as utf-8; fallback to latin1 if utf-8 decode fails
    - Return { ok: true, content, serverMtime, modifiedAt (ISO string), encoding }

────────────────────────────────────────
FILE 6: server/file-explorer/services/write.service.ts
────────────────────────────────────────
Export:

  saveFile(absPath: string, content: string, clientMtime?: number): FileSaveResult
    - If clientMtime provided AND file exists: check |serverMtime - clientMtime| > 1000ms
      → if conflict: return { ok: false, conflict: true, serverMtime }
    - fs.mkdirSync(dirname(absPath), { recursive: true })
    - fs.writeFileSync(absPath, content, 'utf-8')
    - Return { ok: true, serverMtime: stat(absPath).mtimeMs }
    - Catch any error: return { ok: false, error: e.message }

────────────────────────────────────────
FILE 7: server/file-explorer/services/rename.service.ts
────────────────────────────────────────
Export:

  renameEntry(absOld: string, absNew: string): FileRenameResult
    - If absOld does not exist: return { ok: false, error: 'Source not found' }
    - fs.mkdirSync(dirname(absNew), { recursive: true })
    - fs.renameSync(absOld, absNew)
    - Return { ok: true }
    - Catch: return { ok: false, error }

────────────────────────────────────────
FILE 8: server/file-explorer/services/delete.service.ts
────────────────────────────────────────
Export:

  deleteEntry(absPath: string): FileDeleteResult
    - If not exists: return { ok: false, error: 'Not found' }
    - If directory: fs.rmSync(absPath, { recursive: true, force: true })
    - If file: fs.unlinkSync(absPath)
    - Return { ok: true }
    - Catch: return { ok: false, error }

────────────────────────────────────────
FILE 9: server/file-explorer/services/duplicate.service.ts
────────────────────────────────────────
Export:

  duplicateEntry(absSrc: string, absDest: string): FileDuplicateResult
    - If absSrc does not exist: return { ok: false, error: 'Source not found' }
    - Recursive copy helper:
        If file: mkdirSync(dirname(dest), recursive) then copyFileSync(src, dest)
        If dir: mkdirSync(dest, recursive), then for each entry: recurse
    - Return { ok: true, destPath: absDest }
    - Catch: return { ok: false, error }

────────────────────────────────────────
FILE 10: server/file-explorer/services/upload.service.ts
────────────────────────────────────────
Export:

  uploadFiles(files: Express.Multer.File[], cfg: FileExplorerConfig): FileUploadResult
    For each file:
      - dest = resolveSafe(file.originalname, cfg.sandboxRoot)
      - mkdirSync(dirname(dest), recursive)
      - writeFileSync(dest, file.buffer)
      - Push to uploaded[] with { originalName, savedPath: dest, size }
    If any file throws: push filename to failed[]
    Return { ok: failed.length === 0, uploaded, failed }

────────────────────────────────────────
FILE 11: server/file-explorer/services/download.service.ts
────────────────────────────────────────
Export:

  async downloadZip(absPath: string): Promise<{ ok: boolean; buffer?: Buffer; filename: string; mimeType: string; error?: string }>
    - dynamic import('archiver') — lazy load
    - archive.directory(absPath, false)
    - Collect chunks, return Buffer.concat(chunks)
    - filename = 'project-files.zip', mimeType = 'application/zip'
    - Catch: return { ok: false, filename: '', mimeType: '', error }

────────────────────────────────────────
FILE 12: server/file-explorer/services/search.service.ts
────────────────────────────────────────
Export:

  searchInFiles(query: string, absRoot: string, cfg: FileExplorerConfig): FileSearchResult
    - Walk all files recursively (skip excludePatterns, skip hidden unless showHidden)
    - For each file: read content (skip binary, skip > 512KB)
    - Split by lines, search each line for query (case-insensitive substring match)
    - Collect up to 200 total matches across all files
    - Return { ok: true, matches: FileSearchMatch[], total }
    - FileSearchMatch: { path (relative), line, column, text (the line), preview (trimmed) }

────────────────────────────────────────
FILE 13: server/file-explorer/events/file-explorer.events.ts
────────────────────────────────────────
Export:

  emitExplorerEvent(event: FileExplorerEvent): void
    - Calls sseManager.publish(TOPIC.FILE, event)
    - Wraps in try/catch, logs error to console.error on failure

  emitCreated(projectId: number, path: string): void
  emitModified(projectId: number, path: string): void
  emitDeleted(projectId: number, path: string): void
  emitRenamed(projectId: number, path: string, newPath: string): void

Each helper builds the FileExplorerEvent and calls emitExplorerEvent.

────────────────────────────────────────
FILE 14: server/file-explorer/watcher/file-watcher.ts
────────────────────────────────────────
Export:

  startFileWatcher(sandboxRoot: string): void
    - Dynamic import('chokidar')
    - Watch sandboxRoot with: ignored = /node_modules|\.git|\.cache/, persistent = true, ignoreInitial = true
    - On 'add'    → emitCreated(0, relativePath)
    - On 'change' → emitModified(0, relativePath)
    - On 'unlink' → emitDeleted(0, relativePath)
    Note: projectId is 0 for watcher events (global sandbox, no project context)
    Store watcher instance in module-level variable.

  stopFileWatcher(): void
    - If watcher instance exists: await watcher.close()
    - Set instance to null

────────────────────────────────────────
FILE 15: server/file-explorer/controller/file-explorer.controller.ts
────────────────────────────────────────
Implement FileExplorerController class with methods:

  listFiles(req, res):
    query.projectPath (optional) → resolveSafe or use sandboxRoot
    → buildTree(abs, cfg) → res.json({ ok: true, tree })

  readFile(req, res):
    query.filePath (required, 400 if missing)
    → resolveSafe(filePath) → readFile(abs, cfg)
    → if result.ok: res.json(result), else res.status(404/500).json(result)

  saveFile(req, res):
    body.filePath (required, 400), body.content, body.clientMtime?
    → resolveSafe → saveFile(abs, content, clientMtime)
    → if conflict: res.status(409).json(result)
    → if ok: emitModified(0, filePath) → res.json(result)

  renameFile(req, res):
    body.oldPath, body.newPath (both required, 400 if missing)
    → resolveSafe both → renameEntry(absOld, absNew)
    → if ok: emitRenamed(0, oldPath, newPath) → res.json(result)

  deleteFile(req, res):
    body.targetPath (required, 400)
    → resolveSafe → deleteEntry(abs)
    → if ok: emitDeleted(0, targetPath) → res.json(result)

  duplicateFile(req, res):
    body.sourcePath, body.destPath (both required)
    → resolveSafe both → duplicateEntry(absSrc, absDest)
    → if ok: emitCreated(0, destPath) → res.json(result)

  statFile(req, res):
    query.path (required, 400)
    → resolveSafe → statNode(abs) → res.json(result)

  uploadFiles(req, res):
    req.files as Express.Multer.File[]
    → uploadFiles(files, cfg)
    → emit created for each uploaded file
    → res.json(result)

  downloadZip(req, res):
    → await downloadZip(cfg.sandboxRoot)
    → set Content-Type, Content-Disposition, Content-Length headers
    → res.send(buffer)

  searchFiles(req, res):
    query.q (required, 400), query.projectPath (optional)
    → searchInFiles(query, abs, cfg) → res.json(result)

  healthCheck(req, res):
    → res.json({ ok: true, module: 'file-explorer', sandboxRoot: cfg.sandboxRoot })

────────────────────────────────────────
FILE 16: server/file-explorer/router/file-explorer.router.ts
────────────────────────────────────────
Create Express Router.
Mount multer for upload route (memoryStorage, 50MB limit).
Register all 11 routes as listed in the route table.
Bind controller methods correctly (use .bind(ctrl)).
Export as fileExplorerRouter.

────────────────────────────────────────
FILE 17: server/file-explorer/index.ts
────────────────────────────────────────
Public barrel. Export:
  - fileExplorerRouter from router/file-explorer.router.ts
  - startFileWatcher, stopFileWatcher from watcher/file-watcher.ts
  - All types from types.ts (use export type { ... })
DO NOT re-export internal modules (guards, services, events, controller).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AFTER BUILDING THE MODULE — INTEGRATION STEPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1: Edit server/preview/index.ts
  - Add import: import { fileExplorerRouter, startFileWatcher } from '../file-explorer/index.ts';
  - Add to PIPELINE_STAGES array: { name: 'file-explorer', router: fileExplorerRouter, mountPath: '/' }
  - After pipeline.boot() call: startFileWatcher(process.env.AGENT_PROJECT_ROOT ?? '.sandbox');

STEP 2: Edit server/preview/files/files.router.ts
  - DELETE these 6 inline route handlers and their helpers:
      GET  /api/list-files
      GET  /api/read-file
      POST /api/save-file
      POST /api/rename-file
      POST /api/delete-file
      POST /api/duplicate-file
  - DELETE inline helpers: safePath(), buildTree(), cpRecursive(), SANDBOX_ROOT, EXCLUDE
  - Keep the old /api/files/* routes (listFiles, createFile, uploadFiles, downloadZip, deleteFile, statFile, healthCheck)
    so existing consumers are not broken.

STEP 3: Verify no TypeScript errors
  - Run: npx tsc --noEmit
  - Fix any import path or type issues

STEP 4: Test each endpoint with curl:
  curl "http://localhost:3001/api/list-files"
  curl "http://localhost:3001/api/fe/health"
  curl -X POST "http://localhost:3001/api/save-file" -H "Content-Type: application/json" -d '{"filePath":"test.txt","content":"hello"}'
  curl "http://localhost:3001/api/read-file?filePath=test.txt"
  curl -X POST "http://localhost:3001/api/rename-file" -H "Content-Type: application/json" -d '{"oldPath":"test.txt","newPath":"test2.txt"}'
  curl -X POST "http://localhost:3001/api/delete-file" -H "Content-Type: application/json" -d '{"targetPath":"test2.txt"}'

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUALITY CHECKLIST (verify before marking complete)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[ ] All 17 files created
[ ] Every file ≤ 200 lines
[ ] Every service function returns { ok, error? } — never throws
[ ] assertSafePath called in controller before EVERY service call
[ ] SSE event emitted after EVERY successful mutation (save/rename/delete/duplicate/upload)
[ ] sseManager.publish(TOPIC.FILE, event) used — NOT bus.emit('agent.event', ...)
[ ] No import from server/agents/filesystem/ or any tool-loop module
[ ] No import from sub-modules of server/file-explorer/ by external consumers
[ ] index.ts exports only: fileExplorerRouter, startFileWatcher, stopFileWatcher, types
[ ] Old inline routes removed from server/preview/files/files.router.ts
[ ] TypeScript noEmit check passes
[ ] All 11 endpoints respond correctly to curl tests
```

---

## APPENDIX — Type Alignment Reference

### Frontend Type (what frontend sends / expects)
```typescript
// client/src/components/file-explorer/types.ts
interface RawTreeNode {
  name:      string;
  type:      'file' | 'folder';   // ← CRITICAL: NOT isDirectory
  children?: RawTreeNode[];
}

// Calls these APIs:
GET  /api/list-files?projectPath=    → { ok: true, tree: RawTreeNode[] }
GET  /api/read-file?filePath=        → { ok: true, content, serverMtime, modifiedAt }
POST /api/save-file                  → { ok: true, serverMtime } | { ok: false, error, serverMtime? }
POST /api/rename-file                → { ok: true } | { ok: false, error }
POST /api/delete-file                → { ok: true } | { ok: false, error }
POST /api/duplicate-file             → { ok: true } | { ok: false, error }
GET  /api/files/stat?path=           → { ok: true, size, mtime }
```

### Current Backend Type (mismatch)
```typescript
// server/preview/files/files.types.ts
interface FileItem {
  isDirectory: boolean;  // ← WRONG: frontend expects type: 'file' | 'folder'
  path:        string;   // ← relative path
}

GET /api/files/list → { ok, files: FileItem[], total }  // ← WRONG shape (files not tree)
```

### New Backend Type (correct)
```typescript
// server/file-explorer/types.ts
interface RawTreeNode {
  name:      string;
  type:      'file' | 'folder';  // ← matches frontend exactly
  children?: RawTreeNode[];
  size?:     number;
  mtime?:    number;
}
```
