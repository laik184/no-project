# FORENSIC ARCHITECTURE AUDIT REPORT
## Nura-X Deployer — File Explorer System
### Principal Software Architect Deep Scan

---

```
Audit Scope:
  server/tools/filesystem/
  server/file-explorer/services/
  server/file-explorer/repositories/
  server/infrastructure/

Method: ACTUAL CODE EVIDENCE ONLY
        No assumptions. No summaries. Line numbers shown.
```

---

## PHASE 1 — ALL FILESYSTEM TOOLS SCAN

**Total tools found: 40**

### GROUP A — Tools wired to Service layer ✅

| Tool | File | Import (line) | Dependency Chain |
|---|---|---|---|
| `fs_find_imports` | `search/find-imports.ts` | `dependencyAnalysisService` (L13) | Tool → dependencyAnalysisService → filesystemRepository → fs |
| `fs_find_exports` | `search/find-exports.ts` | `dependencyAnalysisService` (L13) | Tool → dependencyAnalysisService → filesystemRepository → fs |
| `fs_find_symbol_usages` | `search/find-symbol-usages.ts` | `dependencyAnalysisService` (L13) | Tool → dependencyAnalysisService → filesystemRepository → fs |
| `fs_scan_folder` | `structure/scan-folder.ts` | `scannerService` (L13) | Tool → scannerService → filesystemRepository → fs |
| `fs_scan_by_extension` | `structure/scan-extension.ts` | `scannerService` (L13) | Tool → scannerService → filesystemRepository → fs |

### GROUP B — Tools bypassing Service layer ❌

All 35 tools below import from `lib/` directly, skipping the service/repository layers.

