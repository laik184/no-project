# DEEP SCAN REPORT — `server/tools/`
## Tool Architecture Stabilization Analysis

**Scan Date:** 2025-05-28
**Total Files Scanned:** 354
**Total Directories:** 71
**Scan Phases:** 6 (Scan → Analysis → Fix Plan → Refactor Status → Validation → Report)

---

## PART 1 — DIRECTORY MAP

```
server/tools/
├── index.ts                          ← Top-level barrel (public entry point)
│
├── registry/                         ← CORE: 9 files — singleton store + execution pipeline
│   ├── index.ts
│   ├── tool-types.ts
│   ├── tool-registry.ts
│   ├── define-tool.ts
│   ├── tool-resolver.ts
│   ├── tool-dispatcher.ts
│   ├── tool-metrics.ts
│   ├── tool-security.ts
│   └── tool-metadata.ts
│
├── core/                             ← DEPRECATED shims (2 files)
│   ├── execute-tool.ts               ← @deprecated → routes to dispatch()
│   └── tool-context.ts               ← @deprecated → routes to context-builder.ts
│
├── shared/                           ← Shared utilities (4 files)
│   ├── context-builder.ts
│   ├── input-validator.ts
│   ├── logger.ts
│   └── result-helpers.ts
│
├── telemetry/                        ← Cross-category observability hub
│   └── index.ts
│
├── codegen/                          ← Semantic alias for coding/
│   └── index.ts
│
├── filesystem/                       ← ~85 files (read/write/edit/search/lib/...)
├── terminal/                         ← ~60 files (execution/npm/ports/process/security/...)
├── verifier/                         ← ~60 files (build/runtime/tests/typecheck/lib/...)
├── browser/                          ← ~55 files (session/interaction/capture/monitoring/...)
└── coding/                           ← ~55 files (api/auth/backend/components/crud/database/...)
```

---

## PART 2 — PHASE 1: DEEP SCAN FINDINGS

### 2.1 REGISTRY LAYER (`server/tools/registry/`)

| Check | Status | Detail |
|---|---|---|
| Single registry | ✅ OK | Singleton `Map<string, ToolDefinition>` in `tool-registry.ts` |
| `sealRegistry()` called | ✅ OK | Called in `main.ts` line 286 AFTER all 5 category registrations |
| `tool-loader.ts` exists | ❌ MISSING | Architecture spec requires it — currently boot logic lives in `main.ts` |
| Metrics wired to dispatcher | ✅ OK | `recordMetric()` called in ALL paths (success + fail + timeout) |
| Audit wired to dispatcher | ✅ OK | `recordAudit()` called in ALL paths |
| Duplicate registries | ✅ NONE | `unifiedRegistry` shim reads same internal Map — no separate store |
| Circular imports | ✅ NONE | `types → metadata → registry → resolver → dispatcher` (clean chain) |
| Shadow execution | ⚠️ SHIM | `core/execute-tool.ts` is deprecated but still routes through `dispatch()` |
| Unsafe casts in registry | ⚠️ LOW | `as never` (line 129), `as Promise<TOutput>` (line 147) — bridging only |

---

### 2.2 CORE LAYER (`server/tools/core/`)

| File | Status | Issue |
|---|---|---|
| `execute-tool.ts` | ⚠️ DEPRECATED | Shadow executor — marked `@deprecated`, correctly reroutes to `dispatch()`. Safe but should be deleted once all consumers migrated. |
| `tool-context.ts` | ⚠️ DEPRECATED | Old `createContext(projectId, runId)` shim — argument order was SWAPPED vs new `buildContext(runId, projectId)`. Bug trap for unmigrated callers. |

**Risk:** `tool-context.ts` line 28 explicitly warns about argument swap. Any code that migrated to `buildContext` directly without using this shim may have silently inverted `projectId` and `runId`.

---

### 2.3 SHARED LAYER (`server/tools/shared/`)

| File | Role | Status |
|---|---|---|
| `context-builder.ts` | Canonical `ToolExecutionContext` factory | ✅ Correct |
| `input-validator.ts` | Lightweight struct validator (no Zod dep) | ✅ Correct |
| `logger.ts` | Structured JSON logger → EventBus | ✅ Correct |
| `result-helpers.ts` | `ok()`, `fail()`, `unwrapOrThrow()` helpers | ⚠️ Minor cast at line 32 (`as Extract<...>`) — safe due to guarded `if(result.ok)` |

