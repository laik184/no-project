# Architecture Pattern Detection Module

## 1) System overview
This module performs deterministic static analysis over a file list and optional file-content map to detect the dominant architecture pattern, flag anti-patterns, and compute a final architecture score.

It is built with strict HVP layering:
- L1: orchestration only
- L2: independent analysis agents
- L3: pure shared utilities, state, and types

## 2) Folder structure explanation
- `pattern-orchestrator.ts` (L1): strict call-flow coordinator and error handling.
- `agents/` (L2): single-responsibility analyzers.
  - `pattern-classifier.agent.ts`: classifies monolith/layered/modular/microservice.
  - `layering.detector.agent.ts`: identifies logical layers and violations.
  - `modularity.analyzer.agent.ts`: computes cohesion/coupling-driven modularity metrics.
  - `microservice.detector.agent.ts`: checks service boundaries and independence.
  - `anti-pattern.detector.agent.ts`: detects god modules, spaghetti risks, circular clusters, shared state risk, layer violations.
  - `coupling-pattern.analyzer.agent.ts`: fan-out and bidirectional dependency analysis.
  - `pattern-score.calculator.agent.ts`: weighted final score and quality level.
- `utils/` (L3): stateless deterministic helper functions.
- `types.ts` (L3): canonical type contracts.
- `state.ts` (L3): in-memory immutable analysis snapshot.
- `index.ts` (L3): public exports.

## 3) HVP layer explanation
- **L1** may import **L2 + L3**.
- **L2** may import **L3 only**.
- **L3** is pure foundational code and does not import L1/L2.
- No direct L2-to-L2 imports are used.

## 4) Call flow diagram
```text
pattern-orchestrator.ts (L1)
   ↓
pattern-classifier.agent.ts
   ↓
layering.detector.agent.ts
   ↓
modularity.analyzer.agent.ts
   ↓
microservice.detector.agent.ts
   ↓
anti-pattern.detector.agent.ts
   ↓
coupling-pattern.analyzer.agent.ts
   ↓
pattern-score.calculator.agent.ts
   ↓
ArchitecturePatternReport
```

## 5) Pattern detection logic
1. Build import graph from `fileContents` if available; otherwise deterministic empty-edge graph.
2. Extract module boundaries from top-level folder segmentation.
3. Classify architecture:
   - microservice: multiple service modules + high independence.
   - layered: controller/service/repository traces + lower density.
   - modular: enough module partitions + moderate independence.
   - monolith fallback otherwise.
4. Compute layering, modularity, microservice boundary, anti-pattern, and coupling metrics.
5. Produce weighted final score (0–100).

## 6) Anti-pattern examples
- `God module detected: billing`
- `Spaghetti code: dependency density exceeds safe threshold`
- `Circular dependency cluster: a.ts <-> b.ts`
- `Shared mutable state risk: src/state/store.ts`
- `Layer violation: Layer violation: controller/users.ts directly depends on repo/users.ts`

## 7) Example input/output
### Input
```ts
{
  files: [
    "server/controller/user.controller.ts",
    "server/service/user.service.ts",
    "server/repository/user.repo.ts"
  ],
  fileContents: {
    "server/controller/user.controller.ts": "import { userService } from './server/service/user.service.ts'",
    "server/service/user.service.ts": "import { userRepo } from './server/repository/user.repo.ts'",
    "server/repository/user.repo.ts": "export const userRepo = {}"
  }
}
```

### Output
```ts
{
  architectureType: "layered",
  confidence: 0.82,
  antiPatterns: [],
  couplingScore: 93,
  modularityScore: 88,
  finalScore: 90
}
```
