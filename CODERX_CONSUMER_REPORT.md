# CODERX_CONSUMER_REPORT.md

## Scan scope
Entire `server/` directory, all `.ts` files, excluding `server/agents/coderx/` internals and `server/.local/`.

---

## External Consumers Found: 1

### Consumer: `server/orchestration/coordination/agent-coordinator.ts`

| Field        | Detail                                                              |
|--------------|---------------------------------------------------------------------|
| Category     | Orchestrator                                                        |
| Import path  | `'../../agents/coderx/coderx-agent.ts'` ← **DEEP IMPORT VIOLATION** |
| Symbol used  | `runCoderXAgent`                                                    |
| In index?    | ✓ YES — `runCoderXAgent` is exported from `index.ts`               |
| Fix needed   | Replace with `'../../agents/coderx/index.ts'`                      |

```typescript
// CURRENT (violation)
import { runCoderXAgent } from '../../agents/coderx/coderx-agent.ts';

// CORRECT
import { runCoderXAgent } from '../../agents/coderx/index.ts';
```

---

## No Other Consumers Found

| Category      | Consumers |
|---------------|-----------|
| Agents        | 0         |
| Services      | 0         |
| Chat          | 0         |
| Tools         | 0         |
| Controllers   | 0         |
| Orchestrators | 1 (agent-coordinator.ts — violation) |

---

## Note: String comment reference (not an import)
`server/tools/shared/string-utils.ts:8` contains a code comment mentioning `agents/coderx/utils.ts`.
This is **not an import** — it is documentation text only. Not a violation.
