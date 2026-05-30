# CODERX_DEEP_IMPORT_VIOLATIONS.md

## Scan
Full backend scan for direct imports into `server/agents/coderx/**` sub-modules,
bypassing `server/agents/coderx/index.ts`.

---

## VIOLATIONS FOUND: 1

### Violation #1

| Field                      | Detail                                                        |
|----------------------------|---------------------------------------------------------------|
| **File**                   | `server/orchestration/coordination/agent-coordinator.ts`     |
| **Line**                   | 21                                                            |
| **Current import**         | `import { runCoderXAgent } from '../../agents/coderx/coderx-agent.ts';` |
| **Symbol**                 | `runCoderXAgent`                                              |
| **In index.ts?**           | ✓ YES — line 12 of `index.ts`                                 |
| **Recommended barrel import** | `import { runCoderXAgent } from '../../agents/coderx/index.ts';` |
| **Fix complexity**         | Trivial — 1-line path change                                  |

---

## CLEAN (no violation)

`server/tools/shared/string-utils.ts` — contains only a **comment** referencing coderx/utils.ts, not an `import` statement.

---

## Summary

| Category           | Count |
|--------------------|-------|
| Fixable violations | 1     |
| False positives    | 1 (comment, not import) |
| Total files scanned | All `server/**/*.ts` |