---

### 2.4 FILESYSTEM LAYER (`server/tools/filesystem/`)

| Check | Status | Detail |
|---|---|---|
| Registration via `registerTool()` | ✅ OK | `register-filesystem-tools.ts` iterates tool list and calls `registerTool()` |
| `sandboxRoot` from `ctx` | ✅ OK | All handlers use `ctx.sandboxRoot` — not raw `input.projectId` |
| Dispatcher bypass | ✅ NONE | No agent-driven paths skip dispatcher |
| Tool-to-Agent imports | ✅ NONE | Filesystem tools do not import from `server/agents/` |
| `lib/` vs `validation/` duplication | ⚠️ PATTERN | `validation/*.ts` are thin re-exports of `lib/validation/*.ts` — intentional facade, not true duplication |
| Unsafe casts | ⚠️ MODERATE | `as any` in catch blocks, `as unknown` in traversal utils |
| Internal tool calls (lib level) | ⚠️ NOTE | `patch-file.ts` calls `file-reader.ts` + `file-writer.ts` directly at lib level (not via dispatcher) — acceptable as internal implementation detail |

**Duplicate File Pairs (facade pattern — not bugs):**

| Outer File | Inner lib File |
|---|---|
| `validation/path-validator.ts` | `lib/validation/path-validator.ts` |
| `validation/file-validator.ts` | `lib/validation/file-validator.ts` |
| `validation/sandbox-validator.ts` | `lib/validation/sandbox-validator.ts` |

---

### 2.5 TERMINAL LAYER (`server/tools/terminal/`)

| Check | Status | Detail |
|---|---|---|
| Command parsing | ✅ FIXED | `parse-shell-args.ts` — proper tokenizer, handles quotes + escaped spaces |
| Shell injection risk | ✅ FIXED | `spawn-process.ts` uses `shell: false` + arg array — no shell injection |
| `sandboxRoot` enforcement | ✅ OK | `ctx.sandboxRoot` used as `cwd` in `process-start.ts` + `npm-install.ts` |
| Blocked commands | ✅ OK | `blocked-commands.ts` regex blacklist + `execution-policy.ts` whitelist |
| Registration flow | ✅ OK | `register-terminal-tools.ts` — idempotency guard, 23 tools |
| Duplicate timeout systems | ⚠️ FRAGMENTED | 3 separate timeout concerns across 3 files (see below) |
| Parallel process spawner | ⚠️ RISK | `server/infrastructure/process/` has its own `spawnProcess` — TWO parallel process management systems |

**Timeout Fragmentation (3 files):**

| File | Role |
|---|---|
| `execution/timeout-manager.ts` | Manages individual `setTimeout` handles via Map |
| `security/execution-policy.ts` | `getDefaultTimeoutMs()` — command-to-duration mapping |
| `security/resource-limits.ts` | `clampTimeout()` — min/max clamping (1s–120s) |

**Blocked Command Regex Gap:**
- `blocked-commands.ts` blocks `/\brm\s+-rf\b/` but NOT `rm -r -f` or `rm --recursive --force`
- Mitigation: `ALLOWED_EXECUTABLES` whitelist in `execution-policy.ts` partially covers this

---

### 2.6 VERIFIER LAYER (`server/tools/verifier/`)

| Check | Status | Detail |
|---|---|---|
| Direct execution paths | ⚠️ NOTE | `verifier/index.ts` exports BOTH `ToolDefinition` objects AND raw functions (e.g. `runBuild`) — allows bypassing registry |
| Registration flow | ✅ OK | `register-verifier-tools.ts` — idempotency guard (`_registered` flag), atomic (aborts if one tool fails) |
| `lib/` vs outer duplication | ✅ INTENTIONAL | Clean Architecture pattern — `lib/` = Kernel logic, outer dirs = Shell/Tool adapters |
| Shadow pipelines | ✅ NONE | No untracked background verification processes |
| Duplicate monitoring | ⚠️ OVERLAP | `VerificationMonitor` (lifecycle) + `HealthMonitor` (service health) — distinct but could confuse |
| Structured logging | ⚠️ MISSING | `lib/` core returns errors as data structures, no central log sink (no pino/winston) |
| Trace context (OpenTelemetry) | ⚠️ MISSING | `runId` passed around but not used for distributed tracing spans |

