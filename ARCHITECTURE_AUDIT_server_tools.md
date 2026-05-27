# Architecture Audit Report — `server/tools/`

**Scope:** `server/tools/` — deep structural, coupling, security, and migration analysis  
**Auditor classification:** Senior Principal Architecture Review  
**Type:** Read-only audit. Zero code modifications.

---

## SECTION 1 — CURRENT STRUCTURE

### Directory Layout (actual, as-found)

```
server/tools/                          ← 12,556 lines across 185 files
│
├── index.ts                           ← top-level barrel
│
├── registry/                          ← centralized dispatch layer
│   ├── index.ts                       ← barrel re-export
│   ├── tool-types.ts                  ← core type contracts
│   ├── tool-registry.ts               ← singleton store + compat shim
│   ├── tool-dispatcher.ts             ← execution engine (timeout + retry)
│   ├── tool-resolver.ts               ← resolution + permission validation
│   ├── tool-metadata.ts               ← metadata catalogue + timeout/retry constants
│   └── tool-security.ts              ← audit log (misnamed — see Section 2)
│
├── core/                              ← PARALLEL execution layer (shadow of registry)
│   ├── execute-tool.ts                ← second executor, different interface
│   └── tool-context.ts                ← second context type + factory
│
├── shared/                            ← cross-category utilities
│   ├── context-builder.ts             ← third context factory
│   ├── input-validator.ts             ← lightweight schema validation
│   ├── result-helpers.ts              ← ok()/fail() constructors
│   └── logger.ts                      ← structured JSON logger
│
├── filesystem/   (38 tools)           ← MIGRATED
│   ├── registry/register-filesystem-tools.ts
│   ├── read/     (4)
│   ├── write/    (4)
│   ├── edit/     (5)
│   ├── delete/   (3)
│   ├── move/     (4)
│   ├── clone/    (2)
│   ├── search/   (8)
│   ├── structure/(4)
│   ├── folders/  (6)
│   ├── validation/                    ← re-exports from server/agents/
│   └── shared/
│
├── terminal/   (23 tools)             ← MIGRATED
│   ├── registry/register-terminal-tools.ts
│   ├── execution/ (6)
│   ├── npm/      (10)
│   ├── ports/    (7)
│   ├── process/  (8)
│   ├── security/ (4)
│   ├── validation/(5)
│   └── shared/ + monitoring/
│
├── browser/    (30 tools)             ← MIGRATED
│   ├── registry/register-browser-tools.ts
│   ├── navigation/ (6)
│   ├── interaction/(9)
│   ├── capture/    (4)
│   ├── validation/ (8)               ← naming conflict: detectors
│   ├── validation-core/ (4)           ← naming conflict: input validators
│   ├── session/    (4)
│   ├── monitoring/ (4)
│   └── shared/
│
├── verifier/   (28 tools)             ← MIGRATED
│   ├── registry/register-verifier-tools.ts
│   ├── build/      (4)
│   ├── tests/      (4)
│   ├── typecheck/  (4)
│   ├── runtime/    (5)
│   ├── recovery/   (3)
│   ├── diagnostics/(4)
│   ├── validation/ (5)
│   ├── monitoring/ (4)
│   └── shared/
│
└── coding/    (46 tools)              ← MIGRATED (category identity problem)
    ├── registry/register-coding-tools.ts
    ├── frontend/   (7)
    ├── backend/    (7)
    ├── api/        (6)
    ├── auth/       (7)
    ├── database/   (7)
    ├── components/ (7)
    ├── crud/       (5)
    ├── llm/        (5)                ← prompt/response internals
    ├── templates/  (5)
    ├── validation/ (5)
    └── shared/     (4)
```

### Tool Counts by Category

| Category   | Tools | Files | Avg File Size |
|------------|-------|-------|---------------|
| filesystem | 38    | 45    | ~40 lines     |
| terminal   | 23    | 35    | ~45 lines     |
| browser    | 30    | 41    | ~55 lines     |
| verifier   | 28    | 34    | ~50 lines     |
| coding     | 46    | 60    | ~70 lines     |
| **Total**  | **165**| **215**| —           |

