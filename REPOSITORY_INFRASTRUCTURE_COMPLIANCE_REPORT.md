# Repository Infrastructure Compliance Report

**Scope:** `server/repositories/**/*.ts`
**Date:** 2026-06-04

---

## 1. All Repository Files — Infrastructure Compliance Matrix

| File | Infrastructure Import? | Import Path Used | Sub-path Violation? | Layer Violation? | Compliant? |
|---|---|---|---|---|---|
| `chat/attachment.repository.ts` | YES | `../../infrastructure` | NO | NO | ⚠️ normalized |
| `chat/checkpoint.repository.ts` | YES | `../../infrastructure/index.ts` | NO | YES — chat types | ⚠️ see §7 |
| `chat/message.repository.ts` | YES | `../../infrastructure` | NO | YES — chat types | ⚠️ see §7 |
| `chat/run.repository.ts` | YES | `../../infrastructure` | NO | YES — chat types | ⚠️ see §7 |
| `chat/index.ts` | NO | — | — | — | ✅ |
| `file-system/filesystem.repository.ts` | NO | — | — | — | ✅ |
| `file-system/git.repository.ts` | NO | — | — | — | ✅ |
| `file-system/metadata.repository.ts` | NO | — | — | — | ✅ |
| `file-system/history.repository.ts` | NO | — | — | — | ✅ |
| `file-system/editors.repository.ts` | NO | — | — | — | ✅ |
| `file-system/pinned.repository.ts` | NO | — | — | — | ✅ |
| `file-system/recent.repository.ts` | NO | — | — | — | ✅ |
| `file-system/index.ts` | NO | — | — | — | ✅ |
| `index.ts` | NO | — | — | — | ✅ |

---

## 2. Current Imports (Implementation Files Only)

### `chat/attachment.repository.ts`
```typescript
import { eq } from 'drizzle-orm';
import { db } from '../../infrastructure';           // ← shorthand, normalized below
import { chatUploads } from '../../../shared/schema.ts';
```

### `chat/checkpoint.repository.ts`
```typescript
import { eq } from 'drizzle-orm';
import { db } from '../../infrastructure/index.ts';  // ✅ canonical
import { checkpoints, rollbackHistory } from '../../../shared/schema.ts';
import type { ChatCheckpoint, CheckpointTrigger } from '../../chat/types/checkpoint.types.ts'; // ⚠️ violation
```

### `chat/message.repository.ts`
```typescript
import { desc, eq } from 'drizzle-orm';
import { db } from '../../infrastructure';           // ← shorthand, normalized below
import { chatMessages } from '../../../shared/schema.ts';
import type { ... } from '../../chat/types/message.types.ts'; // ⚠️ violation
```

### `chat/run.repository.ts`
```typescript
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../infrastructure';           // ← shorthand, normalized below
import { agentRuns } from '../../../shared/schema.ts';
import type { ChatRun, RunStatus } from '../../chat/types/run.types.ts'; // ⚠️ violation
```

### All `file-system/*.repository.ts`
Use only Node.js builtins (`fs`, `path`, `child_process`) and shared file-explorer-core types/config. No infrastructure imports. Correct.

---

## 3. Infrastructure Symbols Used

| Repository | Symbols Used | Symbols NOT Used |
|---|---|---|
| `chat/attachment.repository.ts` | `db` | bus, sseManager, runtimeManager, processRegistry, safeWriteFile, safeDeleteFile, safeBackup, getProjectDir, getNuraDir, captureGitSha |
| `chat/checkpoint.repository.ts` | `db` | (same as above) |
| `chat/message.repository.ts` | `db` | (same as above) |
| `chat/run.repository.ts` | `db` | (same as above) |
| All file-system repos | none | (all) |

All repositories import the minimum required symbols. No over-importing detected.

---

## 4. Should Import Infrastructure? Decision

| Repository | Decision | Reason |
|---|---|---|
| `chat/attachment.repository.ts` | **YES** | Executes DB queries — owns `chatUploads` persistence |
| `chat/checkpoint.repository.ts` | **YES** | Executes DB queries — owns `checkpoints`+`rollbackHistory` persistence |
| `chat/message.repository.ts` | **YES** | Executes DB queries — owns `chatMessages` persistence |
| `chat/run.repository.ts` | **YES** | Executes DB queries — owns `agentRuns` persistence |
| `file-system/filesystem.repository.ts` | **NO** | Owns `fs` directly — is the filesystem abstraction layer for its domain |
| `file-system/git.repository.ts` | **NO** | Owns `child_process` directly — git is a native system call, not infrastructure-mediated |
| `file-system/metadata.repository.ts` | **NO** | Pure in-memory cache — no I/O |
| `file-system/history.repository.ts` | **NO** | Owns `fs` directly — JSON files in `.nura/history/` |
| `file-system/editors.repository.ts` | **NO** | Owns `fs` directly — `editors.json` in `.nura/` |
| `file-system/pinned.repository.ts` | **NO** | Owns `fs` directly — `pinned.json` in `.nura/` |
| `file-system/recent.repository.ts` | **NO** | Owns `fs` directly — `recent.json` in `.nura/` |

