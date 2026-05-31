# VERIFIER_DEEP_IMPORT_VIOLATIONS.md

## Total violations: 1

---

## Violation 1 — FIXABLE (symbol already in index, wrong path)

| Field | Detail |
|-------|--------|
| File | `server/orchestration/coordination/agent-coordinator.ts` |
| Line | 27 |
| Deep Import | `../../agents/verifier/verifier-agent.ts` |
| Symbol | `runVerification` |
| In index? | ✓ YES — index line 13 |
| Fix | Change path to `../../agents/verifier/index.ts` |

### Current (violating)
```typescript
import { runVerification } from '../../agents/verifier/verifier-agent.ts';
```

### Recommended (barrel)
```typescript
import { runVerification } from '../../agents/verifier/index.ts';
```

---

## Migration Risk: NONE

`runVerification` is exported at line 13 of `server/agents/verifier/index.ts`.
Pure path substitution — no runtime or type-level change.
