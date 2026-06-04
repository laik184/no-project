# DEEP SCAN + WORKFLOW VALIDATION REPORT

**Generated:** 2026-06-04  
**Scope:** Full end-to-end workflow validation before any fix  
**Status:** VALIDATION COMPLETE — DO NOT FIX YET

---

## PHASE 1 — STARTUP BOOT FLOW

### Actual Startup Execution Order (`main.ts`)

| # | Action | Source | Status |
|---|---|---|---|
| 1 | `express()` + middleware | `main.ts:26–29` | ✓ Runs |
| 2 | `bootstrapMemory()` | `server/memory/index.ts` | ✓ Runs |
| 3 | `/health` + `/api/realtime` + stub routes | `main.ts:39–94` | ✓ Runs |
| 4 | `chatOrchestrator.mountRoutes(app)` | `server/chat/index.ts` | ✓ Runs |
| 5 | `createOrchestrationRouter()` | `server/orchestration/index.ts` | ✓ Runs |
| 6 | `fileExplorerRouter` + `legacyFileRouter` | `server/file-explorer/index.ts` | ✓ Runs |
| 7 | `http.createServer(app)` | `main.ts:116` | ✓ Runs |
| 8 | `chatOrchestrator.bootstrap(server)` | `server/chat/index.ts` | ✓ Runs |
| 9 | `initOrchestration()` | `server/orchestration/index.ts` | ✓ Runs |
| 10 | `subscribeToAgentFileEvents()` | `server/file-explorer/index.ts` | ✓ Runs |
| 11 | `seedDefaultProject()` → `server.listen()` | `main.ts:129–136` | ✓ Runs |
| — | **`loadAllTools()`** | `server/tools/registry/tool-loader.ts` | **✗ NEVER CALLED** |

### Verification

| Check | Result |
|---|---|
| `loadAllTools` imported in `main.ts`? | **NO** |
| `loadAllTools` called anywhere in boot path? | **NO** — confirmed by grep across all `main.ts` dependencies |
| `registerCodingTools()` called directly by any boot function? | **NO** |
| Registry populated at `server.listen()`? | **NO — Map is empty** |
| Registry sealed at `server.listen()`? | **NO — `_sealed` is `false`** |

---

## PHASE 2 — TOOL REGISTRY VALIDATION

### Expected vs Actual Registry Count

| Category | Expected (if `loadAllTools` ran) | Actual at Runtime |
|---|---|---|
| Filesystem | 42 | **0** |
| Terminal | 23 | **0** |
| Verifier | 28 | **0** |
| Browser | 37 | **0** |
| Coding | 46 | **0** |
| Planner | 1 (`create_execution_plan`) | **0** |
| **TOTAL** | **177** | **0** |

**Registry size before first dispatch: 0**  
**Registry size at any dispatch attempt: 0**  
**Registry sealed: NO**

The `tool-registry.ts` Map exists and is correctly implemented. It is simply never populated.

---

## PHASE 3 — END-TO-END EXECUTION TEST

### Scenario: "Create HTML file" / "Create React page"

| Step | File | Action | Result |
|---|---|---|---|
| 1 — User Request | — | User submits prompt | ✓ **PASS** |
| 2 — Planner | `task-planner.ts` | `analyzeGoal` detects `frontend` component, emits `toolName: "execute_frontend_task"`, `subKind: "generate_page"` | ✓ **PASS** |
| 3 — PlanTask→ExecutionTask | `agent-coordinator.ts:39–64` | `normalizeTaskKind("execute_frontend_task")` → regex extracts `frontend` → `MAP['frontend']` = `'coding'` → `task.kind = 'coding'` | ✓ **PASS** |
| 4 — Executor | `execution-loop.ts` | Iterates tasks, calls `executeTask` | ✓ **PASS** |
| 5 — Coordinator | `tool-coordinator.ts:175–178` | `switch(task.kind)` → `'coding'` → `coordinateCoding(task)` → `toolMap['generate_page']` = `'coding_generate_react_page'` | ✓ **PASS** |
| 6 — Step Runner | `step-runner.ts` | Calls `executeTool('coding_generate_react_page', ...)` | ✓ **PASS** |
| 7 — Dispatcher Client | `dispatcher-client.ts:34` | `dispatch('coding_generate_react_page', ...)` | ✓ **PASS** |
| 8 — Tool Dispatcher | `tool-dispatcher.ts` | Calls `resolveToolWithPermissions(name, ctx)` | ✓ **PASS** |
| 9 — Tool Resolver | `tool-resolver.ts:59` | `getTool('coding_generate_react_page')` → `undefined` | ✗ **FAIL** |
| 10 — ToolNotFoundError | `tool-resolver.ts:60` | `throw new ToolNotFoundError('coding_generate_react_page')` | ✗ **FAIL** |
| 11 — Step marked `failed` | `step-runner.ts:88–93` | After retries exhausted, step returns `ok: false` | ✗ **FAIL** |