**Kernel/Shell Architecture Map:**

| Functionality | Kernel (`lib/`) | Shell (Tool Adapter) |
|---|---|---|
| Build | `lib/build-runner.ts` | `build/run-build.ts` |
| TypeScript check | `lib/typescript-checker.ts` | `typecheck/run-typecheck.ts` |
| Test execution | `lib/test-runner.ts` | `tests/run-tests.ts` |
| Diagnostics | `lib/error-analyzer.ts` | `diagnostics/error-analyzer.ts` |
| Recovery | `lib/failure-recovery.ts` | `recovery/failure-recovery.ts` |
| Health | `lib/health-monitor.ts` | `monitoring/health-monitor.ts` |

---

### 2.7 BROWSER LAYER (`server/tools/browser/`)

| Check | Status | Detail |
|---|---|---|
| Tool-to-Agent imports | ⚠️ RISK | `browser-lifecycle.ts` imports from `server/agents/browser/core/` — agent boundary crossed |
| Dispatcher bypass | ✅ NONE | Tool handlers follow standard pattern |
| Duplicate monitoring | ⚠️ OVERLAP | 4 partially overlapping health/performance files (see below) |
| Unsafe casts | ⚠️ PRESENT | `as unknown as ToolDefinition` still used in some browser tool exports |
| Session management | ✅ OK | `browser-context.ts` — module-level `Map<runId, LiveBrowserSession>` |
| Registration | ✅ OK | `register-browser-tools.ts` — 31 tools registered, idempotent |

**Browser Monitoring Overlap (4 files, partially redundant):**

| File | Concern |
|---|---|
| `monitoring/browser-health-monitor.ts` | Tool: `browser_health` — registered tool |
| `monitoring/health-monitor-core.ts` | Internal logic + `setInterval` monitor |
| `monitoring/performance-metrics.ts` | In-memory latency store |
| `validation/performance-tracker.ts` | Actual Playwright timing collection |

---

### 2.8 CODING LAYER (`server/tools/coding/`)

| Check | Status | Detail |
|---|---|---|
| Tool-to-Agent imports | ⚠️ RISK | Multiple coding tools import from `server/agents/coderx/utils.ts` (`toPascalCase`, `toKebabCase`) |
| Unsafe casts | ⚠️ BEING FIXED | `as unknown as ToolDefinition` being replaced by `defineCodingTool()` helper — migration in progress |
| Dispatcher bypass | ✅ NONE | All handlers stateless templates / LLM wrappers |
| Duplicate monitoring | ✅ NONE | Coding tools are stateless, no monitoring needed |
| Registration | ✅ OK | `register-coding-tools.ts` — 46 tools registered |
| LLM calls | ✅ OK | Abstracted through `coding/llm/` utilities (prompt-builder, response-parser) |

**Affected coding files importing from `agents/coderx/utils.ts`:**
- `coding/components/generate-modal.ts`
- `coding/backend/generate-service.ts`
- Multiple other `coding/` files using `toPascalCase` / `toKebabCase`

---

### 2.9 TELEMETRY & CODEGEN

| File | Status | Detail |
|---|---|---|
| `telemetry/index.ts` | ⚠️ FRAGILE | Uses `tool.split('_')[0]` to guess categories — tools not following `category_name` convention get binned as `"unknown"` |
| `codegen/index.ts` | ✅ OK | Semantic alias re-exporting `coding/` tools — clean and intentional |

---

## PART 3 — PHASE 2: ARCHITECTURE ANALYSIS

### 3.1 Current Execution Flow (Actual)

```
Agent / API Route
     ↓
dispatch() in tool-dispatcher.ts         ← CANONICAL path ✅
     ↓
resolveToolWithPermissions()
     ↓
getTool() from tool-registry.ts
     ↓
withRetry(withTimeout(handler()))
     ↓
recordMetric() + recordAudit()
     ↓
ToolExecutionResult

--- ALSO EXISTS (deprecated) ---

executeTool() in core/execute-tool.ts    ← SHIM path ⚠️
     ↓  (internally calls dispatch())
Same flow above

--- ALSO EXISTS (risk) ---

verifier/index.ts exports raw runBuild() ← BYPASS path ❌
     ↓  (no dispatcher, no metrics, no audit)
Direct function call
```

