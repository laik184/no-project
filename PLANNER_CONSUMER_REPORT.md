# PLANNER_CONSUMER_REPORT.md

## Scan scope
Entire `server/` directory, all `.ts` files, excluding `server/agents/planner/`
internals and `server/.local/`.

---

## External Consumers Found: 1 file

---

### Consumer 1 — `server/orchestration/coordination/agent-coordinator.ts`

| Field     | Detail |
|-----------|--------|
| Category  | Orchestrator |
| Line      | 24 |
| Import    | `import { runPlannerCycle } from '../../agents/planner/planner-agent.ts'` |
| Symbol    | `runPlannerCycle` |
| In index? | ✓ YES |
| Violation?| ✓ **DEEP IMPORT — fixable** |
| Fix       | `import { runPlannerCycle } from '../../agents/planner/index.ts'` |

---

## Coverage Summary

| Consumer | Symbols Used | All in Index? | Violation? |
|----------|-------------|---------------|------------|
| `agent-coordinator.ts` | `runPlannerCycle` | ✓ | ✓ Deep import — fixed |
