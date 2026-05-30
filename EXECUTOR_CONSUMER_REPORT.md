# EXECUTOR_CONSUMER_REPORT.md

## Scan scope
Entire `server/` directory, all `.ts` files, excluding `server/agents/executor/` internals and `server/.local/`.

---

## External Consumers Found: 3 files

---

### Consumer 1 — `server/orchestration/coordination/agent-coordinator.ts`

| Field       | Detail                                                                 |
|-------------|------------------------------------------------------------------------|
| Category    | Orchestrator                                                           |
| Line        | 22                                                                     |
| Import      | `import { runExecutorAgent } from '../../agents/executor/executor-agent.ts'` |
| Symbol      | `runExecutorAgent`                                                     |
| In index?   | ✓ YES                                                                  |
| Violation?  | ✓ **DEEP IMPORT — fixable**                                            |
| Fix         | `import { runExecutorAgent } from '../../agents/executor/index.ts'`   |

---

### Consumer 2 — `server/memory/bootstrap/memory-hydrator.ts`

| Field       | Detail                                                                |
|-------------|-----------------------------------------------------------------------|
| Category    | Memory bootstrap                                                      |
| Symbols     | `executionHistory`, `failureMemory`, `learningStore`, `ExecutionHistoryEntry`, `FailurePattern`, `LearnedEntry` |
| In index?   | ✗ NOT in index — must be added                                        |
| Violation?  | ✓ **DEEP IMPORTS — requires index additions + path fix**             |

Current imports:
```typescript
import { executionHistory }  from '../../agents/executor/memory/execution-history.ts';
import { failureMemory }     from '../../agents/executor/memory/failure-memory.ts';
import { learningStore }     from '../../agents/executor/learning/learning-store.ts';
import type { ExecutionHistoryEntry } from '../../agents/executor/memory/execution-history.ts';
import type { FailurePattern }        from '../../agents/executor/memory/failure-memory.ts';
import type { LearnedEntry }          from '../../agents/executor/learning/learning-store.ts';
```

---

### Consumer 3 — `server/memory/bootstrap/memory-loader.ts`

| Field       | Detail                                                                |
|-------------|-----------------------------------------------------------------------|
| Category    | Memory bootstrap                                                      |
| Symbols     | `ExecutionHistoryEntry`, `FailurePattern`, `LearnedEntry`, `LearnedKind`, `TaskKind` |
| In index?   | `TaskKind` ✓ YES — others ✗ NOT in index                            |
| Violation?  | ✓ **DEEP IMPORTS — requires index additions + path fix**             |

Current imports:
```typescript
import type { ExecutionHistoryEntry } from '../../agents/executor/memory/execution-history.ts';
import type { FailurePattern }        from '../../agents/executor/memory/failure-memory.ts';
import type { LearnedEntry, LearnedKind } from '../../agents/executor/learning/learning-store.ts';
import type { TaskKind } from '../../agents/executor/types/executor.types.ts';
```
