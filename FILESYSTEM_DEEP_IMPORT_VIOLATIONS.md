# FILESYSTEM_DEEP_IMPORT_VIOLATIONS.md

## Total violations: 1

---

## Violation 1 — FIXABLE (symbol already in index, wrong path)

| Field | Detail |
|-------|--------|
| File | `server/orchestration/coordination/agent-coordinator.ts` |
| Line | 23 |
| Deep Import | `../../agents/filesystem/filesystem-agent.ts` |
| Symbol | `runFilesystemAgent` |
| In index? | ✓ YES |
| Fix | Change path to `../../agents/filesystem/index.ts` |

### Current (violating)
```typescript
import { runFilesystemAgent } from '../../agents/filesystem/filesystem-agent.ts';
```

### Recommended (barrel)
```typescript
import { runFilesystemAgent } from '../../agents/filesystem/index.ts';
```

---

## Migration Risk: NONE

`runFilesystemAgent` is already exported at the top of `server/agents/filesystem/index.ts`
(line 12). Changing the import path is a pure path substitution — no runtime or
type-level change.