---

## SECTION 2 — CURRENT PROBLEMS

### PROBLEM 1 — DUAL EXECUTOR: THE WORST STRUCTURAL DEFECT

There are **two completely separate execution paths** for tools:

**Path A — The correct path** (`registry/tool-dispatcher.ts`):
```
Agent → dispatch() → resolveToolWithPermissions() → withRetry() → withTimeout() → handler()
```

**Path B — The shadow path** (`core/execute-tool.ts`):
```
node-executor.ts → unifiedRegistry.getEntry() → executeTool(entry, args, ctx)
```

`execute-tool.ts` defines its own `RegisteredToolEntry` interface and its own `ToolExecuteResult` return type, which are entirely different from the registry types. Path B bypasses:
- Permission validation (no `resolveToolWithPermissions`)
- Retry policy (no `withRetry`)
- Audit logging (non-existent anyway — see Problem 6)
- The dispatcher's error classification

`node-executor.ts` explicitly imports from both:
```typescript
import { unifiedRegistry } from "../../tools/registry/tool-registry.ts";
import { executeTool }     from "../../tools/core/execute-tool.ts";
```

This is not a migration artifact. It is a live, production execution path used by the engine.

---

### PROBLEM 2 — THREE CONTEXT TYPES IN PRODUCTION

There are three different context objects across the tools layer:

| Type | Location | Interface |
|------|----------|-----------|
| `ToolContext` | `core/tool-context.ts` | `{ projectId, runId, sandboxRoot, signal, meta }` |
| `ToolExecutionContext` | `registry/tool-types.ts` | `{ runId, projectId, sandboxRoot, signal, meta }` |
| `FsBaseOpts` | `filesystem/shared/filesystem-context.ts` | `{ sandboxRoot }` |

`ToolContext` and `ToolExecutionContext` are structurally identical but nominally different types. They are created by different factories (`createContext()` vs `buildContext()`), which both read `AGENT_PROJECT_ROOT` independently. Any type mismatch is silently bridged by the `unifiedRegistry` shim which casts between them. This is a maintenance bomb — a future field added to one type does not propagate to the other.

---

### PROBLEM 3 — THE `unifiedRegistry` COMPATIBILITY SHIM LIVES IN THE WRONG FILE

`tool-registry.ts` has three distinct responsibilities:
1. Singleton tool store (`registry` Map + `registerTool`/`getTool`/etc.)
2. Metrics recording (`metricsStore` + `recordMetric`)
3. `unifiedRegistry` compatibility shim (adapter that converts `ToolDefinition` to `UnifiedRegistryEntry`)

The shim exists to serve `server/api/tools.routes.ts` and `server/engine/execution/node-executor.ts`. It is not a registry concern. It belongs in its own adapter file or inside the consumers. As-is, it forces the core registry to know about the `UnifiedRegistryEntry` shape, creating unnecessary coupling.

---

### PROBLEM 4 — TOOLS IMPORT UPWARD INTO AGENTS (INVERTED DEPENDENCY)

**The tools layer directly imports from `server/agents/`** across all five categories. This is a hard architectural inversion. Tools should be the lowest layer — agents depend on tools, not the other way around.

Confirmed upward dependencies (sample, not exhaustive):

| Tool File | Imports From |
|-----------|-------------|
| `filesystem/validation/sandbox-validator.ts` | `server/agents/filesystem/validation/sandbox-validator.ts` |
| `filesystem/validation/path-validator.ts` | `server/agents/filesystem/...` |
| `filesystem/read/read-file.ts` | `server/agents/filesystem/files/file-reader.ts` |
| `filesystem/write/write-file.ts` | `server/agents/filesystem/files/file-writer.ts` |
| `browser/session/browser-context.ts` | `server/agents/browser/core/browser-session.ts` |
| `browser/navigation/navigate-to-url.ts` | `server/agents/browser/navigation/page-navigator.ts` |
| `verifier/runtime/check-server-health.ts` | `server/agents/verifier/runtime/server-healthcheck.ts` |
| `coding/frontend/generate-react-page.ts` | `server/agents/coderx/utils/code-utils.ts` |
| `coding/templates/react-template.ts` | `server/agents/coderx/...` |

