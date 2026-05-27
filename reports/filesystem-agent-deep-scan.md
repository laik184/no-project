# server/agents/filesystem/ — Deep Scan Report

**Date:** 2025-05-27
**Folder:** `server/agents/filesystem/`
**Total Files:** 19
**Security Model:** Fail-Closed (operation block by default unless validated)
**Purpose:** Yeh subsystem saare file I/O aur sandbox security manage karta hai — Executor Agent ke liye.

---

## Folder Structure Overview

```
server/agents/filesystem/
├── index.ts                        ← Public API Entry Point
│
├── — CORE SERVICES —
├── file-reader.ts                  ← Read operations
├── file-writer.ts                  ← Write/delete operations
├── file-editor.ts                  ← High-level editing (append, replace, insert)
├── patch-file.ts                   ← Surgical string replacement (no full overwrite)
├── safe-delete.ts                  ← Protected deletion with blocklist
├── directory-reader.ts             ← Directory listing with metadata
├── file-search.ts                  ← File tree navigation + literal search
├── grep-search.ts                  ← Advanced regex search
│
├── — MANAGERS —
├── path-manager.ts                 ← Relative → absolute path resolution
├── workspace-manager.ts            ← Project directory init + location
├── isolation-manager.ts            ← Execution context + sandbox root management
├── permission-manager.ts           ← Fail-closed write/execute policy
│
├── — UTILITIES —
├── filesystem-utils.ts             ← Low-level path normalization
├── diff-engine.ts                  ← Line-based text diff utility
│
├── — VALIDATORS —
├── sandbox-validator.ts            ← Boundary checking (absolute + relative paths)
├── replacement-validator.ts        ← Patch/replacement sanity checks
│
└── validation/
    ├── file-integrity.ts           ← Primary integrity checks (traversal, null bytes, size)
    └── command-safety.ts           ← Shell command allowlist validator
```

---

## File-by-File Breakdown

---

### `index.ts`
- **Type:** Entry Point / Manager
- **Kya karta hai:** Pura filesystem agent ka public API — baaki sab files se re-export karta hai
- **Key exports:** `fileReader`, `fileWriter`, `fileEditor`, `patchFile`, `safeDelete`, `fileSearch`, `directoryReader`, `grepSearch`, `pathManager`, `workspaceManager`, `isolationManager`, `permissionManager`, `sandboxValidator`
- **Connections:** Executor aur doosre agents sirf isi se import karte hain — internal files directly expose nahi hoti
- **Role in system:** Saara bahar ka traffic isi gate se guzarta hai

---

## CORE SERVICES

---

### `file-reader.ts`
- **Type:** Service
- **Kya karta hai:** Sandbox se read operations handle karta hai — safely
- **Key functions:**
  - `fileReader.read(path)` — file content return karta hai
  - `fileReader.readLines(path, from, to)` — specific line range read karta hai
  - `fileReader.exists(path)` — file exists check
  - `fileReader.getSize(path)` — file size bytes mein
- **Connections:** `path-manager.ts` + `validation/file-integrity.ts` — pehle validate, phir read
- **Security:** Path traversal check pehle, read baad mein

---

### `file-writer.ts`
- **Type:** Service
- **Kya karta hai:** Sandbox mein write/delete operations — integrity aur permission checks ke saath
- **Key functions:**
  - `fileWriter.write(path, content)` — file likhta hai (dirs auto-create)
  - `fileWriter.writeIfAbsent(path, content)` — sirf tab likhta hai jab file exist na kare
  - `fileWriter.ensureDir(path)` — directory ensure karta hai
  - `fileWriter.remove(path)` — file delete karta hai
- **Connections:** `path-manager.ts` + `permission-manager.ts` + `validation/file-integrity.ts`
- **Security:** Permission check → integrity check → write. Fail-closed.

---

