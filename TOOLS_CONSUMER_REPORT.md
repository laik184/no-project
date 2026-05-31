# TOOLS_CONSUMER_REPORT.md

## Scope
Entire `server/` directory, all `.ts` files, excluding `server/tools/` internals.

---

## Total external consumers: 12 files

---

### Group A — Agent dispatcher-clients (8 files)

All 8 agent modules have a `coordination/dispatcher-client.ts` that imports from the
tool registry layer. Their doc comments explicitly state:
> "Imports ONLY from the tool registry dispatcher — never from tool implementations."

This is an INTENTIONAL architectural pattern — each agent's dispatcher-client is the sole
gateway to the tool execution layer. They import specific dispatcher functions.

| Consumer | Current Import Path | Symbols Used |
|----------|---------------------|--------------|
| `server/agents/browser/coordination/dispatcher-client.ts` | `../../../tools/registry/tool-dispatcher.ts` | `dispatch`, `dispatchSequential`, `dispatchAll`, `DispatchOptions` |
| `server/agents/coderx/coordination/dispatcher-client.ts` | `../../../tools/registry/tool-dispatcher.ts` | `dispatch`, `dispatchAll`, `dispatchSequential`, `DispatchOptions` |
| `server/agents/executor/coordination/dispatcher-client.ts` | `../../../tools/registry/tool-dispatcher.ts` | `dispatch`, `dispatchAll`, `dispatchSequential`, `DispatchOptions` |
| `server/agents/filesystem/coordination/dispatcher-client.ts` | `../../../tools/registry/tool-dispatcher.ts` | `dispatch`, `dispatchSequential`, `dispatchAll`, `DispatchOptions` |
| `server/agents/planner/coordination/dispatcher-client.ts` | `../../../tools/registry/tool-dispatcher.ts` | `dispatch`, `DispatchOptions` |
| `server/agents/supervisor/coordination/dispatcher-client.ts` | `../../../tools/registry/tool-dispatcher.ts` | `dispatch`, `DispatchOptions` |
| `server/agents/terminal/coordination/dispatcher-client.ts` | `../../../tools/registry/tool-dispatcher.ts` | `dispatch`, `DispatchOptions` |
| `server/agents/verifier/coordination/dispatcher-client.ts` | `../../../tools/registry/tool-dispatcher.ts` | `dispatch`, `DispatchOptions` |

**Architecture note**: These files are by-design internal wrappers. Their direct imports from
`tool-dispatcher.ts` are documented as intentional. All symbols ARE in the barrel, but these
files are themselves gateway implementations, not general consumers.

---

### Group B — Orchestration dispatcher-client (1 file)

| Consumer | Current Import Path | Symbols Used |
|----------|---------------------|--------------|
| `server/orchestration/coordination/dispatcher-client.ts` | `../../tools/registry/tool-dispatcher.ts` | `dispatch`, `dispatchAll`, `dispatchSequential`, `DispatchOptions` |
| | `../../tools/registry/tool-types.ts` | `ToolExecutionContext`, `ToolExecutionResult` |

Same pattern as agent dispatcher-clients — intentional direct import of dispatcher.

---

### Group C — Shared type bridge (1 file)

| Consumer | Current Import Path | Symbols Used |
|----------|---------------------|--------------|
| `server/shared/types/execution-contracts.ts` | `../../tools/registry/tool-types.ts` | `ToolExecutionContext`, `ToolExecutionResult`, `ToolErrorCode`, `RetryPolicy` |

**Architecture note**: This file is an intentional shim — it re-exports tool types for agent
dispatcher-clients that don't want to couple directly to the tools layer. Its entire purpose
is to be a bridge between `tools/registry/tool-types.ts` and the agent layers.

---

### Group D — String utility consumer (1 file)

| Consumer | Current Import Path | Symbols Used |
|----------|---------------------|--------------|
| `server/agents/coderx/utils.ts` | `../../tools/shared/string-utils.ts` | `toPascalCase`, `toCamelCase`, `toKebabCase`, `toSnakeCase`, `pluralize`, `capitalize`, `truncate` |

**Architecture note**: `coderx/utils.ts` is a documented backward-compat shim for string utils
that migrated from `agents/coderx/` to `tools/shared/`. It imports the string utils directly
from the tools shared folder. This is a fixable deep import — once `string-utils.ts` is added
to the barrel, `coderx/utils.ts` should use the barrel.

---

## Barrel Import Usage

| Consumer Group | Uses barrel? | Why |
|----------------|-------------|-----|
| Agent dispatcher-clients | ✗ | Intentional documented direct import of dispatcher |
| Orchestration dispatcher-client | ✗ | Same intentional pattern |
| Shared type bridge | ✗ | Intentional shim designed to bridge layers |
| `coderx/utils.ts` | ✗ | Fixable — `string-utils.ts` not yet in barrel |