| # | Tool | File | Direct lib/ Import (L8) | Broken Chain |
|---|---|---|---|---|
| 1 | `fs_read_file` | `read/read-file.ts` | `lib/files/file-reader.ts` | Tool → lib → node:fs |
| 2 | `fs_read_lines` | `read/read-lines.ts` | `lib/files/file-reader.ts` | Tool → lib → node:fs |
| 3 | `fs_read_folder` | `read/read-folder.ts` | `lib/folders/folder-reader.ts` | Tool → lib → node:fs |
| 4 | `fs_file_metadata` | `read/file-metadata.ts` | `lib/files/file-reader.ts` | Tool → lib → node:fs |
| 5 | `fs_write_file` | `write/write-file.ts` | `lib/files/file-writer.ts` | Tool → lib → node:fs |
| 6 | `fs_append_file` | `write/append-file.ts` | `lib/files/file-editor.ts` | Tool → lib → node:fs |
| 7 | `fs_ensure_file` | `write/ensure-file.ts` | `lib/files/file-writer.ts` | Tool → lib → node:fs |
| 8 | `fs_write_if_absent` | `write/write-if-absent.ts` | `lib/files/file-writer.ts` | Tool → lib → node:fs |
| 9 | `fs_patch_file` | `edit/patch-file.ts` | `lib/files/patch-file.ts` | Tool → lib → node:fs |
| 10 | `fs_patch_all` | `edit/patch-all.ts` | `lib/files/patch-file.ts` | Tool → lib → node:fs |
| 11 | `fs_replace_line` | `edit/replace-line.ts` | `lib/files/file-editor.ts` | Tool → lib → node:fs |
| 12 | `fs_insert_at` | `edit/insert-at.ts` | `lib/files/file-editor.ts` | Tool → lib → node:fs |
| 13 | `fs_replace_all` | `edit/replace-all.ts` | `lib/files/file-editor.ts` | Tool → lib → node:fs |
| 14 | `fs_delete_file` | `delete/delete-file.ts` | `lib/files/file-deleter.ts` | Tool → lib → node:fs |
| 15 | `fs_delete_folder` | `delete/delete-folder.ts` | `lib/folders/folder-deleter.ts` | Tool → lib → node:fs |
| 16 | `fs_delete_multiple` | `delete/delete-multiple.ts` | `lib/files/file-deleter.ts` | Tool → lib → node:fs |
| 17 | `fs_move_file` | `move/move-file.ts` | `lib/files/file-mover.ts` | Tool → lib → node:fs |
| 18 | `fs_move_folder` | `move/move-folder.ts` | `lib/folders/folder-mover.ts` | Tool → lib → node:fs |
| 19 | `fs_rename_file` | `move/rename-file.ts` | `lib/files/file-renamer.ts` | Tool → lib → node:fs |
| 20 | `fs_rename_folder` | `move/rename-folder.ts` | `lib/folders/folder-renamer.ts` | Tool → lib → node:fs |
| 21 | `fs_clone_file` | `clone/clone-file.ts` | `lib/files/file-cloner.ts` | Tool → lib → node:fs |
| 22 | `fs_clone_folder` | `clone/clone-folder.ts` | `lib/folders/folder-cloner.ts` | Tool → lib → node:fs |
| 23 | `fs_create_folder` | `folders/create-folder.ts` | `lib/folders/folder-creator.ts` | Tool → lib → node:fs |
| 24 | `fs_create_folders` | `folders/create-folders.ts` | `lib/folders/folder-creator.ts` | Tool → lib → node:fs |
| 25 | `fs_folder_entries` | `folders/folder-entries.ts` | `lib/folders/folder-reader.ts` | Tool → lib → node:fs |
| 26 | `fs_folder_names` | `folders/folder-names.ts` | `lib/folders/folder-reader.ts` | Tool → lib → node:fs |
| 27 | `fs_subfolder_entries` | `folders/subfolder-entries.ts` | `lib/folders/folder-reader.ts` | Tool → lib → node:fs |
| 28 | `fs_file_entries` | `folders/file-entries.ts` | `lib/folders/folder-reader.ts` | Tool → lib → node:fs |
| 29 | `fs_search_text` | `search/search-text.ts` | `lib/search/text-search.ts` | Tool → lib → node:fs |
| 30 | `fs_search_regex` | `search/search-regex.ts` | `lib/search/regex-search.ts` | Tool → lib → node:fs |
| 31 | `fs_find_by_name` | `search/find-by-name.ts` | `lib/search/file-search.ts` | Tool → lib → node:fs |
| 32 | `fs_find_by_extension` | `search/find-by-extension.ts` | `lib/search/file-search.ts` | Tool → lib → node:fs |
| 33 | `fs_find_by_pattern` | `search/find-by-pattern.ts` | `lib/search/file-search.ts` | Tool → lib → node:fs |
| 34 | `fs_ascii_tree` | `structure/ascii-tree.ts` | `lib/folders/folder-structure.ts` | Tool → lib → node:fs |
| 35 | `fs_folder_structure` | `structure/folder-structure.ts` | `lib/folders/folder-structure.ts` | Tool → lib → node:fs |

---

## PHASE 2 — CRITICAL TOOLS VERIFICATION

### `fs_find_imports`
```
File: server/tools/filesystem/search/find-imports.ts
Line 13: import { dependencyAnalysisService } from '../../../file-explorer/services/dependency-analysis/index.ts';

CLASSIFICATION: ✅ WIRED
```

### `fs_find_exports`
```
File: server/tools/filesystem/search/find-exports.ts
Line 13: import { dependencyAnalysisService } from '../../../file-explorer/services/dependency-analysis/index.ts';

CLASSIFICATION: ✅ WIRED
```

### `fs_find_symbol_usages`
```
File: server/tools/filesystem/search/find-symbol-usages.ts
Line 13: import { dependencyAnalysisService } from '../../../file-explorer/services/dependency-analysis/index.ts';

CLASSIFICATION: ✅ WIRED
```

### `fs_scan_folder`
```
File: server/tools/filesystem/structure/scan-folder.ts
Line 13: import { scannerService } from '../../../file-explorer/services/scanner/index.ts';

CLASSIFICATION: ✅ WIRED
```

### `fs_scan_by_extension`
```
File: server/tools/filesystem/structure/scan-extension.ts
Line 13: import { scannerService } from '../../../file-explorer/services/scanner/index.ts';

CLASSIFICATION: ✅ WIRED
```

---

## PHASE 3 — SERVICES SCAN