**First failing step: Step 9 — `tool-resolver.ts:60`**  
**Last successful step: Step 8 — `tool-dispatcher.ts` (before resolver is called)**

---

## PHASE 4 — TOOL EXECUTION VALIDATION

**Note:** This phase validates what would happen if the registry were populated.

| Check | Result |
|---|---|
| Tool handler exists | ✓ YES — `generate-react-page.ts:29` |
| Input schema validates `name` field | ✓ YES — `input.name?.trim()` guard at line 31 |
| Template generation works | ✓ YES — `reactPageTemplate(input.name, input.content)` at line 34 |
| Output object is correct | ✓ YES — returns `codingOk(templateResult(files, ...))` |
| Broken imports | ✓ NONE — all 9 imports resolve within `server/tools/` |

**Tool Execution Status: WOULD SUCCEED if registry were populated**

---

## PHASE 5 — FILE GENERATION FLOW

```
coding_generate_react_page
        ↓
  reactPageTemplate()   ← pure string generation
        ↓
  files = { "src/pages/<name>.tsx": <code> }   ← in-memory Map
        ↓
  validateGeneratedCode(files, ctx.sandboxRoot)  ← validation only
        ↓
  return codingOk(templateResult(files, ...))   ← returned to Executor
        ↓
  Executor receives { ok: true, output: { files: {...} } }
        ↓
  ⚠️  NO automatic write step follows
```

| Check | Result |
|---|---|
| Does tool return code? | ✓ YES |
| Does tool return file map? | ✓ YES — `{ "src/pages/<name>.tsx": "<code>" }` |
| Does tool write files to disk? | **✗ NO — explicitly does not write to disk** (description line 19 confirms this) |
| Does tool require another tool to persist output? | **⚠️ YES — `write_file` must be called after** |
| Does tool require service/repository? | ✓ NO |

### ⚠️ SECONDARY BLOCKER IDENTIFIED HERE — See Phase 8

---

## PHASE 6 — SERVICE / REPOSITORY CONFIRMATION

Imports in `server/tools/coding/frontend/generate-react-page.ts`:

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

| Dependency | Required |
|---|---|
| `server/services/**` | **NO** |
| `server/repositories/**` | **NO** |
| `server/infrastructure/**` | **NO** |

All imports are internal to `server/tools/`. The tool is a pure code generator.

---

## PHASE 7 — MULTI-SCENARIO TEST

All scenarios route through the same broken chain. The coordinator mapping for each:

| Scenario | Planner SubKind | Coordinator Tool Target | Registry Result |
|---|---|---|---|
| Create HTML page | `generate_page` | `coding_generate_react_page` | ✗ NOT FOUND |
| Create React page | `generate_page` | `coding_generate_react_page` | ✗ NOT FOUND |
| Create Dashboard | `generate_dashboard` | `coding_generate_dashboard` | ✗ NOT FOUND |
| Create Landing Page | `generate_page` | `coding_generate_react_page` | ✗ NOT FOUND |
| Create Settings Page | `generate_page` | `coding_generate_react_page` | ✗ NOT FOUND |
| Create Admin Panel | `generate_dashboard` | `coding_generate_dashboard` | ✗ NOT FOUND |

**All 6 scenarios fail at the same step (resolver, `tool-resolver.ts:60`) for the same reason: empty registry.**  
Every tool in the system is equally affected — not just `coding_generate_react_page`.

---

## PHASE 8 — ROOT CAUSE CONFIRMATION + SECONDARY BLOCKERS

### Primary Root Cause — CONFIRMED

**`loadAllTools()` is never called during application startup.**

- Defined in: `server/tools/registry/tool-loader.ts:25`
- Never imported by: `main.ts`
- Never imported by: any file called from `main.ts`
- Effect: Registry `Map` stays empty. All 177 tools are invisible to the dispatcher.
- First failure: `tool-resolver.ts:60` on every tool dispatch attempt
- Is this the first failure point? **YES** — nothing downstream of the resolver is ever reached

**If fixed:** `coding_generate_react_page` will resolve and execute correctly.

---

### Secondary Blockers (active after primary fix)