### 3.2 Registration Flow (Actual)

```
main.ts boot
     ↓
registerFilesystemTools()   → 26 tools
registerTerminalTools()     → 23 tools
registerVerifierTools()     → 28 tools
registerBrowserTools()      → 31 tools
registerCodingTools()       → 46 tools
     ↓
sealRegistry()              ← Correct ✅
     ↓
System ready — 154 total tools
```

**Problem:** All registration logic lives in `main.ts`. No dedicated `tool-loader.ts` exists.

### 3.3 What Is Missing vs Architecture Spec

| Required | Present | Status |
|---|---|---|
| Single dispatcher | `tool-dispatcher.ts` | ✅ |
| Single registry | `tool-registry.ts` | ✅ |
| `tool-loader.ts` | ❌ Not found | ❌ MISSING |
| `sealRegistry()` after boot | In `main.ts` | ✅ |
| Metrics wired | `tool-dispatcher.ts` | ✅ |
| Audit wired | `tool-dispatcher.ts` | ✅ |
| Sandbox secure (`ctx.sandboxRoot`) | All categories | ✅ |
| No dispatcher bypass | `verifier/index.ts` exports raw fns | ⚠️ PARTIAL |
| No Tool→Agent imports | `browser/`, `coding/` violate | ❌ VIOLATED |
| Production shell parsing | `parse-shell-args.ts` | ✅ |
| Centralized execution pipeline | Yes via dispatcher | ✅ |

---

## PART 4 — PHASE 3: PROBLEM CATALOGUE

### CRITICAL (Must Fix)

| ID | Problem | Location | Risk |
|---|---|---|---|
| C-01 | `tool-loader.ts` MISSING | `registry/` | Boot coupling — registration logic pollutes `main.ts` |
| C-02 | Tool → Agent import: `browser-lifecycle.ts` → `agents/browser/core/` | `browser/session/` | Circular dependency risk if agent imports browser tools |
| C-03 | Tool → Agent import: coding tools → `agents/coderx/utils.ts` | `coding/components/`, `coding/backend/` | Same circular risk; coderx utils should live in `shared/` |
| C-04 | `verifier/index.ts` exports raw execution functions | `verifier/index.ts` | Callers can bypass dispatcher — no metrics, no audit, no timeout |

### HIGH (Should Fix)

| ID | Problem | Location | Risk |
|---|---|---|---|
| H-01 | Deprecated `core/execute-tool.ts` still alive | `core/` | Dead code trap — new devs may use it |
| H-02 | Deprecated `core/tool-context.ts` argument order swap | `core/` | Silent `projectId`/`runId` swap for unmigrated callers |
| H-03 | Blocked command regex misses `rm -r -f` / `rm --recursive` | `terminal/security/blocked-commands.ts` | Potential sandbox escape if whitelist gaps exist |
| H-04 | Two parallel process spawners | `tools/terminal/` vs `infrastructure/process/` | Split ownership — terminal tools may not track infra-spawned processes |
| H-05 | `as unknown as ToolDefinition` still in browser tool exports | `browser/` | Type safety bypass — could allow malformed tool registration |

### MODERATE (Should Address)

| ID | Problem | Location | Risk |
|---|---|---|---|
| M-01 | `telemetry/index.ts` uses `tool.split('_')[0]` for category | `telemetry/` | Tools without `category_` prefix silently bucketed as `"unknown"` |
| M-02 | Timeout logic fragmented across 3 files | `terminal/security/` + `terminal/execution/` | Hard to audit effective timeout values |
| M-03 | 4 overlapping browser monitoring files | `browser/monitoring/` | Unclear ownership — `setInterval` in `health-monitor-core.ts` runs outside tool lifecycle |
| M-04 | Verifier has no structured central logging | `verifier/lib/` | Errors returned as data, not logged — silent failures in lib core |
| M-05 | `defineCodingTool()` migration incomplete | `coding/` | Some files still use old `as unknown as ToolDefinition` |
| M-06 | `filesystem/validation/` are re-export facades | `filesystem/` | Confusing — two paths to same logic |

