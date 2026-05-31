# VERIFIER_CONSUMER_REPORT.md

## Scan scope
Entire `server/` directory, all `.ts` files, excluding `server/agents/verifier/`
internals and `server/.local/`.

---

## External Consumers Found: 1 file

---

### Consumer 1 — `server/orchestration/coordination/agent-coordinator.ts`

| Field     | Detail |
|-----------|--------|
| Category  | Orchestrator |
| Line      | 27 |
| Import    | `import { runVerification } from '../../agents/verifier/verifier-agent.ts'` |
| Symbol    | `runVerification` |
| In index? | ✓ YES (index line 13) |
| Violation?| ✓ **DEEP IMPORT — fixable** |
| Fix       | `import { runVerification } from '../../agents/verifier/index.ts'` |

---

## Coverage Summary

| Consumer | Symbols Used | All in Index? | Violation? |
|----------|-------------|---------------|------------|
| `agent-coordinator.ts:27` | `runVerification` | ✓ | ✓ Deep import — fixed |