This is not a wrapper pattern. These are direct functional imports where the actual implementation lives in `server/agents/` and the tool layer merely re-exports or thinly wraps it. The dependency arrow is:

```
ACTUAL:    Tool ──imports──▶ Agent implementation
CORRECT:   Agent ──imports──▶ Tool implementation
```

The consequence: deleting or refactoring an agent module breaks the entire tool category.

---

### PROBLEM 5 — `sealRegistry()` IS NEVER CALLED

The registry was designed with a sealing mechanism to prevent post-boot registrations:

```typescript
export function sealRegistry(): void {
  _sealed = true;
}
```

Comments across the codebase instruct: *"Call once at application boot, before sealRegistry()"*. Searching the entire codebase reveals `sealRegistry` is:
- Defined in `tool-registry.ts`
- Exported from `registry/index.ts`
- **Never called anywhere**

The registry is permanently open. Any code loaded at runtime can inject arbitrary tools after boot. This undermines the entire guarantee of a sealed, auditable tool surface.

---

### PROBLEM 6 — `recordAudit()` AND `recordMetric()` ARE DEAD CODE

`tool-security.ts` exports `recordAudit()`. It is **never called** by the dispatcher or by any tool handler. The audit log is always empty. No tool execution is ever recorded.

`tool-registry.ts` exports `recordMetric()`. The dispatcher (`tool-dispatcher.ts`) does not call it. No metrics are ever written to `metricsStore`. `unifiedRegistry.getMetrics()` always returns `{ invocations: 0, failures: 0, avgDurationMs: 0 }`.

Both the audit system and the metrics system are infrastructure that was built but never wired. They are exposed on public APIs (`/api/tools/:name` returns metrics) but the data is permanently zeroed.

---

### PROBLEM 7 — TERMINAL TOOLS BYPASS `ctx.sandboxRoot`

The `terminal/npm/npm-install.ts` handler does **not use the execution context**:

```typescript
handler: async (input: Record<string, unknown>) => {  // ctx is absent
  return npmInstall(
    input.projectId as string,   // derives sandbox path from raw input
    ...
  );
}
```

`npmInstall()` then calls `getSandboxRoot(projectId)` internally, re-deriving the sandbox root from raw user input rather than using the validated, immutable `ctx.sandboxRoot` that the dispatcher already resolved. This creates a second, unvalidated code path for sandbox root resolution in the terminal category. If `input.projectId` is manipulated, the sandbox enforcement from the context is bypassed entirely.

---

### PROBLEM 8 — NAIVE COMMAND PARSING IN `shell-execute.ts`

```typescript
const parts = command.split(/\s+/);
const exe   = parts[0];
const args  = parts.slice(1);
```

This splits commands on whitespace only. It does not handle:
- Quoted arguments (`npm install "my package"`)
- Paths with spaces
- Arguments with embedded spaces (`--flag="value with space"`)

Shell-constructed commands from agents that include quoted tokens will be silently broken — the quotes become part of the argument string rather than being parsed as delimiters.

---

### PROBLEM 9 — `coding` IS THE WRONG ABSTRACTION LEVEL FOR A TOOL

The `coding` category (46 tools) does not execute operations in a sandbox. It generates code strings in memory and returns file maps. It does **not write to disk**. The description of `coding_generate_react_page` explicitly states: *"Returns file map — does not write to disk."*

A "tool" in this architecture is an operation that produces side effects (reads a file, runs a command, takes a screenshot). A code generator produces a value. These are different primitives. Placing code generators in the same registry alongside filesystem and terminal tools creates a false equivalence and allows the AI to "call a tool" that has zero sandboxed effect — the output is silently discarded unless something downstream writes the returned file map.

Furthermore, the `coding` tools have `permissions: []` — no permissions required — because they do nothing to the actual system. This is a correct but revealing sign that they don't belong at this layer.

---

### PROBLEM 10 — `defineCodingTool()` IS A TYPE ESCAPE HATCH

```typescript
export function defineCodingTool<TInput>(def: TypedCodingTool<TInput>): ToolDefinition {
  return def as unknown as ToolDefinition;  ← double cast
}
```

