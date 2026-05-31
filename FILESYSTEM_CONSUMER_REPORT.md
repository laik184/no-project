# FILESYSTEM_CONSUMER_REPORT.md

## Scan scope
Entire `server/` directory, all `.ts` files, excluding `server/agents/filesystem/`
internals and `server/.local/`.

---

## External Consumers Found: 1 file

---

### Consumer 1 — `server/orchestration/coordination/agent-coordinator.ts`

| Field     | Detail |
|-----------|--------|
| Category  | Orchestrator |
| Line      | 23 |
| Import    | `import { runFilesystemAgent } from '../../agents/filesystem/filesystem-agent.ts'` |
| Symbol    | `runFilesystemAgent` |
| In index? | ✓ YES |
| Violation?| ✓ **DEEP IMPORT — fixable** |
| Fix       | `import { runFilesystemAgent } from '../../agents/filesystem/index.ts'` |

---

## Coverage Summary

| Consumer | Symbols Used | All in Index? | Violation? |
|----------|-------------|---------------|------------|
| `agent-coordinator.ts` | `runFilesystemAgent` | ✓ | ✓ Deep import |
