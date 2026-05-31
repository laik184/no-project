# TOOLS_INDEX_DISCOVERY_REPORT.md

## File
`server/tools/index.ts`

---

## Purpose (as documented)
Top-level public entry point for the centralized tool system.
Intended import pattern for consumers:
```
import { dispatch, registerTool, buildContext } from '../../tools/index.ts';
```

---

## Export Blocks (6 total)

### Block 1 — Registry layer (wildcard)
```typescript
export * from './registry/index.ts';
```
Re-exports everything from `registry/index.ts` barrel. Includes:
- Types: `ToolCategory`, `ToolPermission`, `ToolDefinition`, `ToolExecutionContext`,
  `ToolExecutionResult`, `ToolErrorCode`, `ToolHandler`, `ToolRegistrationEntry`,
  `RetryPolicy`, `ToolInputSchema`, `ToolOutputSchema`, `FieldSchema`
- Registry ops: `registerTool`, `unregisterTool`, `getTool`, `listTools`,
  `listToolsByCategory`, `hasTool`, `toolCount`, `sealRegistry`, `isSealed`,
  `_resetRegistryForTests`, `ToolRegistryError`
- Metadata: `registerMetadata`, `getMetadata`, `getAllMetadata`, `getMetadataByCategory`,
  `hasMetadata`, `metadataCatalogueSize`, `RETRY_NONE`, `RETRY_ONCE`, `RETRY_AGGRESSIVE`, `TIMEOUT`
- Resolver: `resolveTool`, `resolveToolWithPermissions`, `toolExists`, `validateToolName`,
  `ToolNotFoundError`, `ToolPermissionError`, `ResolvedTool`
- Dispatcher: `dispatch`, `dispatchAll`, `dispatchSequential`, `DispatchOptions`
- Security: `recordAudit`, `getAuditLog`, `clearAuditLog`, `auditStats`, `AuditLogEntry`
- Metrics: `recordMetric`, `getMetrics`, `getAllMetricsSnapshot`, `resetMetrics`, `ToolMetrics`
- **`defineTool`, `defineCodingTool`** ← included here via registry/index.ts line 92
- Compat: `unifiedRegistry`, `UnifiedRegistryEntry`

### Block 2 — Shared utilities (named)
```typescript
export { buildContext, buildSystemContext }     from './shared/context-builder.ts';
export { validateInput, applyDefaults }         from './shared/input-validator.ts';
export { ok, fail, isOk, isFail, unwrapOrThrow, unwrapOrDefault } from './shared/result-helpers.ts';
export { toolsLogger }                          from './shared/logger.ts';
```
8 named exports.

### Block 3 — Filesystem domain (named)
```typescript
export { registerFilesystemTools, FILESYSTEM_TOOL_COUNT, FILESYSTEM_TOOL_NAMES }
  from './filesystem/index.ts';
```
3 named exports.

### Block 4 — Domain registrations (named)
```typescript
export { registerTerminalTools }   from './terminal/index.ts';
export { registerVerifierTools }   from './verifier/index.ts';
export { registerBrowserTools, BROWSER_TOOL_COUNT, BROWSER_TOOL_NAMES } from './browser/index.ts';
export { registerCodingTools, CODING_TOOL_COUNT, CODING_TOOL_NAMES }    from './coding/index.ts';
```
8 named exports.

### Block 5 — Codegen alias (named) — ⚠ PARTIALLY REDUNDANT
```typescript
export type { GenerationResult, GenerationStrategy } from './codegen/index.ts';
export { CodingToolError }         from './codegen/index.ts';
export { validateGeneratedCode }   from './codegen/index.ts';
export { validateAllSyntax }       from './codegen/index.ts';
export { validateAllImports }      from './codegen/index.ts';
export { validateAllSchemas }      from './codegen/index.ts';
```
6 exports (2 types, 4 values).
These are aliases for `coding/index.ts` symbols — backward-compat intentional per comment.

### Block 6 — Telemetry hub (named)
```typescript
export { getGlobalStats, getToolMetrics, getRecentAudit, getTopTools }
  from './telemetry/index.ts';
```
4 named exports.

### Block 7 — define-tool helper (named) — ⚠ DUPLICATE
```typescript
export { defineTool, defineCodingTool } from './registry/define-tool.ts';
```
2 named exports — **already exported via Block 1 wildcard**. DEFECT.

---

## Export Count Summary

| Block | Source | Exports | Issue |
|-------|--------|---------|-------|
| 1 — Registry wildcard | `./registry/index.ts` | ~37 | Includes `defineTool`/`defineCodingTool` |
| 2 — Shared utils | 4 shared files | 8 | None |
| 3 — Filesystem | `./filesystem/index.ts` | 3 | None |
| 4 — Domain registrations | 4 domain indexes | 8 | None |
| 5 — Codegen alias | `./codegen/index.ts` | 6 | Backward-compat alias (intentional) |
| 6 — Telemetry | `./telemetry/index.ts` | 4 | None |
| 7 — define-tool | `./registry/define-tool.ts` | 2 | **DUPLICATE** — already in Block 1 |

---

## Module Tree (target files)

```
server/tools/
├── index.ts                  ← barrel (this file)
├── registry/
│   ├── index.ts              ← registry barrel (Block 1 wildcard target)
│   ├── define-tool.ts        ← also target of Block 7 (redundant)
│   ├── tool-dispatcher.ts    ← exported via registry/index.ts
│   ├── tool-types.ts         ← exported via registry/index.ts
│   ├── tool-registry.ts      ← exported via registry/index.ts
│   ├── tool-resolver.ts      ← exported via registry/index.ts
│   ├── tool-metadata.ts      ← exported via registry/index.ts
│   ├── tool-metrics.ts       ← exported via registry/index.ts
│   ├── tool-security.ts      ← exported via registry/index.ts
│   └── tool-loader.ts        ← INTERNAL (not in any export)
├── shared/
│   ├── context-builder.ts    ← exported (Block 2)
│   ├── input-validator.ts    ← exported (Block 2)
│   ├── result-helpers.ts     ← exported (Block 2)
│   ├── logger.ts             ← exported (Block 2)
│   └── string-utils.ts       ← ⚠ NOT EXPORTED — external consumer exists
├── filesystem/
│   └── index.ts              ← exported (Block 3)
├── terminal/
│   └── index.ts              ← exported (Block 4)
├── verifier/
│   └── index.ts              ← exported (Block 4)
├── browser/
│   └── index.ts              ← exported (Block 4)
├── coding/
│   └── index.ts              ← exported (Block 4)
├── codegen/
│   └── index.ts              ← exported (Block 5)
└── telemetry/
    └── index.ts              ← exported (Block 6)
```