**Total services: 20**

### readService
```
File: server/file-explorer/services/read/read.service.ts
Imports:
  L6:  FE_CONFIG              (config)
  L7:  resolveSafe            (guard)
  L8:  filesystemRepository   (repository) ✅
  L9:  hasBinaryContent, decodeBuffer (utils)
Chain: readService → filesystemRepository → fs
```

### writeService
```
File: server/file-explorer/services/write/write.service.ts
Imports:
  L6:  resolveSafe            (guard)
  L7:  filesystemRepository   (repository) ✅
  L8:  metadataRepository     (repository) ✅
Chain: writeService → filesystemRepository → fs
                    → metadataRepository  → in-memory LRU
```

### createService
```
File: server/file-explorer/services/create/create.service.ts
Imports:
  L6:  resolveSafe            (guard)
  L7:  filesystemRepository   (repository) ✅
  L8:  FE_CONFIG              (config)
Chain: createService → filesystemRepository → fs
```

### deleteService
```
File: server/file-explorer/services/delete/delete.service.ts
Imports:
  L6:  resolveSafe            (guard)
  L7:  filesystemRepository   (repository) ✅
  L8:  metadataRepository     (repository) ✅
Chain: deleteService → filesystemRepository → fs
                     → metadataRepository  → in-memory LRU
```

### renameService
```
File: server/file-explorer/services/rename/rename.service.ts
Imports:
  L6:  resolveSafe            (guard)
  L7:  filesystemRepository   (repository) ✅
  L8:  metadataRepository     (repository) ✅
Chain: renameService → filesystemRepository → fs
                     → metadataRepository  → in-memory LRU
```

### duplicateService
```
File: server/file-explorer/services/duplicate/duplicate.service.ts
Imports:
  L6:  path (Node built-in — path resolution only, no I/O)
  L7:  resolveSafe            (guard)
  L8:  filesystemRepository   (repository) ✅
  L9:  metadataRepository     (repository) ✅
  L10: duplicateName, toRelative (utils)
Chain: duplicateService → filesystemRepository → fs
                        → metadataRepository  → in-memory LRU
NOTE: import path from 'path' — ACCEPTABLE (path arithmetic, zero I/O)
```

### searchService
```
File: server/file-explorer/services/search/search.service.ts
Imports:
  L7:  FE_CONFIG              (config)
  L8:  resolveSafe            (guard)
  L9:  filesystemRepository   (repository) ✅
  L10: hasBinaryContent, decodeBuffer (utils)
Chain: searchService → filesystemRepository → fs
```

### treeService  ⚠️
```
File: server/file-explorer/services/tree/tree.service.ts
Imports:
  L6:  path (Node built-in)
  L7:  FE_CONFIG              (config)
  L8:  resolveSafe            (guard)
  L9:  buildTreeFromDir       (MAPPER — not a repository) ⚠️
  L10: countNodes             (utils)
Chain: treeService → buildTreeFromDir (mapper) → ???
ISSUE: No filesystemRepository import.
       buildTreeFromDir is a mapper in file-explorer/mappers/ — unknown if it
       calls fs directly. Repository layer is BYPASSED at the service level.
CLASSIFICATION: ⚠️ PARTIAL
```

### metadataService
```
File: server/file-explorer/services/metadata/metadata.service.ts
Imports:
  L6:  resolveSafe            (guard)
  L7:  filesystemRepository   (repository) ✅
  L8:  metadataRepository     (repository) ✅
Chain: metadataService → filesystemRepository → fs
                       → metadataRepository  → in-memory LRU
```

### historyService
```
File: server/file-explorer/services/history/history.service.ts
Imports:
  L6:  historyRepository   (repository) ✅
  L7:  readService         (service — for snapshot reads)
  L8:  writeService        (service — for snapshot writes)
Chain: historyService → historyRepository → fs
                      → readService       → filesystemRepository → fs
                      → writeService      → filesystemRepository → fs
NOTE: Service-to-service delegation is acceptable here (undo/snapshot logic).
```

