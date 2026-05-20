# Test Ops Runner (HVP-Compliant)

## 1) Test Flow
The orchestration flow is strictly linear:

`orchestrator -> discovery -> executor -> parser -> coverage -> failure`

1. `test-runner.agent.ts` initializes run context/config.
2. `test-discovery.agent.ts` discovers `*.test.ts` and `*.spec.ts` files.
3. `test-executor.agent.ts` executes tests with a command abstraction.
4. `result-parser.agent.ts` parses stdout/stderr to structured pass/fail output.
5. `coverage-analyzer.agent.ts` computes coverage summary.
6. `failure-analyzer.agent.ts` extracts failure reasons/files.
7. `orchestrator.ts` returns immutable final output.

## 2) File Responsibilities
- `types.ts` (L0): contract types (`TestCase`, `TestResult`, `CoverageReport`, `FailureReport`).
- `state.ts` (L0): immutable execution state and controlled update API.
- `orchestrator.ts` (L1): sequencing only; no parsing/business internals.
- `agents/*` (L2): one responsibility per agent.
- `utils/*` (L3): helper-only utilities.
- `index.ts`: public API (`runTests`, `getCoverage`, `getFailures`).

## 3) Import Relationships
- L1 (`orchestrator`) imports L2 + L0 only.
- L2 (`agents`) import L3 + L0 only.
- L3 (`utils`) import L0 only.
- No agent imports another agent.

## 4) Example Test Run
```ts
import { runTests, getCoverage, getFailures } from "./index.js";

const result = await runTests({ framework: "vitest", coverage: true });
console.log(result.success, result.passed, result.failed, result.coverage);
console.log(getCoverage());
console.log(getFailures());
```
