# SUPERVISOR_DEEP_IMPORT_VIOLATIONS.md

## Total violations: 1

---

## Violation 1 — REQUIRES INDEX ADDITION (symbol not yet in index)

| Field | Detail |
|-------|--------|
| File | `server/orchestration/coordination/agent-coordinator.ts` |
| Line | 25 |
| Deep Import | `../../agents/supervisor/supervisor-agent.ts` |
| Symbol | `runSupervisorCycle` |
| Exists in source? | ✓ YES — `supervisor-agent.ts` line 58 |
| In index? | ✗ NO — must be added to `index.ts` |
| Action | Add `runSupervisorCycle` + `SupervisorCycleResult` to index, fix path |

### Current (violating)
```typescript
import { runSupervisorCycle } from '../../agents/supervisor/supervisor-agent.ts';
```

### Recommended (barrel — after index fix)
```typescript
import { runSupervisorCycle } from '../../agents/supervisor/index.ts';
```

---

## Migration Risk: NONE

`runSupervisorCycle` is a stable exported function in `supervisor-agent.ts`.
Adding it to the index is purely additive — no existing code changes.
Updating the import path in `agent-coordinator.ts` is a pure path substitution.