### `file-editor.ts`
- **Type:** Service
- **Kya karta hai:** High-level file manipulation — full overwrite ki jagah surgical edits
- **Key functions:**
  - `fileEditor.append(path, content)` — end mein add karta hai
  - `fileEditor.replaceAll(path, search, replace)` — global find-replace
  - `fileEditor.replaceLine(path, lineNo, newContent)` — specific line replace
  - `fileEditor.insertAt(path, lineNo, content)` — line insert karta hai
- **Connections:** `file-reader.ts` + `file-writer.ts` + `permission-manager.ts`
- **Note:** Directly write nahi karta — file-writer ke through jata hai

---

### `patch-file.ts`
- **Type:** Service
- **Kya karta hai:** String-level surgical replacement — risky full-file overwrites se bachata hai
- **Key functions:**
  - `patchFile(path, oldStr, newStr)` — ek occurrence replace karta hai
  - `patchFileAll(path, oldStr, newStr)` — sab occurrences replace karta hai
- **Connections:** `file-reader.ts` + `file-writer.ts` + `replacement-validator.ts`
- **Design decision:** LLM jab code edit karna chahta hai toh full rewrite ki jagah patch use karta hai — safer aur faster

---

### `safe-delete.ts`
- **Type:** Service / Validator
- **Kya karta hai:** Critical files ko accidental deletion se protect karta hai
- **Key functions:**
  - `safeDelete(path)` — delete se pehle blocklist check karta hai
- **Internal:** `PROTECTED_FILES` list maintain karta hai (e.g., `package.json`, `tsconfig.json`)
- **Connections:** `path-manager.ts` + `validation/file-integrity.ts`
- **Security:** Agar file protected list mein hai → operation block, error throw

---

### `directory-reader.ts`
- **Type:** Service / Utility
- **Kya karta hai:** Directory contents list karta hai — metadata ke saath, sensitive paths filter karke
- **Key functions:**
  - `readDirectory(path, recursive?)` — file listing (flat ya recursive)
  - `formatListing(entries)` — LLM-friendly formatted output
- **Connections:** `path-manager.ts` + `validation/file-integrity.ts`
- **Use case:** LLM ko project structure dikhana taaki wo sahi files target kar sake

---

### `file-search.ts`
- **Type:** Service
- **Kya karta hai:** Sandbox file tree navigation aur literal text search
- **Key functions:**
  - `fileSearch.listDir(path)` — directory listing
  - `fileSearch.findByExtension(ext)` — extension se files dhundhta hai
  - `fileSearch.grep(query)` — literal string search across files
- **Connections:** `path-manager.ts` + `validation/file-integrity.ts`
- **Difference from grep-search:** Yeh basic/literal — grep-search advanced regex ke liye

---

### `grep-search.ts`
- **Type:** Service
- **Kya karta hai:** Advanced text search — regex support ke saath
- **Key functions:**
  - `grepLiteral(query, dir?)` — literal search
  - `grepRegex(pattern, dir?)` — regex search
  - `formatGrepResult(results)` — formatted output for LLM
- **Connections:** `file-search.ts` + `path-manager.ts`
- **Role:** file-search ka advanced wrapper — LLM complex patterns dhundh sakta hai

---

## MANAGERS

---

### `path-manager.ts`
- **Type:** Utility / Manager
- **Kya karta hai:** Relative sandbox paths ko absolute host paths mein safely resolve karta hai
- **Key functions:**
  - `pathManager.resolve(relative)` — safe absolute path
  - `pathManager.root()` — sandbox root return karta hai
  - `pathManager.relative(absolute)` — absolute → relative convert karta hai
  - `pathManager.isSafe(path)` — boundary check
- **Connections:** `filesystem-utils.ts` + `workspace-manager.ts`
- **Role in system:** Har file operation isi se guzarta hai — central path authority

---