### clipboardService
```
File: server/file-explorer/services/clipboard/clipboard.service.ts
Imports:
  L9:  duplicateService  (service)
  L10: renameService     (service)
  L11: path (Node built-in — path arithmetic only)
Chain: clipboardService → duplicateService → filesystemRepository → fs
                        → renameService   → filesystemRepository → fs
NOTE: Orchestrator service — delegates entirely to other services. VALID.
```

### gitStatusService  ⚠️
```
File: server/file-explorer/services/git-status/git-status.service.ts
Imports:
  L7:  execSync from 'child_process'  ⚠️ DIRECT PROCESS ACCESS
  L8:  FE_CONFIG (config)

Line 26:
  const raw = execSync('git status --short', { cwd: FE_CONFIG.sandboxRoot, timeout: 5000 });

Chain: gitStatusService → child_process.execSync → OS process
ISSUE: No repository layer. Service calls child_process directly.
       There is no gitRepository to encapsulate the process call.
CLASSIFICATION: ⚠️ WARNING — no repository abstraction
```

### insightsService
```
File: server/file-explorer/services/insights/insights.service.ts
Imports:
  L7:  FE_CONFIG              (config)
  L8:  filesystemRepository   (repository) ✅
  L9:  getExtension           (utils)
Chain: insightsService → filesystemRepository → fs
```

### downloadService  ⚠️
```
File: server/file-explorer/services/download/download.service.ts
Imports:
  L6:  FE_CONFIG   (config)
  L7:  resolveSafe (guard)
  L8:  zipDirectory from '../../utils/index.ts'  — utility, NOT a repository

Chain: downloadService → zipDirectory (util) → ???
ISSUE: zipDirectory is a utility function — it likely performs fs I/O internally.
       Repository layer is not present.
CLASSIFICATION: ⚠️ PARTIAL
```

### uploadService
```
File: server/file-explorer/services/upload/upload.service.ts
Imports:
  L6:  resolveSafe            (guard)
  L7:  filesystemRepository   (repository) ✅
  L8:  toUploadedFile         (mapper)
Chain: uploadService → filesystemRepository → fs
```

### openEditorsService
```
File: server/file-explorer/services/open-editors/open-editors.service.ts
Imports:
  L6:  editorsRepository   (repository) ✅
Chain: openEditorsService → editorsRepository → fs
```

### pinnedService
```
File: server/file-explorer/services/pinned/pinned.service.ts
Imports:
  L6:  pinnedRepository   (repository) ✅
Chain: pinnedService → pinnedRepository → fs
```

### recentService
```
File: server/file-explorer/services/recent/recent.service.ts
Imports:
  L6:  recentRepository   (repository) ✅
Chain: recentService → recentRepository → fs
```

### dependencyAnalysisService  ✅
```
File: server/file-explorer/services/dependency-analysis/dependency-analysis.service.ts
Imports:
  L18: path (Node built-in — path arithmetic only)
  L19: FE_CONFIG              (config)
  L20: resolveSafe            (guard)
  L21: filesystemRepository   (repository) ✅
Chain: dependencyAnalysisService → filesystemRepository → fs
NOTE: No direct node:fs usage confirmed (verified via grep — zero results).
```

### scannerService  ✅
```
File: server/file-explorer/services/scanner/scanner.service.ts
Imports:
  L18: FE_CONFIG              (config)
  L19: resolveSafe            (guard)
  L20: filesystemRepository   (repository) ✅
Chain: scannerService → filesystemRepository → fs
NOTE: No direct node:fs usage confirmed (verified via grep — zero results).
```

---

## PHASE 4 — SERVICE → REPOSITORY VERIFICATION