### LOW (Nice to Fix)

| ID | Problem | Location | Risk |
|---|---|---|---|
| L-01 | `codegen/index.ts` is semantic alias only | `codegen/` | Fine as-is, but adds one more indirection layer |
| L-02 | `as never` cast in `tool-dispatcher.ts` line 129 | `registry/` | Bridging cast, functionally safe |
| L-03 | No OpenTelemetry trace spans | All layers | No distributed tracing capability |
| L-04 | `verifier/shared/verifier-types.ts` re-exports `lib/verifier-types.ts` | `verifier/` | Intentional alias — confusion risk only |

---

## PART 5 — PHASE 4: FIX PLAN (File-by-File)

### FIX-01: CREATE `server/tools/registry/tool-loader.ts`

**Current Issue:** Registration of all 5 tool categories is done directly in `main.ts`. No single file owns the boot registration flow.

**Fix Strategy:**
```typescript
// server/tools/registry/tool-loader.ts
import { registerFilesystemTools } from '../filesystem/index.ts';
import { registerTerminalTools }   from '../terminal/index.ts';
import { registerVerifierTools }   from '../verifier/index.ts';
import { registerBrowserTools }    from '../browser/index.ts';
import { registerCodingTools }     from '../coding/index.ts';
import { sealRegistry, toolCount } from './tool-registry.ts';

export function loadAllTools(): void {
  registerFilesystemTools();
  registerTerminalTools();
  registerVerifierTools();
  registerBrowserTools();
  registerCodingTools();
  sealRegistry();
  console.log(`[tool-loader] ${toolCount()} tools registered and registry sealed.`);
}
```

**main.ts change:** Replace 5 individual calls + `sealRegistry()` with `loadAllTools()`.

**Migration Safety:** Zero — purely additive. No API changes.

---

### FIX-02: MOVE `coderx/utils.ts` helpers to `server/tools/shared/`

**Current Issue:** `coding/` tools import `toPascalCase`, `toKebabCase` from `server/agents/coderx/utils.ts` — crossing the tool→agent boundary.

**Fix Strategy:**
1. Create `server/tools/shared/string-utils.ts` with `toPascalCase`, `toKebabCase`
2. Update all `coding/` files to import from `../../shared/string-utils.ts`
3. Make `agents/coderx/utils.ts` re-export from `tools/shared/string-utils.ts`

**Migration Safety:** Step 3 preserves all existing agent imports — zero breakage.

---

### FIX-03: REMOVE browser-to-agent import

**Current Issue:** `browser/session/browser-lifecycle.ts` imports `launchBrowserSession`, `closeBrowserSession` from `server/agents/browser/core/`.

**Fix Strategy:**
- Move the browser session management primitives into `browser/session/` tool layer
- Update `agents/browser/core/` to import from `tools/browser/session/`

**Migration Safety:** Interface-compatible move. Agent layer gets same functions from different import path.

---

### FIX-04: SEAL verifier raw function exports

**Current Issue:** `verifier/index.ts` exports both `ToolDefinition` objects AND raw `runBuild()`, `runTypeCheck()` etc. — allows bypassing the dispatcher.

**Fix Strategy:**
- Remove raw function exports from `verifier/index.ts`
- Keep only `ToolDefinition` exports and `registerVerifierTools()`
- Internal lib calls (within verifier) remain fine — they are implementation details

**Migration Safety:** Check all consumers of `verifier/index.ts`. If `runBuild` is called directly outside tools layer, redirect to `dispatch('verifier_run_build', ...)`.

---

### FIX-05: DELETE deprecated `core/` files (after migration complete)

**Files to delete:**
- `server/tools/core/execute-tool.ts`
- `server/tools/core/tool-context.ts`

**Precondition:** Zero remaining imports of these files in the codebase.

**Migration Safety:** Grep for all imports before deleting. Run TypeScript compiler to confirm zero errors.

---

### FIX-06: FIX `blocked-commands.ts` regex gaps

**Current Issue:** `/\brm\s+-rf\b/` misses `rm -r -f`, `rm --recursive --force`

**Fix Strategy:**
```typescript
// Better pattern:
/\brm\b.*?(-[^\s]*r[^\s]*f|--recursive|--force)/i
```

