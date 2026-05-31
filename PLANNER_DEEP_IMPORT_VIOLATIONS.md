# PLANNER_DEEP_IMPORT_VIOLATIONS.md

## Total violations: 1

---

## Violation 1 — FIXABLE (symbol already in index, wrong path)

| Field | Detail |
|-------|--------|
| File | `server/orchestration/coordination/agent-coordinator.ts` |
| Line | 24 |
| Deep Import | `../../agents/planner/planner-agent.ts` |
| Symbol | `runPlannerCycle` |
| In index? | ✓ YES (line 12 of index.ts) |
| Fix | Change path to `../../agents/planner/index.ts` |

### Current (violating)
```typescript
import { runPlannerCycle } from '../../agents/planner/planner-agent.ts';
```

### Recommended (barrel)
```typescript
import { runPlannerCycle } from '../../agents/planner/index.ts';
```

---

## Migration Risk: NONE

`runPlannerCycle` is exported at the top of `server/agents/planner/index.ts` (line 12).
This is a pure path substitution — no runtime or type-level impact.
