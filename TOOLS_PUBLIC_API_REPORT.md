# TOOLS_PUBLIC_API_REPORT.md

## Classification Key

| Class | Meaning |
|-------|---------|
| PUBLIC | Correctly exported — intended for external consumers |
| INTERNAL | Should stay private — not in the barrel |
| SHOULD_NOT_EXPORT | Currently exported but should be hidden |

---

## Registry Layer (via `export * from './registry/index.ts'`)

| Symbol | Class | Rationale |
|--------|-------|-----------|
| `ToolCategory` (type) | PUBLIC | Used in tool definitions everywhere |
| `ToolPermission` (type) | PUBLIC | Part of tool contract |
| `ToolDefinition` (type) | PUBLIC | Core type for registering tools |
| `ToolExecutionContext` (type) | PUBLIC | Required to write tool handlers |
| `ToolExecutionResult` (type) | PUBLIC | Required to type tool returns |
| `ToolErrorCode` (type) | PUBLIC | Error handling |
| `ToolHandler` (type) | PUBLIC | Required for tool implementation |
| `ToolRegistrationEntry` (type) | PUBLIC | Registry admin |
| `RetryPolicy` (type) | PUBLIC | Tool configuration |
| `ToolInputSchema` / `ToolOutputSchema` / `FieldSchema` (types) | PUBLIC | Schema validation |
| `registerTool` | PUBLIC | Primary registration API |
| `unregisterTool` | PUBLIC | Registry management |
| `getTool` / `listTools` / `listToolsByCategory` / `hasTool` / `toolCount` | PUBLIC | Registry queries |
| `sealRegistry` / `isSealed` | PUBLIC | Lifecycle management |
| `_resetRegistryForTests` | ⚠ SHOULD_NOT_EXPORT | Test-only function leaks to public API; name signals internal use |
| `ToolRegistryError` | PUBLIC | Error class for consumers |
| `resolveTool` / `resolveToolWithPermissions` / `toolExists` / `validateToolName` | PUBLIC | Resolver API |
| `ToolNotFoundError` / `ToolPermissionError` | PUBLIC | Error classes |
| `ResolvedTool` (type) | PUBLIC | Resolver return type |
| `dispatch` / `dispatchAll` / `dispatchSequential` | PUBLIC | Core dispatch API |
| `DispatchOptions` (type) | PUBLIC | Dispatch configuration |
| `recordAudit` / `getAuditLog` / `clearAuditLog` / `auditStats` | PUBLIC | Security audit trail |
| `AuditLogEntry` (type) | PUBLIC | Audit type |
| `recordMetric` / `getMetrics` / `getAllMetricsSnapshot` / `resetMetrics` | PUBLIC | Metrics API |
| `ToolMetrics` (type) | PUBLIC | Metrics type |
| `defineTool` / `defineCodingTool` | PUBLIC | Tool definition helper (via wildcard) |
| `unifiedRegistry` | PUBLIC | Backward-compat shim |
| `UnifiedRegistryEntry` (type) | PUBLIC | Backward-compat type |
| `registerMetadata` / `getMetadata` / `getAllMetadata` / etc. | PUBLIC | Metadata API |
| `ToolMetadata` (type) | PUBLIC | Metadata type |
| `RETRY_NONE` / `RETRY_ONCE` / `RETRY_AGGRESSIVE` / `TIMEOUT` | PUBLIC | Config constants |

### Concern

**`_resetRegistryForTests`** — the underscore prefix and `ForTests` suffix signal this is a test
utility. It should not be part of the public API surface. However, removing it from `registry/index.ts`
is a registry-level concern, not a `tools/index.ts` fix. Documented here as a finding for a
follow-up registry audit.

---

## Shared Utilities

| Symbol | Class | Rationale |
|--------|-------|-----------|
| `buildContext` | PUBLIC | Required to write tool handlers |
| `buildSystemContext` | PUBLIC | System-level context builder |
| `validateInput` | PUBLIC | Input validation helper |
| `applyDefaults` | PUBLIC | Input normalization |
| `ok` / `fail` / `isOk` / `isFail` / `unwrapOrThrow` / `unwrapOrDefault` | PUBLIC | Result combinators |
| `toolsLogger` | ⚠ BORDERLINE | Logger singleton — useful to consumers who want consistent logging; acceptable to export |
| `string-utils.ts` (all) | PUBLIC | General string utilities — used across agent boundary |

---

## Domain Registrations

| Symbol | Class | Rationale |
|--------|-------|-----------|
| `registerFilesystemTools` / `FILESYSTEM_TOOL_COUNT` / `FILESYSTEM_TOOL_NAMES` | PUBLIC | Bootstrap API |
| `registerTerminalTools` | PUBLIC | Bootstrap API |
| `registerVerifierTools` | PUBLIC | Bootstrap API |
| `registerBrowserTools` / `BROWSER_TOOL_COUNT` / `BROWSER_TOOL_NAMES` | PUBLIC | Bootstrap API |
| `registerCodingTools` / `CODING_TOOL_COUNT` / `CODING_TOOL_NAMES` | PUBLIC | Bootstrap API |

---

## Codegen Alias (backward-compat)

| Symbol | Class | Rationale |
|--------|-------|-----------|
| `GenerationResult` / `GenerationStrategy` (types) | PUBLIC | Codegen contract |
| `CodingToolError` | PUBLIC | Error class |
| `validateGeneratedCode` / `validateAllSyntax` / `validateAllImports` / `validateAllSchemas` | PUBLIC | Validation utilities used across boundary |

---

## Telemetry Hub

| Symbol | Class | Rationale |
|--------|-------|-----------|
| `getGlobalStats` / `getToolMetrics` / `getRecentAudit` / `getTopTools` | PUBLIC | Monitoring/dashboard API |

---

## Explicit define-tool (REDUNDANT block)

| Symbol | Class | Rationale |
|--------|-------|-----------|
| `defineTool` / `defineCodingTool` | DUPLICATE | Already exported via wildcard — explicit re-export is noise |

---

## Internal symbols NOT in barrel (correct)

| Module | Why Internal |
|--------|-------------|
| `registry/tool-loader.ts` | Tool loading implementation — internal to registry |
| `shared/string-utils.ts` | Currently missing from barrel — has external consumer, SHOULD be added |
| All `*/lib/**` files | Deep implementation — correctly hidden |
| All `*/validation/**` sub-files | Domain-internal validation — correctly hidden |
| All domain sub-implementations | Implementation detail — correctly hidden |

---

## Summary

| Class | Count |
|-------|-------|
| PUBLIC | ~55 |
| SHOULD_NOT_EXPORT | 1 (`_resetRegistryForTests` — registry concern) |
| DUPLICATE | 2 (`defineTool`, `defineCodingTool` explicit) |
| MISSING from barrel | 7 (string-utils functions) |