The `as unknown as ToolDefinition` double cast erases the typed input parameter to satisfy the registry's `ToolHandler<Record<string, unknown>>` signature. TypeScript's contravariance rules are being worked around rather than solved architecturally. The handler inside these tools receives a strongly typed `TInput` but the dispatcher will pass `Record<string, unknown>` — the type safety inside the handler is false confidence.

The same pattern appears in `generate-react-page.ts`:
```typescript
} as unknown as ToolDefinition;
```

This is a symptom of the input schema system being homegrown (not Zod) and lacking the type-level machinery to infer handler input types from schemas.

---

### PROBLEM 11 — `browser` HAS A NAMING COLLISION: `validation/` vs `validation-core/`

The browser category has two validation directories with inverted naming logic:

| Directory | Contents | Should Be Named |
|-----------|----------|-----------------|
| `validation-core/` | Input validators (url-validator, selector-validator) | `validation/` (these are core validators) |
| `validation/` | Detection tools (blank-screen-detector, crash-detector, hydration-error-detector) | `detection/` or `analysis/` |

The naming communicates the opposite of the actual content. A developer looking for "core" validation logic finds detector tools, and looking in `validation/` finds detector implementations. This was likely a naming accident during migration that was never corrected.

---

### PROBLEM 12 — `agents/coderx/` HAS ITS OWN `tool-dispatcher.ts`

`server/agents/coderx/llm-loop/tool-dispatcher.ts` defines a completely separate `dispatch()` function for the coderX LLM tool loop. This is a **third dispatcher**, independent of the canonical `registry/tool-dispatcher.ts`. It calls tools by different mechanics and is wired only within the coderX agent. Tool calls made through this path have no registry awareness, no permission checking, and no metric recording. The coderX tool-loop is an island.

---

### PROBLEM 13 — IDEMPOTENCY GUARD IS BROKEN IN TERMINAL AND VERIFIER

`register-terminal-tools.ts`:
```typescript
export function registerTerminalTools(opts: { force?: boolean } = {}): void {
  if (_registered && !opts.force) return;
  _registered = true;      // ← set BEFORE the registration loop
  for (const tool of tools) {
    try { registerTool(tool, opts); }
    catch (err) { console.warn(...) }  // silently swallows
  }
}
```

If any tool in the loop throws (e.g., a duplicate name), `_registered` is already `true`. The next call returns immediately even though some tools were never registered. The error is swallowed with a `console.warn`. The category ends up in a permanently partial-registration state with no way to detect it.

`register-verifier-tools.ts` has the identical pattern. `register-filesystem-tools.ts` and `register-coding-tools.ts` set `_registered` after the loop (correct). `register-browser-tools.ts` has no `try/catch` and lets errors propagate (also correct, but inconsistent).

---

### PROBLEM 14 — PER-CATEGORY MONITORING SILOS

Each category independently maintains its own metrics module:
- `browser/monitoring/browser-metrics.ts`
- `terminal/monitoring/execution-metrics.ts`
- `verifier/monitoring/verification-metrics.ts`

None of these are wired to the central `recordMetric()` in the registry. The metrics are category-local in-memory stores, not cross-category observability. A cross-cutting query like "how many tools failed in this run across all categories?" is impossible from any single query point.

---

### PROBLEM 15 — `verifier-result.ts` USES `phase: phase as any`

```typescript
export function phasePass(phase: string, ...): PhaseResult {
  return {
    phase: phase as any,   ← type cast to suppress literal union mismatch
    ...
  };
}
```

The `PhaseResult.phase` field expects a literal union (e.g., `'build' | 'typecheck' | 'tests'`), but `phasePass` accepts `string`. Rather than accepting the union type or making the function generic, `as any` is used to silence the compiler. This erases type safety on the most critical output type in the verifier category.

---

## SECTION 3 — RISK ANALYSIS

### R1 — Security Risk: Sandbox Bypass via Terminal Tools (HIGH)
Terminal tool handlers receive `input.projectId` from raw LLM-provided tool call arguments and use it to derive sandbox roots, bypassing the context-level sandbox root. A maliciously crafted `projectId` value (path traversal, absolute path) could break sandbox containment. The filesystem category correctly uses `ctx.sandboxRoot`; the terminal category does not.

