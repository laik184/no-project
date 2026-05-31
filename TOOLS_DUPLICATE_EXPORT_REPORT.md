# TOOLS_DUPLICATE_EXPORT_REPORT.md

## Total duplicate exports: 2

---

## Duplicate 1 — `defineTool`

| Field | Detail |
|-------|--------|
| Export name | `defineTool` |
| Source A | `tools/index.ts` line 14 → `export * from './registry/index.ts'` → `registry/index.ts` line 92 → `define-tool.ts` |
| Source B | `tools/index.ts` line 68 → `export { defineTool } from './registry/define-tool.ts'` |
| Conflict type | Named explicit export shadowing/duplicating wildcard re-export |
| Fix | Remove line 68 explicit re-export — Block 1 wildcard already covers it |

---

## Duplicate 2 — `defineCodingTool`

| Field | Detail |
|-------|--------|
| Export name | `defineCodingTool` |
| Source A | `tools/index.ts` line 14 → `export * from './registry/index.ts'` → `registry/index.ts` line 92 → `define-tool.ts` |
| Source B | `tools/index.ts` line 68 → `export { defineCodingTool } from './registry/define-tool.ts'` |
| Conflict type | Named explicit export shadowing/duplicating wildcard re-export |
| Fix | Remove line 68 explicit re-export — Block 1 wildcard already covers it |

---

## Evidence chain

```
tools/index.ts line 14:     export * from './registry/index.ts'
                                              ↓
registry/index.ts line 92:  export { defineTool, defineCodingTool } from './define-tool.ts'
                                              ↓
define-tool.ts:             export function defineTool(...)        ← source
                            export function defineCodingTool(...)  ← source

tools/index.ts line 68:     export { defineTool, defineCodingTool } from './registry/define-tool.ts'
                            ↑ REDUNDANT — same symbols, same source, different import path
```

---

## Alias/Collision Scan

| Check | Result |
|-------|--------|
| Other duplicate names | 0 |
| Alias collisions | 0 |
| Shadowed exports (other) | 0 |
| Wildcard conflicts (other) | 0 |

---

## Why This Is a Defect

TypeScript handles `export *` + named `export { X }` with the same symbol by letting the named
export win. However:
1. The redundancy creates maintainer confusion about the canonical source
2. It implies Block 7 is the "real" home of `defineTool`/`defineCodingTool` when it isn't
3. The comment "Fix #15 — Type-safe tool definition helper" on the explicit export suggests
   it was added before the registry/index.ts barrel included it

**Fix: Remove lines 67–68 from `server/tools/index.ts`.**
