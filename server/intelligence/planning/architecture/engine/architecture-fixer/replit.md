# Architecture Fixer

## 1. System Overview
Architecture Fixer converts analyzer violations into deterministic, patch-first remediation plans. It does **not** mutate files directly; it produces transform artifacts and unified diffs, validates results, then forwards patches through an execution adapter.

## 2. Folder Responsibilities
- `orchestrator/`: end-to-end fix pipeline coordination.
- `mapping/`: normalize heterogeneous analyzer output into `FixableViolation`.
- `strategies/`: deterministic strategy-to-action mapping by violation kind.
- `planner/`: ordered dependency-safe fix plan assembly with risk scoring.
- `transformer/`: AST-safe style transform primitives for imports/moves/splits.
- `validator/`: post-plan validation score and regression warning generation.
- `bridge/`: patch generation and execution adapter boundary.
- `state/`: in-memory immutable fix-session tracking.
- `types.ts`: shared contracts across all layers.

## 3. Fix Pipeline Diagram
```text
FixerOrchestrator
  -> ViolationMapper
  -> Strategy Selection
  -> FixPlanBuilder
  -> Transformer (rewrite/move/split)
  -> PatchGenerator
  -> FixValidator
  -> ExecutionAdapter (dry-run or external)
  -> FixResult
```

## 4. Supported Violations
- `LAYER_VIOLATION`
- `DEPENDENCY_CYCLE`
- `DOMAIN_LEAKAGE`
- `SRP_VIOLATION`
- Unsupported violations are skipped with warnings.

## 5. Strategy Mapping Table
| Violation Kind | Primary Actions | Safety Notes |
|---|---|---|
| `LAYER_VIOLATION` | `MOVE_FILE`, `REWRITE_IMPORT` | Move is patch-only and reversible in diff history. |
| `DEPENDENCY_CYCLE` | `EXTRACT_INTERFACE`, `REWRITE_IMPORT` | Introduces abstraction before rewiring dependency. |
| `DOMAIN_LEAKAGE` | `MOVE_FILE`, `REWRITE_IMPORT` | Isolates domain logic away from infra paths. |
| `SRP_VIOLATION` | `SPLIT_FILE`, `REWRITE_IMPORT` | Creates focused modules and re-export surface. |

## 6. Example Fix (before/after)
### Before
```ts
// services/order.service.ts
import { DbOrderRepository } from "../infrastructure/db/order.repository";
export class OrderService {
  // business rules + SQL + DTO mapping in one file
}
```

### After (patch result)
```ts
// domain/order/order.service.core.ts
export class OrderService {
  // business rules only
}

// domain/order/order.service.helpers.ts
export class OrderMapper {
  // mapping helpers
}

// services/order.service.ts
export * from "./order.service.core.js";
export * from "./order.service.helpers.js";
```
