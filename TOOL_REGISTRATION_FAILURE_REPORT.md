# DEEP SCAN — TOOL REGISTRATION FAILURE REPORT

**Generated:** 2026-06-04  
**Issue:** `ToolNotFoundError` when Executor dispatches `coding_generate_react_page`  
**Status:** ROOT CAUSE CONFIRMED — DO NOT FIX YET

---

## TASK 1 — TOOL EXISTENCE

**Result: EXISTS**

| Field | Value |
|---|---|
| File path | `server/tools/coding/frontend/generate-react-page.ts` |
| Exported name | `generateReactPageTool` |
| Tool identifier (name field) | `coding_generate_react_page` |
| Category | `coding` |
| Description | "Generate a React page component (TypeScript + Tailwind). Returns file map — does not write to disk." |
| Timeout | `TIMEOUT.DEFAULT` |
| Retry policy | `RETRY_ONCE` |

**Evidence — `server/tools/coding/frontend/generate-react-page.ts`, line 16–17:**
```typescript
export const generateReactPageTool = defineCodingTool({
  name: 'coding_generate_react_page',
```

The tool physically exists, compiles correctly, and has no broken imports.

---

## TASK 2 — TOOL REGISTRATION

**Result: REGISTERED IN CODE — BUT NEVER LOADED AT RUNTIME**

The tool is correctly imported and placed in the `ALL_CODING_TOOLS` array.

**Evidence — `server/tools/coding/registry/register-coding-tools.ts`:**
- Line 12: `import { generateReactPageTool } from '../frontend/generate-react-page.ts';`
- Line 75: `generateReactPageTool,` (inside `ALL_CODING_TOOLS`)
- Line 135–142: `registerCodingTools()` iterates `ALL_CODING_TOOLS` and calls `registerTool()` for each

**Boot chain — `server/tools/registry/tool-loader.ts`:**
- Line 21: `import { registerCodingTools } from '../coding/index.ts';`
- Line 35: `registerCodingTools();` called inside `loadAllTools()`
- Line 38: `sealRegistry()` called after all registrations

The function `loadAllTools()` is the single correct entry point for populating the registry.

---

## TASK 3 — TOOL NAME COMPARISON

**Result: NO NAMING MISMATCH**

All names are consistent across every layer:

| Layer | Name |
|---|---|
| Tool metadata (`generate-react-page.ts` line 17) | `coding_generate_react_page` |
| Registration array (`register-coding-tools.ts` line 75) | `coding_generate_react_page` (via object reference) |
| Coordinator mapping (`tool-coordinator.ts` line 76) | `coding_generate_react_page` |
| Coordinator default fallback (`tool-coordinator.ts` line 126) | `coding_generate_react_page` |
| Registry key (`tool-registry.ts`, keyed by `tool.name`) | `coding_generate_react_page` |

There is zero naming, casing, prefix, or alias mismatch. The string `coding_generate_react_page` is consistent end-to-end.

---

## TASK 4 — EXECUTION TRACE

**Last successful step:** `task-executor.ts` — `coordinateTask()` returns `toolName: 'coding_generate_react_page'`  
**First failing step:** `tool-resolver.ts:60` — `getTool('coding_generate_react_page')` returns `undefined`

| Step | File | Function | Result |
|---|---|---|---|
| 1 | `executor-agent.ts` | `runExecutorAgent` | ✓ OK |
| 2 | `execution-loop.ts` | `executeTask` loop | ✓ OK |
| 3 | `task-executor.ts:36` | `coordinateTask(task, sandboxRoot)` | ✓ Returns `toolName: 'coding_generate_react_page'` |
| 4 | `step-runner.ts` | `runStep` | ✓ Calls `executeTool` |
| 5 | `dispatcher-client.ts:34` | `dispatch(toolName, input, context, opts)` | ✓ Passes through |
| 6 | `tool-dispatcher.ts` | `resolveToolWithPermissions(name, ctx)` | ✓ Calls resolver |
| 7 | `tool-resolver.ts:59` | `getTool('coding_generate_react_page')` | ✗ **FAILS — returns undefined** |
| 8 | `tool-resolver.ts:60` | `throw new ToolNotFoundError(name)` | ✗ **ERROR THROWN HERE** |

---

## TASK 5 — TOOL RESOLVER FAILURE

**File:** `server/tools/registry/tool-resolver.ts`

