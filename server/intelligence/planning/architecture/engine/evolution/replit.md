# Architecture Evolution Engine

## 1) Module purpose
The Architecture Evolution Engine transforms an `ArchitectureAnalysisReport` into a risk-aware `ArchitectureEvolutionPlan`.
It identifies the current architecture pattern, chooses an evolution target, generates migration steps, evaluates risks,
and summarizes tradeoffs and score for execution planning.

## 2) Folder structure
```txt
evolution/
├── evolution-orchestrator.ts
├── agents/
│   ├── pattern-detector.agent.ts
│   ├── evolution-strategy.agent.ts
│   ├── migration-planner.agent.ts
│   ├── risk-analyzer.agent.ts
│   └── tradeoff-evaluator.agent.ts
├── utils/
│   ├── pattern-map.util.ts
│   ├── strategy-builder.util.ts
│   ├── dependency-graph.util.ts
│   └── scoring.util.ts
├── types.ts
├── state.ts
├── index.ts
└── replit.md
```

## 3) HVP layers explanation
- **Level 1 (Orchestrator):** `evolution-orchestrator.ts`
  - Coordinates call sequence and state updates.
- **Level 2 (Agents):** `agents/*.agent.ts`
  - Encapsulated decision logic per concern (pattern, strategy, migration, risk, tradeoff).
- **Level 3 (Utils / Types / State):** `utils/*`, `types.ts`, `state.ts`, `index.ts`
  - Shared contracts, deterministic helpers, and state management.

Import direction is strict: **L1 → L2 → L3** only.

## 4) Call flow diagram
```txt
runArchitectureEvolution(report)
  ├─ detectArchitecturePattern(report)
  ├─ buildEvolutionStrategy(report, pattern)
  ├─ generateMigrationPlan(pattern, strategy)
  ├─ analyzeEvolutionRisks(pattern, migrationPlan)
  ├─ evaluateTradeoffs(targetPattern)
  └─ scoreEvolutionPlan(...)
      ↓
   returns ArchitectureEvolutionPlan
```

## 5) Example input/output
### Input (`ArchitectureAnalysisReport`)
```ts
{
  reportId: "arch-report-001",
  analyzedAt: Date.now(),
  totalViolations: 12,
  violations: [
    { id: "v1", type: "DependencyCycle", severity: "HIGH", message: "cyclic dependency between billing and orders" },
    { id: "v2", type: "ModuleDesign", severity: "MEDIUM", message: "god module in user-domain" }
  ],
  metadata: { moduleCount: 9, teamSize: 14, scale: "high", throughputRps: 1200 }
}
```

### Output (`ArchitectureEvolutionPlan`)
```ts
{
  currentArchitecture: "modular",
  targetArchitecture: "microservices",
  strategy: "Promote high-churn modules into services with explicit contracts and independent deployability.",
  migrationSteps: [
    "Step 1: inventory domains and isolate module boundaries by business capability.",
    "Step 2: break cyclic dependencies with interface extraction and event-driven handoffs.",
    "..."
  ],
  risks: [
    "Breaking changes in module/service interfaces during rollout.",
    "Data inconsistency risk during transition and ownership realignment.",
    "Deployment complexity increases as topology changes."
  ],
  tradeoffs: [
    "+ Improved scalability under growth and uneven workload distribution.",
    "- Increased operational complexity (monitoring, release orchestration, ownership boundaries)."
  ],
  score: 71
}
```

## 6) Evolution examples
- **Monolith → Modular**
  - First harden boundaries, split god modules, and establish explicit internal APIs.
- **Layered → Modular**
  - Convert vertical layers into domain-owned modules while preserving layer discipline.
- **Modular → Microservices**
  - Extract high-churn/high-scale modules into independent services with contract testing.
- **Microservices → Microservices (maturity path)**
  - Focus on reliability, observability, and reducing cross-service coupling.