### R2 — Security Risk: Unsealed Registry (HIGH)
The registry never seals. Post-boot code can inject arbitrary tool handlers. In an autonomous multi-agent system where agents can install packages and trigger code loads, a compromised or malicious package could register a tool that masquerades as a legitimate one. There is no detection mechanism because `recordAudit()` is never called.

### R3 — Reliability Risk: Dual Executor Produces Different Behavior (HIGH)
Tool calls routed through `node-executor.ts` (Path B) do not retry on failure. Tool calls routed through `dispatch()` (Path A) retry up to 3 times with exponential backoff. The same tool invoked in different agent contexts gets fundamentally different reliability guarantees. This is invisible — there is no logging that indicates which path was taken.

### R4 — Observability Risk: Dead Metrics and Audit (HIGH)
The metrics API (`GET /api/tools/:name`) always returns zeros. Operators looking at the dashboard see phantom data. Any monitoring, alerting, or capacity planning built on these metrics is based on lies. The audit log is permanently empty, providing zero forensic capability after an agent incident.

### R5 — Scalability Risk: Agent Layer Coupling (MEDIUM)
The tools layer cannot be extracted, tested, or deployed independently. It has hard imports into `server/agents/`, which in turn has its own dependencies. The circular pressure grows as more tools are added. Any attempt to test a single tool requires instantiating the full agent module graph.

### R6 — Maintainability Risk: CoderX Isolation (MEDIUM)
The coderX agent's private dispatcher creates a behavioral island. If a bug is fixed in the canonical dispatcher (retry logic, timeout handling, error classification), the coderX agent does not benefit. If a new tool category is added to the registry, coderX cannot call it. The agent is permanently forked from the tool ecosystem.

### R7 — Correctness Risk: Naive Command Splitting (MEDIUM)
`shell-execute.ts` splits commands on whitespace. LLM-generated commands with quoted arguments or paths containing spaces will be misexecuted. The failure is silent — the command runs but with wrong arguments. This is particularly dangerous for npm scripts or build commands generated by the coding agents.

### R8 — Correctness Risk: Partial Idempotency Failure (MEDIUM)
If registration fails mid-loop in terminal or verifier categories (which silently swallow errors), the system continues with a subset of tools registered. Agent tool calls to unregistered tools return `NOT_FOUND` errors at runtime with no startup-time indication that registration was incomplete.

---

## SECTION 4 — TOOL MATURITY ANALYSIS

### Production-Ready
- `registry/tool-types.ts` — clean, pure type contracts
- `registry/tool-metadata.ts` — well-structured, good constants
- `registry/tool-resolver.ts` — correct resolution + permission model
- `registry/tool-dispatcher.ts` — solid execution engine (wiring defect aside)
- `filesystem/` category (all tools) — correct sandbox enforcement via `ctx.sandboxRoot`, clean delegation
- `shared/result-helpers.ts` — clean, correct, well-typed
- `shared/logger.ts` — minimal and correct
- `browser/validation-core/` — clean input validators

### Partially Migrated
- `terminal/` category — correct structure, broken sandbox path in handlers
- `browser/` category — correct structure, hard agent dependency
- `verifier/` category — correct structure, hard agent dependency, broken idempotency guard
- `coding/` category — correct structure, wrong abstraction level, type escape hatches

### Tightly Coupled
- All `filesystem/` tools (to `server/agents/filesystem/`)
- All `browser/` tools (to `server/agents/browser/`)
- All `verifier/` tools (to `server/agents/verifier/`)
- Most `coding/` tools (to `server/agents/coderx/`)

### Unsafe
- `terminal/npm/npm-install.ts` — bypasses `ctx.sandboxRoot`
- `terminal/process/process-start.ts` — process management without context sandbox enforcement (pending verification)
- `terminal/execution/shell-execute.ts` — naive command splitting

