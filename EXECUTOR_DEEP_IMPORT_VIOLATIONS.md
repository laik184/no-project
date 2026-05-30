# EXECUTOR_DEEP_IMPORT_VIOLATIONS.md

## Total violations: 10 import statements across 3 files

---

## Category A — FIXABLE (symbol already in index, wrong path)

| File | Line | Deep Import | Symbol | Fix |
|------|------|-------------|--------|-----|
| `server/orchestration/coordination/agent-coordinator.ts` | 22 | `../../agents/executor/executor-agent.ts` | `runExecutorAgent` | Use `index.ts` |
| `server/memory/bootstrap/memory-loader.ts` | 26 | `../../agents/executor/types/executor.types.ts` | `TaskKind` | Use `index.ts` |

---

## Category B — REQUIRES INDEX ADDITION (symbol not yet in index)

| File | Line | Deep Import | Symbol | Action |
|------|------|-------------|--------|--------|
| `memory-hydrator.ts` | 14 | `memory/execution-history.ts` | `executionHistory` | Add to index, fix path |
| `memory-hydrator.ts` | 15 | `memory/failure-memory.ts` | `failureMemory` | Add to index, fix path |
| `memory-hydrator.ts` | 16 | `learning/learning-store.ts` | `learningStore` | Add to index, fix path |
| `memory-hydrator.ts` | 18 | `memory/execution-history.ts` | `ExecutionHistoryEntry` | Add to index, fix path |
| `memory-hydrator.ts` | 19 | `memory/failure-memory.ts` | `FailurePattern` | Add to index, fix path |
| `memory-hydrator.ts` | 20 | `learning/learning-store.ts` | `LearnedEntry` | Add to index, fix path |
| `memory-loader.ts` | 23 | `memory/execution-history.ts` | `ExecutionHistoryEntry` | Add to index, fix path |
| `memory-loader.ts` | 24 | `memory/failure-memory.ts` | `FailurePattern` | Add to index, fix path |
| `memory-loader.ts` | 25 | `learning/learning-store.ts` | `LearnedEntry`, `LearnedKind` | Add to index, fix path |

---

## Recommended barrel imports (post-fix)

### `server/orchestration/coordination/agent-coordinator.ts`
```typescript
import { runExecutorAgent } from '../../agents/executor/index.ts';
```

### `server/memory/bootstrap/memory-hydrator.ts`
```typescript
import { executionHistory, failureMemory, learningStore } from '../../agents/executor/index.ts';
import type { ExecutionHistoryEntry, FailurePattern, LearnedEntry } from '../../agents/executor/index.ts';
```

### `server/memory/bootstrap/memory-loader.ts`
```typescript
import type { ExecutionHistoryEntry, FailurePattern, LearnedEntry, LearnedKind, TaskKind }
  from '../../agents/executor/index.ts';
```
