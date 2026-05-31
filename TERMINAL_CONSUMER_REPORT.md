# TERMINAL_CONSUMER_REPORT.md

## Scan scope
Entire `server/` directory, all `.ts` files, excluding `server/agents/terminal/`
internals and `server/.local/`.

---

## External Consumers Found: 1 file

---

### Consumer 1 — `server/orchestration/coordination/agent-coordinator.ts`

| Field     | Detail |
|-----------|--------|
| Category  | Orchestrator |
| Line      | 26 |
| Import    | `import { executeTerminalSession } from '../../agents/terminal/terminal-agent.ts'` |
| Symbol    | `executeTerminalSession` |
| In index? | ✓ YES (index line 13) |
| Violation?| ✓ **DEEP IMPORT — fixable** |
| Fix       | `import { executeTerminalSession } from '../../agents/terminal/index.ts'` |

---

## Coverage Summary

| Consumer | Symbols Used | All in Index? | Violation? |
|----------|-------------|---------------|------------|
| `agent-coordinator.ts:26` | `executeTerminalSession` | ✓ | ✓ Deep import — fixed |
