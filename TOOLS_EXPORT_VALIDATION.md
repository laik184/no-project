# TOOLS_EXPORT_VALIDATION.md

## Method
For every source file referenced by `server/tools/index.ts`:
1. Verify file exists
2. Verify all named symbols exist in source
3. Flag broken or missing exports

---

## Block 1 — Registry wildcard (`./registry/index.ts`)

| Check | Result |
|-------|--------|
| File exists | ✓ |
| All symbols verified in source | ✓ |
| Wildcard export of 37 symbols (types + values) | ✓ |

Includes `defineTool`, `defineCodingTool` from `./define-tool.ts` (line 92 of registry/index.ts).

---

## Block 2 — Shared utilities

| Export | Source File | File Exists | Symbol Verified | Status |
|--------|-------------|-------------|-----------------|--------|
| `buildContext` | `shared/context-builder.ts` | ✓ | ✓ line 14 | **VALID** |
| `buildSystemContext` | `shared/context-builder.ts` | ✓ | ✓ line 28 | **VALID** |
| `validateInput` | `shared/input-validator.ts` | ✓ | ✓ line 15 | **VALID** |
| `applyDefaults` | `shared/input-validator.ts` | ✓ | ✓ line 42 | **VALID** |
| `ok` | `shared/result-helpers.ts` | ✓ | ✓ line 10 | **VALID** |
| `fail` | `shared/result-helpers.ts` | ✓ | ✓ line 14 | **VALID** |
| `isOk` | `shared/result-helpers.ts` | ✓ | ✓ line 22 | **VALID** |
| `isFail` | `shared/result-helpers.ts` | ✓ | ✓ line 26 | **VALID** |
| `unwrapOrThrow` | `shared/result-helpers.ts` | ✓ | ✓ line 30 | **VALID** |
| `unwrapOrDefault` | `shared/result-helpers.ts` | ✓ | ✓ line 36 | **VALID** |
| `toolsLogger` | `shared/logger.ts` | ✓ | ✓ line 36 | **VALID** |

---

## Block 3 — Filesystem domain

| Export | Source File | File Exists | Symbol Verified | Status |
|--------|-------------|-------------|-----------------|--------|
| `registerFilesystemTools` | `filesystem/index.ts` | ✓ | ✓ line 15 | **VALID** |
| `FILESYSTEM_TOOL_COUNT` | `filesystem/index.ts` | ✓ | ✓ line 15 | **VALID** |
| `FILESYSTEM_TOOL_NAMES` | `filesystem/index.ts` | ✓ | ✓ line 15 | **VALID** |

---

## Block 4 — Domain registrations

| Export | Source File | File Exists | Symbol Verified | Status |
|--------|-------------|-------------|-----------------|--------|
| `registerTerminalTools` | `terminal/index.ts` | ✓ | ✓ line 56 | **VALID** |
| `registerVerifierTools` | `verifier/index.ts` | ✓ | ✓ line 20 | **VALID** |
| `registerBrowserTools` | `browser/index.ts` | ✓ | ✓ line 16 | **VALID** |
| `BROWSER_TOOL_COUNT` | `browser/index.ts` | ✓ | ✓ line 16 | **VALID** |
| `BROWSER_TOOL_NAMES` | `browser/index.ts` | ✓ | ✓ line 16 | **VALID** |
| `registerCodingTools` | `coding/index.ts` | ✓ | ✓ line 15 | **VALID** |
| `CODING_TOOL_COUNT` | `coding/index.ts` | ✓ | ✓ line 15 | **VALID** |
| `CODING_TOOL_NAMES` | `coding/index.ts` | ✓ | ✓ line 15 | **VALID** |

---

## Block 5 — Codegen alias

| Export | Source File | File Exists | Symbol Verified | Status |
|--------|-------------|-------------|-----------------|--------|
| `GenerationResult` (type) | `codegen/index.ts` | ✓ | ✓ line 27 | **VALID** |
| `GenerationStrategy` (type) | `codegen/index.ts` | ✓ | ✓ line 27 | **VALID** |
| `CodingToolError` | `codegen/index.ts` | ✓ | ✓ line 28 | **VALID** |
| `validateGeneratedCode` | `codegen/index.ts` | ✓ | ✓ line 37 | **VALID** |
| `validateAllSyntax` | `codegen/index.ts` | ✓ | ✓ line 38 | **VALID** |
| `validateAllImports` | `codegen/index.ts` | ✓ | ✓ line 39 | **VALID** |
| `validateAllSchemas` | `codegen/index.ts` | ✓ | ✓ line 40 | **VALID** |

---

## Block 6 — Telemetry

| Export | Source File | File Exists | Symbol Verified | Status |
|--------|-------------|-------------|-----------------|--------|
| `getGlobalStats` | `telemetry/index.ts` | ✓ | ✓ line 62 | **VALID** |
| `getToolMetrics` | `telemetry/index.ts` | ✓ | ✓ line 113 | **VALID** |
| `getRecentAudit` | `telemetry/index.ts` | ✓ | ✓ line 120 | **VALID** |
| `getTopTools` | `telemetry/index.ts` | ✓ | ✓ line 127 | **VALID** |

---

## Block 7 — define-tool helper (⚠ REDUNDANT)

| Export | Source File | Also In | Status |
|--------|-------------|---------|--------|
| `defineTool` | `registry/define-tool.ts` | Block 1 wildcard via registry/index.ts:92 | **DUPLICATE** |
| `defineCodingTool` | `registry/define-tool.ts` | Block 1 wildcard via registry/index.ts:92 | **DUPLICATE** |

Evidence chain:
- `tools/index.ts` line 14: `export * from './registry/index.ts'`
- `registry/index.ts` line 92: `export { defineTool, defineCodingTool } from './define-tool.ts'`
- `tools/index.ts` line 68: `export { defineTool, defineCodingTool } from './registry/define-tool.ts'` ← REDUNDANT

---

## Missing from Barrel

| Symbol | Source | External Consumer | Status |
|--------|--------|-------------------|--------|
| `toPascalCase` | `shared/string-utils.ts` | `server/agents/coderx/utils.ts` | **MISSING** |
| `toCamelCase` | `shared/string-utils.ts` | `server/agents/coderx/utils.ts` | **MISSING** |
| `toKebabCase` | `shared/string-utils.ts` | `server/agents/coderx/utils.ts` | **MISSING** |
| `toSnakeCase` | `shared/string-utils.ts` | `server/agents/coderx/utils.ts` | **MISSING** |
| `pluralize` | `shared/string-utils.ts` | `server/agents/coderx/utils.ts` | **MISSING** |
| `capitalize` | `shared/string-utils.ts` | `server/agents/coderx/utils.ts` | **MISSING** |
| `truncate` | `shared/string-utils.ts` | `server/agents/coderx/utils.ts` | **MISSING** |

---

## Summary

| Status | Count |
|--------|-------|
| VALID | ~55 |
| DUPLICATE | 2 |
| MISSING | 7 |
| BROKEN | 0 |
