# SUPERVISOR_CONSUMER_REPORT.md

## Scan scope
Entire `server/` directory, all `.ts` files, excluding `server/agents/supervisor/`
internals and `server/.local/`.

---

## External Consumers Found: 1 file

---

### Consumer 1 — `server/orchestration/coordination/agent-coordinator.ts`

| Field     | Detail |
|-----------|--------|
| Category  | Orchestrator |
| Line      | 25 |
| Import    | `import { runSupervisorCycle } from '../../agents/supervisor/supervisor-agent.ts'` |
| Symbol    | `runSupervisorCycle` |
| In index? | ✗ **NOT in index** — must be added |
| Violation?| ✓ **DEEP IMPORT — requires index addition + path fix** |

---

## Coverage Summary

| Consumer | Symbols Used | In Index? | Violation? |
|----------|-------------|-----------|------------|
| `agent-coordinator.ts:25` | `runSupervisorCycle` | ✗ Missing | ✓ Add to index, fix path |