**Note on file-system repos:** The infrastructure exports `safeWriteFile`, `safeDeleteFile`, `safeBackup`, `getProjectDir`, `getNuraDir`, and `captureGitSha` — but these are agent-sandbox checkpoint utilities, not file-explorer utilities. The file-explorer repos correctly own their own `fs` access rather than routing through agent-level utilities.

---

## 5. Exact Import Statements Required (After Fix)

```typescript
// chat/attachment.repository.ts
import { db } from '../../infrastructure/index.ts';

// chat/checkpoint.repository.ts
import { db } from '../../infrastructure/index.ts';  // already correct

// chat/message.repository.ts
import { db } from '../../infrastructure/index.ts';

// chat/run.repository.ts
import { db } from '../../infrastructure/index.ts';
```

---

## 6. Unused Infrastructure Imports

None. Every repository that imports infrastructure uses only `db`, and `db` is actively used in every query method. No dead imports.

---

## 7. Direct Sub-path Violations

**None found.**

No repository imports from sub-paths such as:
- `../../infrastructure/db/index.ts`
- `../../infrastructure/events/bus.ts`
- `../../infrastructure/runtime/runtime-manager.ts`

The 3 files using `../../infrastructure` (without `/index.ts`) resolve to the same file and are not sub-path violations. They have been normalized to `../../infrastructure/index.ts` for consistency.

---

## 8. Service / Agent / Tool / Chat / Orchestration Layer Violations

Three repositories import types from `server/chat/types/` — a layer architecturally above repositories:

| Repository | Violating Import | Type(s) |
|---|---|---|
| `chat/checkpoint.repository.ts` | `../../chat/types/checkpoint.types.ts` | `ChatCheckpoint`, `CheckpointTrigger` |
| `chat/message.repository.ts` | `../../chat/types/message.types.ts` | `ChatMessageRecord`, `AssistantMessagePayload`, `UserMessagePayload`, `SystemMessagePayload` |
| `chat/run.repository.ts` | `../../chat/types/run.types.ts` | `ChatRun`, `RunStatus` |

**Severity:** LOW — all three are `import type` (erased at compile time, no runtime coupling).

**Root cause:** These types were defined in `server/chat/types/` but are consumed by repositories, which sit below chat in the dependency hierarchy. The correct home for types shared between chat and repositories is `shared/` or a dedicated `server/chat/types/` → `shared/types/chat/` migration.

**Impact of leaving as-is:** No circular import at runtime, no breakage. TypeScript compilation succeeds. The violation is architectural only.

**Recommended fix (not applied — requires type migration):**
Move `ChatCheckpoint`, `ChatMessageRecord`, `ChatRun`, `RunStatus`, and related payload types to `shared/types/` so repositories can import from `shared/` without reaching up into `server/chat/`.

---

## 9. Final Dependency Graph

```
server/chat/*                          ← controllers, orchestration, persistence facades
      ↓
server/services/chat/*                 ← business facades
      ↓
server/repositories/chat/*             ← DB access only
      ↓
server/infrastructure/index.ts         ← db, bus, sseManager, runtimeManager, ...
      ↓
shared/schema.ts                       ← Drizzle table definitions

server/file-explorer/*                 ← file explorer controllers + services
      ↓
server/repositories/file-system/*      ← fs/child_process access layer
      ↓
server/shared/file-explorer-core/*     ← shared types, config, guards, utils
      ↓
Node.js builtins (fs, path, child_process)
```

**Key invariants:**
- No repository imports a service, agent, tool, or orchestration module
- No repository imports from `server/chat/*` at the implementation level (type-only imports exist — see §8)
- Every DB-using repository imports `db` from `../../infrastructure/index.ts` exclusively
- File-system repositories own their `fs` access directly — they do not route through agent sandbox utilities
- The `repositories/index.ts` barrel is the single import surface for service-layer consumers

---

## Actions Taken

| Action | Files | Status |
|---|---|---|
| Normalized `../../infrastructure` → `../../infrastructure/index.ts` | `attachment.repository.ts`, `message.repository.ts`, `run.repository.ts` | ✅ Applied |
| Reported chat-type layer violations | `checkpoint.repository.ts`, `message.repository.ts`, `run.repository.ts` | ✅ Documented |
| Type migration to `shared/types/` | (all three above) | 🔲 Deferred — larger refactor |
