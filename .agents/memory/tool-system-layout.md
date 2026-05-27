---
name: Centralized tool system layout
description: Structure, conventions, and gotchas for server/tools/ — the centralized tool execution layer in nura-x.
---

## Layout

```
server/tools/
├── registry/
│   ├── tool-types.ts       — all core types (ToolDefinition, ToolExecutionContext, etc.)
│   ├── tool-metadata.ts    — metadata catalogue + RETRY_* + TIMEOUT constants
│   ├── tool-registry.ts    — singleton Map + unifiedRegistry compat shim + metrics
│   ├── tool-resolver.ts    — resolveTool, resolveToolWithPermissions
│   ├── tool-dispatcher.ts  — dispatch / dispatchAll / dispatchSequential (never throws)
│   ├── tool-security.ts    — audit log (recordAudit / getAuditLog)
│   └── index.ts            — barrel re-export of entire registry layer
├── core/
│   ├── execute-tool.ts     — executeTool(entry, args, ctx) → { ok, result, error }
│   └── tool-context.ts     — createContext(projectId: string|number, runId) → ToolContext
├── shared/
│   ├── context-builder.ts  — buildContext helper
│   ├── input-validator.ts  — validateInput / applyDefaults
│   ├── result-helpers.ts   — ok() / fail() / unwrapOrThrow() etc.
│   └── logger.ts           — toolsLogger (JSON-lines to stdout/stderr)
├── filesystem/             — MIGRATED (50 files, 38 tools registered)
│   ├── read/ write/ edit/ delete/ move/ clone/ search/ structure/ folders/
│   ├── shared/ validation/ registry/register-filesystem-tools.ts
│   └── index.ts            — barrel; call registerFilesystemTools() at boot
├── terminal/index.ts       — stub (PENDING MIGRATION)
├── browser/index.ts        — stub (PENDING MIGRATION)
├── verifier/index.ts       — stub (PENDING MIGRATION)
├── coding/index.ts         — stub (PENDING MIGRATION)
└── index.ts                — top-level barrel
```

## Key contracts

- `ToolDefinition` holds handler. `ToolMetadata` is handler-free (safe for agents to read).
- `ToolExecutionContext` (from tool-types) ≈ `ToolContext` (from core/tool-context) — structurally identical; use `ToolContext` when calling `executeTool`, `ToolExecutionContext` when calling `dispatch`.
- `createContext` accepts `string | number` for projectId — coerces to string internally.
- `RegisteredToolEntry.permissions` is `readonly string[]` — must match `UnifiedRegistryEntry`.

## compat shim (unifiedRegistry)

`server/api/tools.routes.ts` and `server/engine/execution/node-executor.ts` import `unifiedRegistry` directly from `tool-registry.ts`. It exposes:
- `.totalCount`, `.list()`, `.getEntry(name)`, `.getByCategory(cat)`, `.getMetrics(name)`, `.getStats()`

`node-executor.ts` also dynamic-imports `executeTool` from `core/execute-tool.ts` and `createContext` from `core/tool-context.ts`.

## tsconfig requirement

`allowImportingTsExtensions: true` + `noEmit: true` are required for `.ts` extension imports used throughout the server. The old `declaration: true` was removed because it conflicts with `allowImportingTsExtensions` when `noEmit` is true.

**Why:** The server uses `tsx` at runtime (not tsc), so `noEmit` is correct — tsc is type-check only.

## Filesystem migration conventions

- Tool files wrap agent implementations — never duplicate fs logic.
- All validation re-exported from agents (no duplication in tools layer).
- `classifyFsError()` maps agent errors → ToolErrorCode for dispatcher.
- Compatibility adapter at `server/agents/filesystem/adapter/filesystem-tool-adapter.ts` — preserves old signatures for agent callers that want to route through dispatcher.
- `registerFilesystemTools()` is idempotent (guarded by `_registered` flag).

## DO NOT yet

- Migrate terminal/browser/verifier/coding agents — stubs only
- Delete anything from server/agents/filesystem/ — old APIs still live there