#### BLOCKER 2 — Code generation does not write files to disk

**Severity: HIGH**

`coding_generate_react_page` (and all other coding tools in the `coding` category) return a **file map** — an in-memory object of `{ filePath: code }`. They explicitly do **not** write to disk (per tool description, `generate-react-page.ts:19`).

After the executor receives the file map from a coding tool, there is no automatic follow-up step that calls `write_file` (from the filesystem tool category) to persist the generated code. The executor currently does not chain coding → write steps.

**Evidence:**
- `generate-react-page.ts:35–36` — `const files = { [filename]: code }` — local object, no disk I/O
- `generate-react-page.ts:43–47` — returns `codingOk(templateResult(files, ...))` — back to executor
- `tool-coordinator.ts` — no coding task result is piped to a filesystem write step
- `execution-loop.ts` — processes tasks independently with no cross-task output forwarding

**Result:** Even with the registry populated, generated React page code will be computed but never written to `.sandbox/`. The user's project directory will remain empty.

---

#### BLOCKER 3 — `create_execution_plan` was never registered as a planner tool

**Severity: MEDIUM**

`server/tools/planner/register-planner-tools.ts` registers a tool named `create_execution_plan`. The planner agent calls this tool to produce a structured plan before handing off to the executor. Because `loadAllTools()` is never called (Blocker 1), this tool is also missing from the registry — but it would remain missing even if the planner called it before the executor, because its registration function is also only reachable via `loadAllTools()`.

**Note:** Memory file `agent-runtime-recovery.md` confirms this blocker was already identified historically: *"coordinator dispatch removed from planning-loop (create_execution_plan was never registered)"*. The workaround in `agent-coordinator.ts` calls `runPlannerCycle()` directly — bypassing the tool-layer — so the planner itself can still produce a plan. This blocker is **partially mitigated** but will re-surface if the planner tool-layer path is ever restored.

---

### Summary

| Blocker | Stage | Severity | Blocks execution? |
|---|---|---|---|
| **[1] `loadAllTools()` never called** | Registry (startup) | **CRITICAL** | YES — all 177 tools invisible |
| **[2] Coding tools return file map, never write disk** | Tool → Executor output | **HIGH** | YES — files generated but not persisted |
| **[3] `create_execution_plan` tool never registered** | Registry (planner) | MEDIUM | Partially mitigated by direct agent call |

---

## FINAL OUTPUT

### 1. Startup Flow

```
main.ts boots
  → bootstrapMemory()   ✓
  → routes mounted      ✓
  → server.listen()     ✓
  → loadAllTools()      ✗ MISSING
```

### 2. Registry Flow

```
loadAllTools()       ← NEVER CALLED
  → registerFilesystemTools()  (42 tools)
  → registerTerminalTools()    (23 tools)
  → registerVerifierTools()    (28 tools)
  → registerBrowserTools()     (37 tools)
  → registerCodingTools()      (46 tools)
  → registerPlannerTools()     ( 1 tool)
  → sealRegistry()
         ↑
Registry stays at 0 tools, unsealed
```

### 3. Tool Execution Flow (if Blocker 1 were fixed)

```
Planner → kind:'coding', subKind:'generate_page'
  → Coordinator → 'coding_generate_react_page'   ✓
  → Resolver → getTool() → found                 ✓
  → Handler → reactPageTemplate()                ✓
  → Returns { files: { "src/pages/x.tsx": "..." } }
  → Executor receives file map                    ✓
  → File map NOT written to disk                  ✗ BLOCKER 2
```

### 4. End-to-End Workflow Result

**FAIL** — blocked at Blocker 1 before any tool executes.  
After Blocker 1 fix: **FAIL** — blocked at Blocker 2 (files not written to sandbox).

### 5. Secondary Blockers

| # | Blocker | File |
|---|---|---|
| 2 | Coding tools return file map but no write step follows | `execution-loop.ts`, `tool-coordinator.ts` |
| 3 | `create_execution_plan` tool registration path broken | `server/tools/planner/register-planner-tools.ts` |

### 6. Final Confidence Level

| Finding | Confidence |
|---|---|
| `loadAllTools()` missing from startup is root cause | **HIGH — confirmed by full grep, no call site exists** |
| Fixing Blocker 1 alone is insufficient for end-to-end success | **HIGH — tool is pure; no write mechanism follows** |
| Naming, coordinator, and resolver chains are all correct | **HIGH — full trace confirms no mismatch** |
| Blocker 3 is partially mitigated by current workaround | **MEDIUM — workaround in agent-coordinator.ts confirmed** |