| Service | Imports Repository? | Repository Name(s) | Evidence |
|---|---|---|---|
| readService | ✅ YES | filesystemRepository | L8: `import { filesystemRepository } from '../../repositories/index.ts'` |
| writeService | ✅ YES | filesystemRepository, metadataRepository | L7-L8 |
| createService | ✅ YES | filesystemRepository | L7 |
| deleteService | ✅ YES | filesystemRepository, metadataRepository | L7-L8 |
| renameService | ✅ YES | filesystemRepository, metadataRepository | L7-L8 |
| duplicateService | ✅ YES | filesystemRepository, metadataRepository | L8-L9 |
| searchService | ✅ YES | filesystemRepository | L9 |
| treeService | ⚠️ NO | — | Uses `buildTreeFromDir` mapper. No repository import. |
| metadataService | ✅ YES | filesystemRepository, metadataRepository | L7-L8 |
| historyService | ✅ YES | historyRepository | L6 |
| clipboardService | ✅ YES (indirect) | via duplicateService → filesystemRepository | L9-L10 (service delegation) |
| gitStatusService | ❌ NO | — | Uses child_process.execSync directly (L7, L26) |
| insightsService | ✅ YES | filesystemRepository | L8 |
| downloadService | ⚠️ NO | — | Uses zipDirectory util. No repository import. |
| uploadService | ✅ YES | filesystemRepository | L7 |
| openEditorsService | ✅ YES | editorsRepository | L6 |
| pinnedService | ✅ YES | pinnedRepository | L6 |
| recentService | ✅ YES | recentRepository | L6 |
| dependencyAnalysisService | ✅ YES | filesystemRepository | L21 |
| scannerService | ✅ YES | filesystemRepository | L20 |

---

## PHASE 5 — REPOSITORY AUDIT

### filesystemRepository
```
File: server/file-explorer/repositories/filesystem.repository.ts
Imports:
  L7:  import fs from 'fs'          ← node:fs VALID (repository layer is the correct place)
  L8:  import path from 'path'
  L9:  FileStat, FileEntry (types)
  L10: isExcluded (guard)
  L11: FE_CONFIG (config)

Infrastructure used: node:fs (synchronous API)
Methods exposed: stat(), readText(), readBuffer(), saveText(), saveBinary(),
                 copy(), move(), remove(), readDir(), *walkFiles()

Chain:
  filesystemRepository
    ↓
  node:fs (synchronous reads/writes via fs.statSync, fs.readFileSync, etc.)
```

### metadataRepository
```
File: server/file-explorer/repositories/metadata.repository.ts
Imports:
  L7:  FileStat (type only — no fs import)

Infrastructure used: IN-MEMORY LRU Map (no disk persistence — pure in-process cache)

Chain:
  metadataRepository
    ↓
  JavaScript Map / in-memory cache
```

### historyRepository
```
File: server/file-explorer/repositories/history.repository.ts
Imports:
  L7:  import fs from 'fs'          ← node:fs VALID
  L8:  import path from 'path'
  L9:  HistoryEntry (type)
  L10: FE_CONFIG (config)
  L11: makeHistoryId (util)

Infrastructure used: node:fs — persists history as JSON files on disk

Chain:
  historyRepository
    ↓
  node:fs → JSON files on disk
```

### pinnedRepository
```
File: server/file-explorer/repositories/pinned.repository.ts
Imports:
  L6:  import fs from 'fs'          ← node:fs VALID
  L7:  import path from 'path'
  L8:  FE_CONFIG (config)

Infrastructure used: node:fs — persists pinned list as JSON

Chain:
  pinnedRepository
    ↓
  node:fs → JSON file on disk
```

### recentRepository
```
File: server/file-explorer/repositories/recent.repository.ts
Imports:
  L6:  import fs from 'fs'          ← node:fs VALID
  L7:  import path from 'path'
  L8:  FE_CONFIG (config)

Infrastructure used: node:fs — persists recent files list as JSON

Chain:
  recentRepository
    ↓
  node:fs → JSON file on disk
```

### editorsRepository
```
File: server/file-explorer/repositories/editors.repository.ts
Imports:
  L6:  import fs from 'fs'          ← node:fs VALID
  L7:  import path from 'path'
  L8:  FE_CONFIG (config)

Infrastructure used: node:fs — persists open editors state as JSON

Chain:
  editorsRepository
    ↓
  node:fs → JSON file on disk
```

---

## PHASE 6 — DIRECT ACCESS VIOLATIONS

### Scan: server/tools/filesystem/ (EXCLUDING lib/)