### Legacy / Compatibility Debt
- `core/execute-tool.ts` — shadow executor for `node-executor.ts`
- `core/tool-context.ts` — duplicate context type
- `registry/tool-registry.ts` → `unifiedRegistry` shim — adapter for unconverted consumers

### Dead Code
- `registry/tool-security.ts` → `recordAudit()` — never called
- `registry/tool-registry.ts` → `recordMetric()` — never called
- `registry/tool-registry.ts` → `sealRegistry()` — exported, never invoked

### Duplicated
- `core/tool-context.ts` duplicates `shared/context-builder.ts`
- `terminal/validation/sandbox-validator.ts` duplicates logic from `filesystem/validation/sandbox-validator.ts`
- `core/execute-tool.ts` duplicates `registry/tool-dispatcher.ts`
- `agents/coderx/llm-loop/tool-dispatcher.ts` duplicates `registry/tool-dispatcher.ts`

---

## SECTION 5 — IDEAL TARGET STRUCTURE

The canonical production-grade structure for `server/tools/` follows these principles:
1. **Tools layer owns all implementations** — no upward imports into agents
2. **Single execution path** — one dispatcher, one context type
3. **Sealed registry at boot** — no post-boot mutations
4. **Cross-category telemetry** — one metrics + audit system wired into the dispatcher
5. **Categories reflect actual capability classes** — not agent team boundaries

```
server/tools/
│
├── index.ts                           ← single public surface
│
├── registry/                          ← unchanged structure, wiring fixed
│   ├── tool-types.ts
│   ├── tool-registry.ts               ← remove unifiedRegistry shim
│   ├── tool-dispatcher.ts             ← ADD: recordAudit() + recordMetric() calls
│   ├── tool-resolver.ts
│   ├── tool-metadata.ts
│   ├── tool-security.ts               ← rename to tool-audit.ts
│   └── tool-metrics.ts                ← extract from tool-registry.ts
│
├── shared/                            ← unchanged, remove core/ duplication
│   ├── context-builder.ts             ← single context factory (delete core/)
│   ├── input-validator.ts
│   ├── result-helpers.ts
│   └── logger.ts
│
├── filesystem/                        ← move agent implementations HERE
│   ├── core/                          ← file-reader.ts, file-writer.ts moved from agents/
│   ├── registry/
│   ├── read/ write/ edit/ delete/
│   ├── move/ clone/ search/ structure/ folders/
│   ├── validation/                    ← own sandbox-validator (not re-export)
│   └── shared/
│
├── terminal/                          ← fix: all handlers must use ctx.sandboxRoot
│   ├── core/                          ← shell-execute, spawn-process (own them)
│   ├── registry/
│   ├── execution/                     ← fix command parser (shell-quote library)
│   ├── npm/ ports/ process/
│   ├── security/                      ← fix: apply policy inside dispatcher, not just per-handler
│   ├── validation/
│   └── shared/
│
├── browser/                           ← move agent browser core HERE
│   ├── core/                          ← browser-session, page-navigator moved from agents/
│   ├── registry/
│   ├── navigation/ interaction/ capture/
│   ├── detection/                     ← rename from validation/ (detectors)
│   ├── validation/                    ← rename from validation-core/ (input validators)
│   ├── session/
│   ├── monitoring/
│   └── shared/
│
├── verifier/                          ← move agent verifier core HERE
│   ├── core/                          ← server-healthcheck, run-build, etc. from agents/
│   ├── registry/
│   ├── build/ tests/ typecheck/ runtime/ recovery/ diagnostics/
│   ├── validation/
│   ├── monitoring/
│   └── shared/
│
├── codegen/                           ← RENAME from coding/ — different semantic
│   ├── registry/
│   ├── frontend/ backend/ api/ auth/ database/ components/ crud/
│   ├── llm/                           ← own LLM client (not agent-dependent)
│   ├── templates/
│   ├── validation/
│   └── shared/
│
└── [MISSING CATEGORIES — see Section 6]
    ├── git/                           ← git operations (status, diff, commit, push)
    ├── network/                       ← HTTP probing, endpoint validation
    └── telemetry/                     ← cross-category metrics aggregation
```

### Correct Execution Flow (target)

