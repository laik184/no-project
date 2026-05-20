# Backend Strategy Engine (HVP)

## 1) System Overview

The **Strategy Engine** transforms prioritized backend issues into deterministic, dependency-aware execution plans.

- Input: `Issue[]` + `PriorityResult`
- Output: `FinalStrategyOutput`
- Intelligence-only: no code execution, no runtime mutation outside orchestration state tracking.

## 2) Folder Responsibilities

- `strategy.orchestrator.ts`
  - Entry point and flow control.
  - Manages state progression and aggregation.
- `agents/fix-planner.agent.ts`
  - Maps each issue to one strategy using deterministic keyword-based rules.
- `agents/step-builder.agent.ts`
  - Expands each strategy into concrete step-by-step actions.
- `agents/dependency-sequencer.agent.ts`
  - Applies dependency-aware ordering for execution correctness.
- `utils/plan.util.ts`
  - Shared helpers for deduplication, merging, and ordering.
- `types.ts`
  - Contracts for issue input, strategies, plans, and final output.
- `state.ts`
  - Internal orchestration state model (`StrategyState`).
- `index.ts`
  - Public exports for the module.

## 3) Call Flow Diagram

```text
index.ts
   ↓
strategy.orchestrator.ts
   ↓
fix-planner.agent.ts
   ↓
step-builder.agent.ts
   ↓
dependency-sequencer.agent.ts
   ↓
FinalStrategyOutput
```

## 4) Strategy Generation Lifecycle

1. **Receive Input**
   - Validate issues list; empty input returns empty plan.
2. **Merge & Prioritize**
   - Duplicate issues are merged by issue id.
   - Highest priority is retained.
3. **Plan Fixes**
   - Deterministic strategy mapping from issue content.
4. **Build Steps**
   - Strategy-specific templates are expanded into sequential steps.
5. **Sequence Dependencies**
   - Steps are dependency-sorted (DB/schema before service/controller/tests).
6. **Finalize Output**
   - Plans are sorted by priority and total step count is computed.

## 5) Example Input / Output

### Input

```ts
issues = [
  { id: "ISS-101", title: "N+1 query in order endpoint", tags: ["database", "performance"] },
  { id: "ISS-201", title: "Missing auth checks", tags: ["security"] }
];

priorityResult = {
  sortedIssues: [
    { id: "ISS-201", priority: 95 },
    { id: "ISS-101", priority: 88 }
  ]
};
```

### Output

```ts
{
  plans: [
    {
      issueId: "ISS-201",
      strategy: "Harden security boundaries with validation, authorization checks, and safe query patterns",
      priority: 95,
      steps: ["Step 1: ...", "Step 2: ...", "Step 3: ...", "Step 4: ..."]
    },
    {
      issueId: "ISS-101",
      strategy: "Optimize data access with eager loading, batching, and index tuning",
      priority: 88,
      steps: ["Step 1: ...", "Step 2: ...", "Step 3: ...", "Step 4: ..."]
    }
  ],
  totalSteps: 8
}
```

## 6) Import Rules

Allowed:

- orchestrator → agents
- agents → utils
- all → types

Forbidden:

- agents importing each other
- state used outside orchestrator
- direct dependency on analysis modules