```typescript
// line 58–62
export function resolveTool(name: string): ToolDefinition {
  const tool = getTool(name);          // line 59 — queries internal Map
  if (!tool) throw new ToolNotFoundError(name);  // line 60 — fires here
  return tool;
}
```

| Field | Value |
|---|---|
| Resolver input | `"coding_generate_react_page"` |
| Registry lookup result | `undefined` |
| Failure branch | Line 60 — `!tool` is `true` because registry Map is empty |
| Error thrown | `ToolNotFoundError: [ToolResolver] Tool not found: "coding_generate_react_page"` |

The registry Map is empty at dispatch time. The resolver is functioning correctly — it correctly reports that the key does not exist. The resolver itself is not the bug.

---

## TASK 6 — SERVICE / REPOSITORY VALIDATION

**Failure stage: REGISTRY**

Execution fails **before the tool is ever reached**. The failure occurs in the resolver during registry lookup, not inside the tool handler.

| Stage | Reached? |
|---|---|
| Planner | ✓ Yes |
| Executor | ✓ Yes |
| Dispatcher | ✓ Yes |
| Registry | ✗ **FAILS HERE — Map is empty** |
| Tool | ✗ Never reached |
| Service | ✗ Never reached |
| Repository | ✗ Never reached |

The tool has no required service or repository dependencies. Even if it did, that is irrelevant — the tool never executes.

---

## TASK 7 — TOOL DEPENDENCY AUDIT

The tool (`generate-react-page.ts`) imports:

```typescript
import type { ToolExecutionContext }              from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                   from '../../registry/tool-metadata.ts';
import { defineCodingTool }                      from '../../registry/define-tool.ts';
import type { ReactPageInput }                   from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult } from '../shared/coding-result.ts';
import { invalidInputError }                     from '../shared/coding-errors.ts';
import { validateGeneratedCode }                 from '../validation/generated-code-validator.ts';
import { reactPageTemplate }                     from '../templates/react-template.ts';
import { toKebabCase }                           from '../../shared/string-utils.ts';
```

All imports are:
- Internal to `server/tools/` — no external service or repository dependencies
- Not from `server/services/**`, `server/repositories/**`, or `server/infrastructure/**`
- No broken imports detected

The tool is self-contained. Its dependencies are not the cause of failure.

---

## TASK 8 — ROOT CAUSE CONFIRMATION

### ROOT CAUSE: `loadAllTools()` is never called in `main.ts`

**Confidence: HIGH**

`server/tools/registry/tool-loader.ts` exports `loadAllTools()` as the single boot-time function that populates the registry and seals it. It calls `registerCodingTools()` (and 5 other category registrations) and then `sealRegistry()`.

**`main.ts` imports (lines 12–22) — `loadAllTools` is absent:**
```typescript
import { bootstrapMemory }                              from './server/memory/index.ts';
import { chatOrchestrator }                             from './server/chat/index.ts';
import { initOrchestration, createOrchestrationRouter } from './server/orchestration/index.ts';
import { seedDefaultProject, TOPIC, sseManager }        from './server/infrastructure/index.ts';
import { fileExplorerRouter, legacyFileRouter, ... }    from './server/file-explorer/index.ts';
```

`loadAllTools()` is **never imported and never called**. The registry `Map` is therefore empty when the server starts. Every tool dispatch attempt for any registered tool will fail with `ToolNotFoundError`.

---

### Summary

| Check | Result |
|---|---|
| Missing tool | NO — tool exists at `server/tools/coding/frontend/generate-react-page.ts` |
| Missing registration (code) | NO — registered in `register-coding-tools.ts` line 75 |
| Missing export | NO — exported correctly as `generateReactPageTool` |
| Naming mismatch | NO — `coding_generate_react_page` consistent everywhere |
| Resolver failure | SYMPTOM — resolver correctly reports key not in Map |
| Dispatcher failure | NO — dispatcher functions correctly |
| Missing service | NO — tool has no service dependencies |
| Missing repository | NO — tool has no repository dependencies |
| Broken import | NO — all imports resolve |
| **`loadAllTools()` never called in `main.ts`** | **YES — THIS IS THE ROOT CAUSE** |

**Fix location (identification only — do not fix yet):**  
`main.ts` must import `loadAllTools` from `./server/tools/registry/tool-loader.ts` and call it after `bootstrapMemory()` and before `seedDefaultProject()` / `initOrchestration()`.