```
Command: grep -rn "node:fs|'fs'|from 'fs'" server/tools/filesystem/ --exclude lib/

RESULT: ZERO MATCHES ✅

No tool file (outside lib/) directly imports node:fs, fs, or fs/promises.
```

### Scan: server/file-explorer/services/

```
VIOLATION FOUND:

File: server/file-explorer/services/git-status/git-status.service.ts
  L7:  import { execSync } from 'child_process';
  L26: const raw = execSync('git status --short', { cwd: FE_CONFIG.sandboxRoot, timeout: 5000 });

CLASSIFICATION: ⚠️ WARNING
Severity: MEDIUM
Reason: Service calls child_process directly. No repository exists to encapsulate
        the git subprocess call. Architecture rule 5 says services must not perform
        persistence directly — a git call IS a form of external system access.
        Mitigation: gitRepository should wrap execSync.

All other service files: ZERO fs/child_process imports ✅
```

### Scan: lib/ (for baseline — these ARE the infrastructure violations)

```
Files that use node:fs inside lib/:
  lib/files/file-mover.ts      L1: import { promises as fs } from 'node:fs'
  lib/files/file-renamer.ts    L1: import { promises as fs } from 'node:fs'
  lib/folders/folder-mover.ts  L1: import { promises as fs } from 'node:fs'
  lib/folders/folder-renamer.ts L1: import { promises as fs } from 'node:fs'
  lib/utils/filesystem-utils.ts L1: import { promises as fs, constants as fsConstants } from 'node:fs'
  lib/workspace/snapshot-manager.ts  L1: import { promises as fs } from 'node:fs'
  lib/workspace/workspace-history.ts L3: import { promises as fs } from 'node:fs'
  lib/workspace/workspace-manager.ts L1: import { promises as fs } from 'node:fs'

STATUS: These lib/ files act as an undocumented pseudo-infrastructure layer.
        35 tools call these lib/ functions, bypassing services and repositories.
```

---

## PHASE 7 — IMPORT GRAPH

### CLEAN chains (5 tools — fully wired)

```
fs_find_imports
  └─ dependencyAnalysisService  (services/dependency-analysis/dependency-analysis.service.ts)
       └─ filesystemRepository  (repositories/filesystem.repository.ts)
            └─ node:fs          (Node.js built-in)

fs_find_exports
  └─ dependencyAnalysisService  (same as above)
       └─ filesystemRepository → node:fs

fs_find_symbol_usages
  └─ dependencyAnalysisService  (same as above)
       └─ filesystemRepository → node:fs

fs_scan_folder
  └─ scannerService             (services/scanner/scanner.service.ts)
       └─ filesystemRepository  (repositories/filesystem.repository.ts)
            └─ node:fs

fs_scan_by_extension
  └─ scannerService             (same as above)
       └─ filesystemRepository → node:fs
```

### BROKEN chains (35 tools — bypass service layer)

