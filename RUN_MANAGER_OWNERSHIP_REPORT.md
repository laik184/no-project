# RUN_MANAGER_OWNERSHIP_REPORT
> Generated from actual code at server/orchestration/core/run-manager.ts

---

## What run-manager actually does

```typescript
class RunManager {
  private _runs = new Map<string, RunRecord>();

  register(runId: string, projectId: number): void { ... }   // add entry
  get(runId: string): RunRecord | undefined { ... }          // read entry
  setStatus(runId: string, status: RunRecord['status']): void { ... }  // update status
  clear(runId: string): void { ... }                         // delete entry
  activeRunIds(): string[] { ... }                           // query
  size(): number { ... }                                     // query
}
```

---

## Ownership Classification

| Ownership | Answer |
|-----------|--------|
| Registry only? | **YES** — pure in-memory Map of RunRecords |
| Execution owner? | **NO** — no dispatch, no loop, no agent calls |
| Lifecycle owner? | **NO** — no session create/destroy, no phase control |
| Metadata owner? | **YES** — owns `{ runId, projectId, startedAt, status }` |

run-manager is a **single-responsibility, pure-metadata registry**.
It answers: "Is this runId active? When did it start? What is its status?"

---

## Who calls run-manager

| Caller | Import path | Calls | Valid? |
|--------|-------------|-------|--------|
| chat-orchestrator.ts | `../../orchestration/core/run-manager.ts` | register, get, setStatus | **VIOLATION** — bypasses public surface |

### Why this is a violation

`server/chat/orchestration/chat-orchestrator.ts` imports directly from `orchestration/core/`, which is an internal module not part of the public orchestration API (`orchestration/index.ts`).

If `run-manager.ts` is ever moved, renamed, or its internal shape changed, the chat layer breaks silently — the public API contract offers no protection.

---

## Run-manager has no ownership confusion

The module does exactly one thing: track run metadata. It does not:
- Start or stop orchestration sessions
- Dispatch agents or tools
- Manage the execution lifecycle
- Hold planning state

The **only** fix needed is the import path in the chat layer.

---

## Fix

**`server/orchestration/index.ts`** — add to public surface:
```typescript
export { runManager } from './core/run-manager.ts';
export type { RunRecord } from './core/run-manager.ts';
```

**`server/chat/orchestration/chat-orchestrator.ts`** — consolidate import:
```typescript
// Before
import { orchestrate }  from '../../orchestration/index.ts';
import { runManager }   from '../../orchestration/core/run-manager.ts';

// After
import { orchestrate, runManager } from '../../orchestration/index.ts';
```

Single responsibility is preserved. No change to run-manager.ts itself.
