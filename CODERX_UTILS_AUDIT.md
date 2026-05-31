# CODERX UTILS AUDIT
> Phase 1 — Deep Scan
> Generated: 2026-05-31

---

## File Path
`server/agents/coderx/utils.ts`

---

## File Purpose
Backward-compatibility re-export shim. Created when string utilities were moved from `server/agents/coderx/utils.ts` to `server/tools/shared/string-utils.ts` to break a Tool → Agent import direction violation. The shim was intended to keep existing agent-layer consumers working without requiring import updates.

---

## Current Exports

### String utilities (re-exported from `../../tools/index.ts`)
| Symbol | True Owner |
|---|---|
| `toPascalCase` | `server/tools/shared/string-utils.ts` |
| `toCamelCase` | `server/tools/shared/string-utils.ts` |
| `toKebabCase` | `server/tools/shared/string-utils.ts` |
| `toSnakeCase` | `server/tools/shared/string-utils.ts` |
| `pluralize` | `server/tools/shared/string-utils.ts` |
| `capitalize` | `server/tools/shared/string-utils.ts` |
| `truncate` | `server/tools/shared/string-utils.ts` |

### CoderX utilities (re-exported via `export * from './utils/coding-utils.ts'`)
| Symbol | True Owner |
|---|---|
| `generateStepId` | `server/agents/coderx/utils/coding-utils.ts` |
| `generateSessionId` | `server/agents/coderx/utils/coding-utils.ts` |
| `generatePlanId` | `server/agents/coderx/utils/coding-utils.ts` |
| `generatePhaseId` | `server/agents/coderx/utils/coding-utils.ts` |
| `generateTaskId` | `server/agents/coderx/utils/coding-utils.ts` |
| `elapsedMs` | `server/agents/coderx/utils/coding-utils.ts` |
| `now` | `server/agents/coderx/utils/coding-utils.ts` |
| `toErrorMessage` | `server/agents/coderx/utils/coding-utils.ts` |
| `computeRetryDelay` | `server/agents/coderx/utils/coding-utils.ts` |
| `isRetryableError` | `server/agents/coderx/utils/coding-utils.ts` |
| `sleep` | `server/agents/coderx/utils/coding-utils.ts` |
| `normalizePrompt` | `server/agents/coderx/utils/coding-utils.ts` |
| `groupBy` | `server/agents/coderx/utils/coding-utils.ts` |
| `chunkArray` | `server/agents/coderx/utils/coding-utils.ts` |
| `safeJsonParse` | `server/agents/coderx/utils/coding-utils.ts` |

---

## Import Sources

```typescript
export { toPascalCase, toCamelCase, toKebabCase, toSnakeCase,
         pluralize, capitalize, truncate } from '../../tools/index.ts';

export * from './utils/coding-utils.ts';
```

`utils.ts` owns zero logic. It is a pure re-export file with two import sources.

---

## True Owners Confirmed

- **String utils:** `server/tools/shared/string-utils.ts` — canonical, exported through `server/tools/index.ts`
- **Coding utils:** `server/agents/coderx/utils/coding-utils.ts` — canonical, self-contained module