```
fs_read_file          → lib/files/file-reader.ts     → node:fs  [BYPASSES SERVICES]
fs_read_lines         → lib/files/file-reader.ts     → node:fs  [BYPASSES SERVICES]
fs_read_folder        → lib/folders/folder-reader.ts → node:fs  [BYPASSES SERVICES]
fs_file_metadata      → lib/files/file-reader.ts     → node:fs  [BYPASSES SERVICES]
fs_write_file         → lib/files/file-writer.ts     → node:fs  [BYPASSES SERVICES]
fs_append_file        → lib/files/file-editor.ts     → node:fs  [BYPASSES SERVICES]
fs_ensure_file        → lib/files/file-writer.ts     → node:fs  [BYPASSES SERVICES]
fs_write_if_absent    → lib/files/file-writer.ts     → node:fs  [BYPASSES SERVICES]
fs_patch_file         → lib/files/patch-file.ts      → node:fs  [BYPASSES SERVICES]
fs_patch_all          → lib/files/patch-file.ts      → node:fs  [BYPASSES SERVICES]
fs_replace_line       → lib/files/file-editor.ts     → node:fs  [BYPASSES SERVICES]
fs_insert_at          → lib/files/file-editor.ts     → node:fs  [BYPASSES SERVICES]
fs_replace_all        → lib/files/file-editor.ts     → node:fs  [BYPASSES SERVICES]
fs_delete_file        → lib/files/file-deleter.ts    → node:fs  [BYPASSES SERVICES]
fs_delete_folder      → lib/folders/folder-deleter.ts→ node:fs  [BYPASSES SERVICES]
fs_delete_multiple    → lib/files/file-deleter.ts    → node:fs  [BYPASSES SERVICES]
fs_move_file          → lib/files/file-mover.ts      → node:fs  [BYPASSES SERVICES]
fs_move_folder        → lib/folders/folder-mover.ts  → node:fs  [BYPASSES SERVICES]
fs_rename_file        → lib/files/file-renamer.ts    → node:fs  [BYPASSES SERVICES]
fs_rename_folder      → lib/folders/folder-renamer.ts→ node:fs  [BYPASSES SERVICES]
fs_clone_file         → lib/files/file-cloner.ts     → node:fs  [BYPASSES SERVICES]
fs_clone_folder       → lib/folders/folder-cloner.ts → node:fs  [BYPASSES SERVICES]
fs_create_folder      → lib/folders/folder-creator.ts→ node:fs  [BYPASSES SERVICES]
fs_create_folders     → lib/folders/folder-creator.ts→ node:fs  [BYPASSES SERVICES]
fs_folder_entries     → lib/folders/folder-reader.ts → node:fs  [BYPASSES SERVICES]
fs_folder_names       → lib/folders/folder-reader.ts → node:fs  [BYPASSES SERVICES]
fs_subfolder_entries  → lib/folders/folder-reader.ts → node:fs  [BYPASSES SERVICES]
fs_file_entries       → lib/folders/folder-reader.ts → node:fs  [BYPASSES SERVICES]
fs_search_text        → lib/search/text-search.ts    → node:fs  [BYPASSES SERVICES]
fs_search_regex       → lib/search/regex-search.ts   → node:fs  [BYPASSES SERVICES]
fs_find_by_name       → lib/search/file-search.ts    → node:fs  [BYPASSES SERVICES]
fs_find_by_extension  → lib/search/file-search.ts    → node:fs  [BYPASSES SERVICES]
fs_find_by_pattern    → lib/search/file-search.ts    → node:fs  [BYPASSES SERVICES]
fs_ascii_tree         → lib/folders/folder-structure.ts→ node:fs [BYPASSES SERVICES]
fs_folder_structure   → lib/folders/folder-structure.ts→ node:fs [BYPASSES SERVICES]
```

---

## PHASE 8 — BROKEN WIRING DETECTION

### Tools Classification

| Status | Count | Tools |
|---|---|---|
| ✅ MATCHED | 5 | find-imports, find-exports, find-symbol-usages, scan-folder, scan-extension |
| ❌ BROKEN | 35 | All remaining tools (go Tool → lib → node:fs) |
| ⚠️ PARTIAL | 0 | — |
| 💀 DEAD | 0 | — |

### Services Classification

| Status | Service | Reason |
|---|---|---|
| ✅ MATCHED | readService | Properly uses filesystemRepository |
| ✅ MATCHED | writeService | Properly uses filesystemRepository + metadataRepository |
| ✅ MATCHED | createService | Properly uses filesystemRepository |
| ✅ MATCHED | deleteService | Properly uses filesystemRepository + metadataRepository |
| ✅ MATCHED | renameService | Properly uses filesystemRepository + metadataRepository |
| ✅ MATCHED | duplicateService | Properly uses filesystemRepository + metadataRepository |
| ✅ MATCHED | searchService | Properly uses filesystemRepository |
| ✅ MATCHED | metadataService | Properly uses filesystemRepository + metadataRepository |
| ✅ MATCHED | historyService | Properly uses historyRepository + delegates to services |
| ✅ MATCHED | clipboardService | Properly delegates to duplicateService + renameService |
| ✅ MATCHED | insightsService | Properly uses filesystemRepository |
| ✅ MATCHED | uploadService | Properly uses filesystemRepository |
| ✅ MATCHED | openEditorsService | Properly uses editorsRepository |
| ✅ MATCHED | pinnedService | Properly uses pinnedRepository |
| ✅ MATCHED | recentService | Properly uses recentRepository |
| ✅ MATCHED | dependencyAnalysisService | Properly uses filesystemRepository |
| ✅ MATCHED | scannerService | Properly uses filesystemRepository |
| ⚠️ PARTIAL | treeService | Uses mapper (buildTreeFromDir) instead of repository |
| ⚠️ PARTIAL | downloadService | Uses utility (zipDirectory) instead of repository |
| ⚠️ WARNING | gitStatusService | Uses child_process.execSync directly — no repository layer |