Or more robustly: after parsing shell args with `parse-shell-args.ts`, check the parsed argument array for `rm` + dangerous flags rather than regex on raw string.

---

### FIX-07: CONSOLIDATE timeout logic

**Current Issue:** 3 files handle different aspects of timeouts

**Fix Strategy:** Keep all 3 but document ownership clearly:
- `timeout-manager.ts` → handles `setTimeout` lifecycle
- `execution-policy.ts` → policy (what timeout applies to which command)
- `resource-limits.ts` → enforcement (clamp values)

Add a single orchestration function `resolveTimeout(cmd, userInput)` in `timeout-manager.ts` that calls the other two.

---

### FIX-08: COMPLETE `defineCodingTool()` migration

**Current Issue:** Some `coding/` and `browser/` files still use `as unknown as ToolDefinition`

**Fix:** Global find-replace:
- Find: `} as unknown as ToolDefinition`
- Replace: wrap definition in `defineTool({ ... })`

---

## PART 6 — PHASE 5: VALIDATION CHECKLIST

```
DISPATCHER VALIDATION
  [✅] Only ONE dispatcher exists: tool-dispatcher.ts
  [✅] dispatch() is the only public execution entry point
  [⚠️] verifier/index.ts still exports raw functions — PARTIAL bypass risk
  [✅] dispatchAll() for parallel, dispatchSequential() for ordered

REGISTRY VALIDATION
  [✅] Only ONE registry exists: tool-registry.ts (singleton Map)
  [✅] sealRegistry() called in main.ts after all registrations
  [✅] Duplicate registrations throw ToolRegistryError
  [✅] registry.clear() only available via _resetRegistryForTests()
  [❌] tool-loader.ts does NOT exist yet

SANDBOX VALIDATION
  [✅] filesystem tools: ctx.sandboxRoot used
  [✅] terminal tools: ctx.sandboxRoot as cwd
  [✅] terminal validation: assertSandboxPath() called
  [✅] no raw input.projectId used for path construction
  [✅] shell: false in spawn — no shell injection

METRICS VALIDATION
  [✅] invocations tracked
  [✅] failures tracked
  [✅] retries tracked
  [✅] timeouts tracked
  [✅] avgDurationMs tracked (running average)
  [✅] all paths (success/fail/timeout/permission) call recordMetric()

AUDIT VALIDATION
  [✅] all dispatch paths call recordAudit()
  [✅] 500-entry circular buffer
  [✅] includes: toolName, category, runId, ok, durationMs, errorCode

AGENT COUPLING VALIDATION
  [❌] browser/session/browser-lifecycle.ts imports from agents/browser/core/
  [❌] coding/ tools import from agents/coderx/utils.ts
  [✅] filesystem/ — no agent imports
  [✅] terminal/ — no agent imports
  [✅] verifier/ — no agent imports

TYPE SAFETY VALIDATION
  [✅] defineTool() / defineCodingTool() helpers exist
  [⚠️] Migration incomplete — some browser/coding files still use as unknown as ToolDefinition
  [⚠️] tool-dispatcher.ts line 147: as Promise<TOutput> — optimistic cast
  [⚠️] tool-context.ts: projectId/runId argument order swap — silent bug trap
```

---

## PART 7 — PHASE 6: FINAL ARCHITECTURE

### Target Execution Flow (After Fixes)

```
Executor Agent / API Route
         ↓
  dispatch(name, input, context)
  [tool-dispatcher.ts]
         ↓
  resolveToolWithPermissions(name, context)
  [tool-resolver.ts]
         ↓ ToolNotFoundError / ToolPermissionError on fail
  getTool(name)
  [tool-registry.ts]  ← sealed after boot
         ↓
  withRetry(withTimeout(definition.handler(input, context)))
         ↓
  Tool executes inside ctx.sandboxRoot
         ↓
  recordMetric() + recordAudit()  ← ALWAYS (success or fail)
         ↓
  return ToolExecutionResult<T>   ← NEVER throws
```

### Target Registration Flow (After tool-loader.ts created)