```
Agent
  ↓
dispatch(toolName, input, ctx)         ← single entry point, always
  ↓
resolveToolWithPermissions()           ← existence + permission check
  ↓
recordAudit(pre-execution)             ← WIRED (currently dead)
  ↓
withRetry() → withTimeout()            ← reliability envelope
  ↓
handler(input, ctx)                    ← implementation
  ↓
recordAudit(post-execution)            ← WIRED (currently dead)
recordMetric(name, ok, durationMs)     ← WIRED (currently dead)
  ↓
ToolExecutionResult<T>
```

---

## SECTION 6 — MIGRATION GAPS

### What Is Still Embedded in Agents (not in tools layer)

| Capability | Lives In | Should Live In |
|------------|----------|----------------|
| File reading core | `server/agents/filesystem/files/file-reader.ts` | `server/tools/filesystem/core/` |
| File writing core | `server/agents/filesystem/files/file-writer.ts` | `server/tools/filesystem/core/` |
| Sandbox path validation | `server/agents/filesystem/validation/sandbox-validator.ts` | `server/tools/filesystem/validation/` |
| Browser session management | `server/agents/browser/core/browser-session.ts` | `server/tools/browser/core/` |
| Browser page navigation | `server/agents/browser/navigation/page-navigator.ts` | `server/tools/browser/core/` |
| Server health check | `server/agents/verifier/runtime/server-healthcheck.ts` | `server/tools/verifier/core/` |
| CoderX utilities | `server/agents/coderx/utils/code-utils.ts` | `server/tools/codegen/shared/` |
| CoderX LLM loop | `server/agents/coderx/llm-loop/` | Consolidated or eliminated |

### What Is Not in Any Category (Missing Entirely)

| Capability | Evidence of Need |
|------------|-----------------|
| **Git operations** | Git tools are referenced in `terminal/security/execution-policy.ts` whitelist but have no dedicated category — scattered |
| **AI/LLM invocation** | Coding tools have an `llm/` subdirectory but LLM calls are also embedded in agents directly, with no unified LLM tool |
| **HTTP/Network probing** | Verifier tools probe endpoints directly; no shared network tool |
| **Artifact storage** | No tool for persisting build artifacts, screenshots, or deployment outputs |

### Compat Shims That Block Full Migration

| Shim | Blocks |
|------|--------|
| `core/execute-tool.ts` | `server/engine/execution/node-executor.ts` |
| `core/tool-context.ts` | `node-executor.ts` + `unifiedRegistry` consumers |
| `registry/tool-registry.ts` → `unifiedRegistry` | `server/api/tools.routes.ts`, `node-executor.ts` |
| `agents/coderx/llm-loop/tool-dispatcher.ts` | coderX agent tool execution |

---

## SECTION 7 — PRIORITY FIXES

### HIGH PRIORITY — Correctness and Security

**H1. Wire `recordAudit()` into `tool-dispatcher.ts`**  
The audit system exists. The dispatcher does not call it. Two lines of code fix this. Until wired, zero forensic visibility exists on any tool execution.

**H2. Wire `recordMetric()` into `tool-dispatcher.ts`**  
The metrics API returns zeroes. The fix is two lines. Until wired, the `/api/tools/:name` endpoint is misleading.

**H3. Fix terminal handler sandbox bypass**  
All `terminal/` tool handlers that derive sandbox root from `input.projectId` must be changed to use `ctx.sandboxRoot` exclusively. The handler signature must accept `ctx: ToolExecutionContext` and use it.

**H4. Call `sealRegistry()` at the end of the boot sequence in `main.ts`**  
After all `registerXxxTools()` calls in `main.ts`, call `sealRegistry()`. One line. Until done, the registry is a permanently open mutation surface.

**H5. Fix the idempotency guard in `register-terminal-tools.ts` and `register-verifier-tools.ts`**  
Move `_registered = true` to after the registration loop. If any registration fails, the flag should not be set.

---

### MEDIUM PRIORITY — Architecture Debt

