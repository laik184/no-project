---
name: Architecture compliance refactor
description: 5 dependency violations fixed across browser/tool coupling, memory/agent inversion, bus access, and chat persistence.
---

## Rules fixed

**Fix 1 — Browser shared layer (CRITICAL)**
- `agents/browser/{core,events,telemetry,types,utils}` are canonical at `server/shared/browser/` (18 files).
- Original paths in `agents/browser/` are now re-export shims (1-line `export * from '../../../shared/browser/...'`).
- All `tools/browser/**` imports updated to `shared/browser/` via batch sed.
- `agents/browser/events/browser-bus-bridge.ts` stays in agents (not moved) — it owns the bus bridge.
- **Why:** tools must not couple to the agent layer; shared modules belong in server/shared/.

**Fix 2 — Executor stores in memory layer (HIGH)**
- `executionHistory`, `failureMemory`, `learningStore` live at `server/memory/stores/`.
- `TaskKind` is now defined in `memory/stores/execution-history.ts` (inline union type — no agent import needed).
- Original executor paths (`agents/executor/memory/`, `agents/executor/learning/`) are shims.
- `memory-hydrator.ts` and `memory-loader.ts` import from `../stores/` not `agents/executor/index.ts`.
- **Why:** memory/ must not import from agents/; stores are data not agent logic.

**Fix 3 — Terminal bus wrapper (MEDIUM)**
- `server/tools/terminal/events/terminal-events.ts` is the ONLY file that imports infrastructure bus in the terminal tool layer.
- `process-started.ts` and `process-exited.ts` re-export from terminal-events.ts.

**Fix 4 — Browser bus publisher (MEDIUM)**
- `server/agents/browser/events/browser-event-publisher.ts` is the ONLY file that imports infrastructure bus in the browser agent layer.
- `browser-bus-bridge.ts` calls `publishBrowserSession()` instead of `bus.emit()` directly.

**Fix 5 — Chat repository layer (LOW)**
- `server/repositories/chat/` holds `attachment.repository.ts`, `message.repository.ts`, `run.repository.ts`, `checkpoint.repository.ts`, `index.ts`.
- `chat/persistence/{attachment,message,run-store,run-writer}` are now thin delegates to repositories.

## Shim convention
When extracting a module to a new layer, replace the original file with a one-line re-export shim:
```ts
export * from 'correct/new/path/to/module.ts';
```
This preserves all existing import paths without a mass-update, and TypeScript resolves through the shim transparently. Only the new canonical path is the "true" file.

## Path depth gotcha
`server/agents/browser/core/` → relative path to `server/shared/browser/core/` is `../../../shared/browser/core/` (3 levels up, NOT 4). Getting this wrong produces `ERR_MODULE_NOT_FOUND` pointing at workspace root instead of server/.