```
system boot (main.ts)
         ↓
  loadAllTools()
  [server/tools/registry/tool-loader.ts]
         ↓
  registerFilesystemTools()   → 26 tools
  registerTerminalTools()     → 23 tools
  registerVerifierTools()     → 28 tools
  registerBrowserTools()      → 31 tools
  registerCodingTools()       → 46 tools
         ↓
  sealRegistry()
         ↓
  [154 tools locked — no injection possible]
         ↓
  system ready
```

### Target Directory Structure (Clean)

```
server/tools/
├── index.ts                      ← barrel
│
├── registry/
│   ├── index.ts
│   ├── tool-types.ts             ← types (no deps)
│   ├── tool-metadata.ts          ← catalogue + constants
│   ├── tool-registry.ts          ← singleton store + seal
│   ├── define-tool.ts            ← type-safe helper
│   ├── tool-resolver.ts          ← lookup + permission gate
│   ├── tool-dispatcher.ts        ← ONLY execution pipeline
│   ├── tool-metrics.ts           ← performance tracking
│   ├── tool-security.ts          ← audit log
│   └── tool-loader.ts            ← [TO CREATE] boot registration
│
├── shared/
│   ├── context-builder.ts        ← canonical context factory
│   ├── input-validator.ts
│   ├── logger.ts
│   ├── result-helpers.ts
│   └── string-utils.ts           ← [TO CREATE] move from agents/coderx/utils.ts
│
├── core/                         ← [TO DELETE after migration]
│   ├── execute-tool.ts           ← @deprecated shim
│   └── tool-context.ts           ← @deprecated shim
│
├── telemetry/index.ts
├── codegen/index.ts
│
├── filesystem/  (clean — no agent imports)
├── terminal/    (clean — no agent imports)
├── verifier/    (fix: remove raw fn exports from index.ts)
├── browser/     (fix: remove agent/browser/core imports)
└── coding/      (fix: move coderx/utils → shared/string-utils)
```

---

## PART 8 — PRIORITY ACTION SUMMARY

| Priority | Action | File | Effort |
|---|---|---|---|
| 🔴 P0 | Create `tool-loader.ts` | `registry/tool-loader.ts` | 30 min |
| 🔴 P0 | Remove raw fn exports from `verifier/index.ts` | `verifier/index.ts` | 1 hr |
| 🔴 P0 | Move `coderx/utils.ts` helpers to `shared/string-utils.ts` | `shared/`, `coding/`, `agents/` | 1 hr |
| 🟠 P1 | Remove browser→agent imports in `browser-lifecycle.ts` | `browser/session/` | 2 hr |
| 🟠 P1 | Fix blocked command regex gaps | `terminal/security/` | 30 min |
| 🟠 P1 | Complete `defineCodingTool()` migration | `coding/`, `browser/` | 1 hr |
| 🟡 P2 | Delete `core/execute-tool.ts` + `core/tool-context.ts` | `core/` | 30 min (after audit) |
| 🟡 P2 | Fix `telemetry/index.ts` category detection | `telemetry/` | 30 min |
| 🟡 P2 | Consolidate timeout logic into single orchestrator | `terminal/execution/` | 1 hr |
| 🟢 P3 | Add structured logging to `verifier/lib/` | `verifier/lib/` | 2 hr |
| 🟢 P3 | Consolidate browser monitoring (4→2 files) | `browser/monitoring/` | 2 hr |

---

## SUCCESS CRITERIA (Post-Fix)

```
✅ ONE dispatcher exists (tool-dispatcher.ts)
✅ ONE registry exists (tool-registry.ts)
✅ tool-loader.ts exists and owns boot registration
✅ ALL tools register via registerTool()
✅ registry sealed after boot via sealRegistry()
✅ metrics work (invocations, failures, timeouts, retries, avgDuration)
✅ audit works (every dispatch logged)
✅ sandbox secure (ctx.sandboxRoot only — no raw path construction)
✅ no dispatcher bypass (verifier raw exports removed)
✅ no Tool → Agent imports (coderx utils moved, browser-lifecycle fixed)
✅ centralized execution pipeline
✅ production-grade shell parsing (parse-shell-args.ts)
✅ type-safe tool definitions via defineTool() / defineCodingTool()
```

---

*Report generated from deep scan of 354 files across 71 directories in `server/tools/`*
*Scan methodology: 6 parallel subagent scans across registry, filesystem, terminal, verifier, browser, and coding layers*