**M1. Eliminate `core/` directory entirely**  
`core/execute-tool.ts` and `core/tool-context.ts` exist to support `node-executor.ts`. The correct fix is to migrate `node-executor.ts` to use `dispatch()` from `registry/tool-dispatcher.ts` and `buildContext()` from `shared/context-builder.ts`. After migration, delete `core/`.

**M2. Extract `unifiedRegistry` shim from `tool-registry.ts`**  
Move the shim to `registry/tool-registry-adapter.ts`. The core registry file should not contain adapter logic.

**M3. Fix command parsing in `shell-execute.ts`**  
Replace `command.split(/\s+/)` with proper shell argument parsing. Use `shell-quote` or equivalent. The current implementation silently corrupts quoted arguments.

**M4. Rename `browser/validation-core/` → `browser/validation/` and `browser/validation/` → `browser/detection/`**  
The current naming is inverted from the actual content. This causes navigation errors for every developer who opens the browser category.

**M5. Move implementation ownership from `agents/` to `tools/`**  
The tools layer should own the implementations it exposes. File reader, file writer, sandbox validator, browser session, and server health check all live in `agents/` and are imported upward. Invert this: move the implementations to `tools/`, have `agents/` import from `tools/`.

---

### LOW PRIORITY — Polish and Completeness

**L1. Replace `as unknown as ToolDefinition` in `defineCodingTool()` and `generate-*.ts` files**  
Solve architecturally by making `ToolDefinition` accept a generic input parameter, or by using Zod for input schema definition with automatic type inference.

**L2. Replace `phase as any` in `verifier-result.ts`**  
Make `phasePass()` and `phaseFail()` generic on phase literal or accept the union type.

**L3. Add a `git/` tool category**  
Git operations (currently whitelisted in `execution-policy.ts`) should have a dedicated category with sandboxed, registered tools.

**L4. Rename `coding/` to `codegen/`**  
The category generates code strings, not executes tools. The name should reflect this distinction.

**L5. Implement cross-category telemetry**  
Create `tools/telemetry/` that aggregates metrics from all categories into a unified store. Currently each category's monitoring is siloed.

---

## SECTION 8 — FINAL VERDICT

### 1. Is the current architecture scalable?

**Partially.** The registry design (types, dispatcher, resolver) scales well. The category structure scales well on the surface. But the upward tool→agent coupling means adding new tools requires importing more agent modules, increasing the dependency graph depth with each addition. The dual executor creates two scaling paths that diverge over time. **Verdict: Not scalable as-is.**

### 2. Is it Replit-level?

**Not yet.** The intentions are correct — the type system, the registry pattern, the idempotency guards, the sandbox validator, the permission model — these are production-grade designs. But production-grade designs that are not wired (dead metrics, dead audit, unsealed registry, shadow executor) are not production-grade systems. They are production-grade drawings. **Verdict: Well-designed but incompletely executed.**

### 3. Is it production-safe?

**No.** Three specific issues block this verdict:
- The sandbox bypass in terminal tool handlers is a real security gap.
- The registry is never sealed — arbitrary post-boot tool injection is possible.
- The dual executor means tool calls in the engine do not retry, permanently reducing reliability for that execution path.

### 4. Is tool separation correct?

**Mostly.** The five categories (filesystem, terminal, browser, verifier, coding) are logical and correctly bounded. The subcategory organization within each is excellent. The `coding` category has an identity problem (generators vs tools) but its internal structure is clean. The largest separation violation is the tool→agent coupling: the tools layer is not a separate layer, it is a thin wrapper over the agents layer.

### 5. What is the biggest architecture weakness?

**The dual executor with dead observability.**

`node-executor.ts` calls `executeTool()` from `core/`, not `dispatch()` from `registry/`. This means the primary engine execution path bypasses retry, bypasses audit, bypasses metrics, and uses a shadow context type. The audit log is always empty. The metrics are always zero. The registry is never sealed.

The system appears to have a robust, well-instrumented tool infrastructure. In reality, the instrumentation was built but never connected. The execution path that matters — the engine running agent tool calls — goes around all of it. This is the single most important defect in the entire architecture, and it is invisible without tracing the import graph by hand.

---

*End of architecture audit. 185 files analyzed. 15 structural defects identified. 0 lines of code modified.*