### Repositories Classification

| Status | Repository | Evidence |
|---|---|---|
| ✅ VALID | filesystemRepository | Imports node:fs — correct at repo layer |
| ✅ VALID | metadataRepository | In-memory LRU — no fs needed |
| ✅ VALID | historyRepository | Imports node:fs — correct at repo layer |
| ✅ VALID | pinnedRepository | Imports node:fs — correct at repo layer |
| ✅ VALID | recentRepository | Imports node:fs — correct at repo layer |
| ✅ VALID | editorsRepository | Imports node:fs — correct at repo layer |

No repository imports a Service or Tool — no circular dependency violations.

---

## PHASE 9 — FINAL SCORE

```
╔══════════════════════════════════════════════════════════════════╗
║                     FORENSIC AUDIT RESULTS                      ║
╠══════════════════════════════════════════════════════════════════╣
║  Total Tools        : 40                                         ║
║  Total Services     : 20                                         ║
║  Total Repositories : 6                                          ║
╠══════════════════════════════════════════════════════════════════╣
║  TOOLS                                                           ║
║    ✅ MATCHED (Tool → Service → Repo → Infra) :  5 / 40  (12%)  ║
║    ❌ BROKEN  (Tool → lib → node:fs direct)  : 35 / 40  (88%)   ║
║    ⚠️ PARTIAL                                :  0 / 40          ║
║    💀 DEAD                                   :  0 / 40          ║
╠══════════════════════════════════════════════════════════════════╣
║  SERVICES                                                        ║
║    ✅ MATCHED (Service → Repository)         : 17 / 20  (85%)   ║
║    ⚠️ PARTIAL (Service bypasses repository)  :  2 / 20  (10%)   ║
║    ⚠️ WARNING (Direct process/fs access)     :  1 / 20   (5%)   ║
╠══════════════════════════════════════════════════════════════════╣
║  REPOSITORIES                                                    ║
║    ✅ VALID (Repo → Infrastructure only)     :  6 / 6  (100%)   ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## FINAL VERDICT

```
⚠️  PARTIAL IMPLEMENTATION
```

**Evidence:**

The system has two co-existing wiring patterns:

**Pattern A — CLEAN** (5 tools):
```
Tool → Service → Repository → node:fs
```
`find-imports`, `find-exports`, `find-symbol-usages`, `scan-folder`, `scan-extension`

**Pattern B — BROKEN** (35 tools):
```
Tool → lib/ → node:fs          [Service and Repository layers absent]
```
Every remaining tool (`read-file`, `write-file`, `delete-file`, etc.) calls
`lib/files/*` or `lib/folders/*` or `lib/search/*` directly, completely
skipping the service and repository layers.

**The `lib/` directory is an undocumented pseudo-infrastructure layer** that
exists outside the declared architecture. It acts as if it were a repository
(it calls node:fs) but is positioned as internal tool logic, not a service or
repository. This creates two competing wiring systems inside the same codebase.

**Additional issues:**
- `gitStatusService` (L7, L26): calls `execSync` from `child_process` directly — no repository abstraction
- `treeService`: calls `buildTreeFromDir` mapper directly — no repository
- `downloadService`: calls `zipDirectory` utility directly — no repository

**To reach ✅ CLEAN ARCHITECTURE:**
35 tools must be rewired to their respective services (readService, writeService,
deleteService, etc.), and those services must be confirmed to route all I/O
through filesystemRepository — eliminating all direct lib/ imports from tool files.
