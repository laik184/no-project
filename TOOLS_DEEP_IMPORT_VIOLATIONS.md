# TOOLS_DEEP_IMPORT_VIOLATIONS.md

## Classification

Violations are classified in two tiers:

| Tier | Definition |
|------|-----------|
| **FIXABLE** | Symbol is in barrel, file is a general consumer — path swap is safe |
| **DOCUMENTED INTENTIONAL** | Deep import is explicit in file doc comment; file is itself a gateway implementation |

---

## TIER 1 — FIXABLE violation (1 file)

### `server/agents/coderx/utils.ts`

| Field | Detail |
|-------|--------|
| Line | 25 |
| Deep Import | `../../tools/shared/string-utils.ts` |
| Symbols | `toPascalCase`, `toCamelCase`, `toKebabCase`, `toSnakeCase`, `pluralize`, `capitalize`, `truncate` |
| In barrel? | ✗ — NOT YET (requires barrel addition) |
| Fix | Add `string-utils.ts` to `tools/index.ts`, then change path to `../../tools/index.ts` |

**Fix path:**
```typescript
// Current (deep import — fixable after barrel addition)
export { toPascalCase, toCamelCase, toKebabCase, toSnakeCase, pluralize, capitalize, truncate }
  from '../../tools/shared/string-utils.ts';

// Recommended (barrel)
export { toPascalCase, toCamelCase, toKebabCase, toSnakeCase, pluralize, capitalize, truncate }
  from '../../tools/index.ts';
```

---

## TIER 2 — DOCUMENTED INTENTIONAL (10 files)

These files import from `tools/registry/tool-dispatcher.ts` or `tools/registry/tool-types.ts`
directly. This is explicitly documented in every file's header comment as intentional design.
Their purpose IS to be wrappers over the dispatcher — they are not general consumers.

All dispatcher symbols (`dispatch`, `dispatchAll`, `dispatchSequential`, `DispatchOptions`)
ARE in the barrel via `export * from './registry/index.ts'`. All type symbols are too.

| File | Deep Import | Symbols | Status |
|------|-------------|---------|--------|
| `agents/browser/coordination/dispatcher-client.ts` | `tools/registry/tool-dispatcher.ts` | `dispatch`, `dispatchSequential`, `dispatchAll`, `DispatchOptions` | INTENTIONAL |
| `agents/coderx/coordination/dispatcher-client.ts` | `tools/registry/tool-dispatcher.ts` | `dispatch`, `dispatchAll`, `dispatchSequential`, `DispatchOptions` | INTENTIONAL |
| `agents/executor/coordination/dispatcher-client.ts` | `tools/registry/tool-dispatcher.ts` | `dispatch`, `dispatchAll`, `dispatchSequential`, `DispatchOptions` | INTENTIONAL |
| `agents/filesystem/coordination/dispatcher-client.ts` | `tools/registry/tool-dispatcher.ts` | `dispatch`, `dispatchSequential`, `dispatchAll`, `DispatchOptions` | INTENTIONAL |
| `agents/planner/coordination/dispatcher-client.ts` | `tools/registry/tool-dispatcher.ts` | `dispatch`, `DispatchOptions` | INTENTIONAL |
| `agents/supervisor/coordination/dispatcher-client.ts` | `tools/registry/tool-dispatcher.ts` | `dispatch`, `DispatchOptions` | INTENTIONAL |
| `agents/terminal/coordination/dispatcher-client.ts` | `tools/registry/tool-dispatcher.ts` | `dispatch`, `DispatchOptions` | INTENTIONAL |
| `agents/verifier/coordination/dispatcher-client.ts` | `tools/registry/tool-dispatcher.ts` | `dispatch`, `DispatchOptions` | INTENTIONAL |
| `orchestration/coordination/dispatcher-client.ts` | `tools/registry/tool-dispatcher.ts` + `tool-types.ts` | `dispatch`, `dispatchAll`, `dispatchSequential`, `DispatchOptions`, `ToolExecutionContext`, `ToolExecutionResult` | INTENTIONAL |
| `shared/types/execution-contracts.ts` | `tools/registry/tool-types.ts` | `ToolExecutionContext`, `ToolExecutionResult`, `ToolErrorCode`, `RetryPolicy` | INTENTIONAL SHIM |

**Evidence of intentionality** (doc comment example from `executor/coordination/dispatcher-client.ts`):
> "THE single gateway from the executor agent to the central tool dispatcher.
> ALL tool execution MUST flow through this client — never directly.
> **Imports ONLY from the tool registry dispatcher — never from tool implementations.**"

This is not a violation to fix — it IS the design. The dispatcher-client files are themselves the
gateway implementation. They are the barrel consumers' inner workings, not external consumers.

---

## Summary

| Tier | Count | Action |
|------|-------|--------|
| FIXABLE | 1 | Fix after barrel addition |
| INTENTIONAL | 10 | Document only — do not change |