### `workspace-manager.ts`
- **Type:** Manager
- **Kya karta hai:** Project directories initialize aur locate karta hai — infrastructure layer se connect
- **Key functions:**
  - `workspaceManager.init(projectId)` — workspace setup karta hai
  - `workspaceManager.getRoot(projectId)` — workspace root path
  - `workspaceManager.resolvePath(projectId, relative)` — project-scoped path resolve
- **Connections:** `server/infrastructure/sandbox/sandbox.util.ts` + `sandbox-validator.ts` + executor logger
- **Bridge role:** Filesystem agent ko broader infrastructure se connect karta hai

---

### `isolation-manager.ts`
- **Type:** Manager
- **Kya karta hai:** Active execution contexts aur unke sandbox roots manage karta hai
- **Key functions:**
  - `isolationManager.create(runId)` — naya isolated context create karta hai
  - `isolationManager.validateAccess(runId, path)` — path authorized context mein hai?
  - `isolationManager.release(runId)` — context cleanup
- **Connections:** `sandbox-validator.ts` + `../executor/utils/execution-helpers.ts`
- **Security role:** Har run apne sandbox mein band rahta hai — cross-run file access block

---

### `permission-manager.ts`
- **Type:** Validator / Policy Manager
- **Kya karta hai:** Fail-closed policy enforce karta hai — specific files aur commands pe
- **Key functions:**
  - `canWrite(path)` — write allowed hai?
  - `canExecute(command)` — command allowed hai?
  - `assertWrite(path)` — throws if blocked (e.g., `package.json` pe direct write block)
- **Connections:** `file-writer.ts` + `file-editor.ts` + `safe-delete.ts` — yeh teeno call karte hain before mutation
- **Security model:** Default DENY — sirf explicitly allowed paths/commands pass hote hain

---

## UTILITIES

---

### `filesystem-utils.ts`
- **Type:** Utility (Foundational)
- **Kya karta hai:** Low-level path normalization aur string manipulation
- **Key functions:**
  - `normalizePath(path)` — slashes normalize, dots resolve
  - `safeRelativePath(base, target)` — safe relative path compute
  - `hasTraversal(path)` — `../` traversal attack detect karta hai
  - `joinSandboxPath(root, ...parts)` — safely join sandbox paths
- **Connections:** Almost har file is folder mein import karta hai — foundation layer
- **Critical:** Yeh file sabse zyada import hoti hai — traversal check yahi se start hota hai

---

### `diff-engine.ts`
- **Type:** Utility
- **Kya karta hai:** Lightweight line-based text diffing
- **Key functions:**
  - `lineDiff(oldText, newText, context?)` — diff generate karta hai with context lines
  - `formatDiff(diff)` — human-readable diff output
  - `diffStats(diff)` — lines added/removed metrics
- **Connections:** Patching/editing workflow support karta hai — LLM ya user ko changes report karne ke liye
- **Use case:** Jab file edit hota hai, diff generate hokar LLM/user ko dikhaya jata hai

---

## VALIDATORS

---

### `sandbox-validator.ts`
- **Type:** Validator
- **Kya karta hai:** Low-level boundary checking — absolute aur relative paths ke liye
- **Key functions:**
  - `validateSandboxPath(path, root)` — path sandbox ke andar hai?
  - `isSafeWorkspacePath(path)` — workspace safe paths check
- **Connections:** `filesystem-utils.ts` + `validation/file-integrity.ts` — called by `isolation-manager.ts` + `workspace-manager.ts`
- **Security:** Path escape attempts (e.g., `../../etc/passwd`) yahi pe block hote hain

---

### `replacement-validator.ts`
- **Type:** Validator
- **Kya karta hai:** String replacement (patch) operations ki safety aur sanity validate karta hai
- **Key functions:**
  - `validatePatch(path, oldStr, newStr, content)` — replacement valid aur safe hai?
- **Connections:** `patch-file.ts` + `validation/file-integrity.ts`
- **Checks:** Old string exists? New string empty toh nahi? Content size limit exceed toh nahi?

