# TERMINAL_DEEP_IMPORT_VIOLATIONS.md

## Total violations: 1

---

## Violation 1 — FIXABLE (symbol already in index, wrong path)

| Field | Detail |
|-------|--------|
| File | `server/orchestration/coordination/agent-coordinator.ts` |
| Line | 26 |
| Deep Import | `../../agents/terminal/terminal-agent.ts` |
| Symbol | `executeTerminalSession` |
| In index? | ✓ YES — index line 13 |
| Fix | Change path to `../../agents/terminal/index.ts` |

### Current (violating)
```typescript
import { executeTerminalSession } from '../../agents/terminal/terminal-agent.ts';
```

### Recommended (barrel)
```typescript
import { executeTerminalSession } from '../../agents/terminal/index.ts';
```

---

## Migration Risk: NONE

`executeTerminalSession` is exported at the top of `server/agents/terminal/index.ts`
(line 13). Pure path substitution — no runtime or type-level change.