---

## validation/ subfolder

---

### `validation/file-integrity.ts`
- **Type:** Validator (Most Critical)
- **Kya karta hai:** Primary path + content integrity checks — yeh sabse zyada import hoti hai
- **Key functions:**
  - `validateFilePath(path)` — null bytes, traversal, invalid chars check
  - `validateFileContent(content)` — size limit, binary check
  - `checkSandboxBoundary(path, root)` — hard boundary enforcement
- **Connections:** `file-reader`, `file-writer`, `path-manager`, `sandbox-validator`, `directory-reader`, `replacement-validator` — sab isko call karte hain
- **Critical note:** Yeh poore folder ki primary security layer hai — isko bypass karna impossible without touching every service

---

### `validation/command-safety.ts`
- **Type:** Validator
- **Kya karta hai:** Shell commands ko strict allowlist ke against validate karta hai
- **Key functions:**
  - `validateShellCommand(cmd)` — command safe hai?
  - `isCommandSafe(cmd)` — boolean check
- **Connections:** Runtime agent se use hota hai — filesystem folder ke baaki files se direct connection nahi
- **Security:** Dangerous commands (rm -rf /, curl | sh, etc.) yahi pe block hote hain

---

## Dependency Graph

```
validation/file-integrity.ts     ← Most imported (foundation security)
filesystem-utils.ts              ← Foundation (path normalization)
        ↑
sandbox-validator.ts
path-manager.ts
        ↑
workspace-manager.ts
isolation-manager.ts
        ↑
permission-manager.ts
        ↑
file-reader.ts   file-writer.ts
        ↑               ↑
directory-reader  file-editor.ts
file-search.ts    patch-file.ts ← replacement-validator.ts
grep-search.ts    safe-delete.ts
        ↑
diff-engine.ts (standalone utility)
        ↑
    index.ts   ← Sab bahar ke agents yahan se import karte hain

validation/command-safety.ts ← Standalone (runtime agent use karta hai)
```

---

## Type Classification Summary

| Type | Count | Files |
|------|-------|-------|
| **Service** | 8 | `file-reader`, `file-writer`, `file-editor`, `patch-file`, `safe-delete`, `directory-reader`, `file-search`, `grep-search` |
| **Manager** | 3 | `path-manager`, `workspace-manager`, `isolation-manager` |
| **Validator** | 4 | `sandbox-validator`, `replacement-validator`, `validation/file-integrity`, `validation/command-safety` |
| **Policy Manager** | 1 | `permission-manager` |
| **Utility** | 2 | `filesystem-utils`, `diff-engine` |
| **Entry Point** | 1 | `index.ts` |

---

## Security Model — Fail-Closed

Har operation ka flow:

```
External Request (from Executor Agent)
        ↓
    index.ts  (public API)
        ↓
  permission-manager  (kya allowed hai?)
        ↓
  validation/file-integrity  (path safe hai? content valid hai?)
        ↓
  sandbox-validator  (boundary check)
        ↓
  path-manager  (resolve to absolute)
        ↓
  actual fs operation (read/write/delete)
        ↓
  diff-engine (optional — change report karo)
```

**Default: DENY. Sirf explicitly validated operations pass hoti hain.**

---

## Key Design Decisions

| Decision | Reason |
|----------|--------|
| `patch-file` instead of full overwrite | LLM full file rewrite karne mein mistakes karta hai — surgical replace safer |
| `safe-delete` protected files list | `package.json` delete hone se poora sandbox break ho jata |
| `isolation-manager` per-run context | Parallel runs ek doosre ke files access na kar sakein |
| `permission-manager` fail-closed | Koi bhi nayi path default se blocked — explicitly allow karna padta hai |
| `validation/file-integrity.ts` centralized | Ek jagah se security — har service individual check na kare |

---

*Report generated from deep scan of `server/agents/filesystem/` — 19 files total*
