# Architecture Agents — Master Reference

## Overview

The `architecture/` folder contains **8 pure, deterministic analysis and remediation modules**.
Together they form a complete architectural intelligence pipeline:
detect violations → classify → score → decide → fix → evolve.

No module reads from disk, calls external APIs, or mutates shared mutable state across module
boundaries. Every public function is pure or explicitly session-scoped.

---

## Module Map — Who Does What

| Module | Entry Point | Purpose |
|---|---|---|
| `boundary-analysis` | `analyzeBoundaries(graph)` | Detect layer, domain, and direction boundary violations |
| `dependency-analysis` | `analyzeDependencies(input)` | Build dependency graph; detect cycles, coupling, clusters |
| `responsibility-analysis` | `analyzeResponsibility(project)` | Detect SRP violations and mixed-concern files |
| `hvp-analysis` | `analyzeHVP(input)` | Validate HVP layer rules, state isolation, and orchestrator contracts |
| `pattern-detection` | `detectArchitecturePatterns(input)` | Classify architecture type and detect anti-patterns |
| `decision-engine` | `buildDecisionPlan(report)` | Score violations and produce a ranked remediation plan |
| `evolution` | `runArchitectureEvolution(report)` | Plan architecture migration with risks and tradeoffs |
| `architecture-fixer` | `runArchitectureFixer(input)` | Convert violations into concrete patch artifacts |

---

## HVP Layer Diagram (applies across all modules)

```
Level 1 — Orchestrators    (call agents; never import from agents above themselves)
Level 2 — Domain Agents    (call utils; never import from orchestrators)
Level 3 — Utils / State    (pure functions or isolated state; no upstream imports)
Level 4 — Types            (no imports except other type files)
```

---

## Root Master Orchestrator

**Folder:** `orchestrator/`

```
orchestrator/
├── index.ts                  ← public API (sirf yahi import karo)
├── master.orchestrator.ts    ← sab 8 modules ka controller
├── phase.guard.ts            ← safe error handling (crash nahi hoga)
└── violation.aggregator.ts   ← sab violations ek format mein convert
```

Yeh ek **single entry point** hai jo sabko control karta hai.
Call karo `runMasterArchitectureAnalysis(input)` aur yeh sab 8 modules ko
sequence mein chain karke ek `ArchitectureMasterReport` return karta hai.

```typescript
const report = await runMasterArchitectureAnalysis({
  graph,            // boundary-analysis ke liye
  projectFiles,     // responsibility-analysis ke liye
  dependencyInput,  // dependency-analysis ke liye
  patternInput,     // pattern-detection ke liye
  projectStructure, // hvp-analysis ke liye
  autoFix: false,   // true karo to architecture-fixer bhi chalega
});
// report.decisions     → kya fix karna hai aur priority kya hai
// report.evolutionPlan → long-term architecture roadmap
// report.overallHealthy → true/false
```

---

## Call Flow Diagram — Full Pipeline

```
runMasterArchitectureAnalysis(input)   ← SINGLE ENTRY POINT
          │
          │  architecture.orchestrator.ts controls sab
          ▼
┌─────────────────────────────────────────┐
│  [1] boundary-analysis                  │──► BoundaryReport
│  [2] responsibility-analysis            │──► ResponsibilityReport
│  [3] dependency-analysis                │──► DependencyAnalysisResult
│  [4] pattern-detection                  │──► ArchitecturePatternReport
│  [5] hvp-analysis                       │──► HVPComplianceReport
└─────────────────────────────────────────┘
          │
          │  sab violations ek saath aggregate hote hain
          │  → ArchitectureAnalysisReport banta hai
          ▼
┌─────────────────────────────────────────┐
│  [6] decision-engine                    │──► DecisionPlan (HIGH/MEDIUM/LOW)
└─────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│  [7] architecture-fixer (autoFix=true)  │──► FixResult (patches applied)
└─────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│  [8] evolution                          │──► ArchitectureEvolutionPlan
└─────────────────────────────────────────┘
          │
          ▼
    ArchitectureMasterReport
```

---

## Module-by-Module File Breakdown

### boundary-analysis
```
boundary-orchestrator.ts         ← Level 1: coordinates all agents
layer-boundary.validator.agent.ts← Level 2: HVP layer direction rules
dependency-direction.validator.  ← Level 2: role-to-role direction + cycles
domain-leakage.detector.agent.ts ← Level 2: forbidden domain pairs + infra bleed
violation-reporter.agent.ts      ← Level 2: aggregates + scores + builds report
utils/graph.helper.ts            ← Level 3: graph traversal, cycle detection
utils/rule.engine.ts             ← Level 3: pure rule functions
state.ts                         ← Level 3: session + history ring-buffer
types.ts                         ← Level 4: ArchitectureGraph, BoundaryReport, etc.
```

### dependency-analysis
```
dependency-orchestrator.ts       ← Level 1
graph-builder.agent.ts           ← Level 2: builds DependencyGraph from SourceModules
cycle-detector.agent.ts          ← Level 2: DFS cycle detection
coupling-analyzer.agent.ts       ← Level 2: afferent/efferent coupling + instability
cluster-detector.agent.ts        ← Level 2: connected-component cluster extraction
metrics-computer.agent.ts        ← Level 2: aggregate health metrics
utils/graph.util.ts              ← Level 3: adjacency helpers
utils/traversal.util.ts          ← Level 3: DFS/BFS traversal
utils/score.util.ts              ← Level 3: instability, health scoring
state.ts                         ← Level 3: session + graph + result cache
types.ts                         ← Level 4
```

### responsibility-analysis
```
responsibility-orchestrator.ts   ← Level 1
agents/concern-detector.agent.ts ← Level 2: detects concern tags (DB, HTTP, etc.)
agents/multi-responsibility      ← Level 2: detects SRP violations
agents/purity-evaluator.agent.ts ← Level 2: evaluates module purity
agents/srp-score.calculator      ← Level 2: per-file SRP score
utils/file-metrics.util.ts       ← Level 3: line count, role inference
utils/tag-extractor.util.ts      ← Level 3: pattern-based concern tagging
state.ts                         ← Level 3
types.ts                         ← Level 4
```

### hvp-analysis
```
hvp-orchestrator.ts              ← Level 1
validators/layer-structure        ← Level 2: validates presence of all required HVP layers
validators/orchestrator-rule      ← Level 2: orchestrator contracts
validators/cross-layer            ← Level 2: cross-layer import direction
validators/import-direction       ← Level 2: import direction by role
validators/state-isolation        ← Level 2: state write isolation
utils/import-graph.builder.ts    ← Level 3
utils/layer-map.builder.ts       ← Level 3
state.ts                         ← Level 3
types.ts                         ← Level 4
```

### pattern-detection
```
pattern-orchestrator.ts          ← Level 1
agents/pattern-classifier.agent  ← Level 2: classifies monolith/layered/modular/micro
agents/layering.detector.agent   ← Level 2: detects layer structure and violations
agents/modularity.analyzer.agent ← Level 2: cohesion + coupling scores
agents/microservice.detector     ← Level 2: boundary confidence scoring
agents/anti-pattern.detector     ← Level 2: detects god modules, cycles, etc.
agents/coupling-pattern.analyzer ← Level 2: tight coupling pairs
agents/pattern-score.calculator  ← Level 2: composite final score
utils/import-graph.util.ts       ← Level 3
utils/folder-structure.util.ts   ← Level 3
utils/heuristic.engine.ts        ← Level 3
utils/score.util.ts              ← Level 3
state.ts                         ← Level 3
types.ts                         ← Level 4
```

### decision-engine
```
orchestrator/decision.orchestrator.ts ← Level 1
classification/violation.classifier   ← Level 2: categorize violation type
scoring/severity.scorer.ts            ← Level 2: maps severity enum → score
scoring/impact.scorer.ts              ← Level 2: module spread + layer depth + criticality
scoring/risk.scorer.ts                ← Level 2: prod-break + perf + security risk
prioritization/priority.calculator    ← Level 2: weighted priority score
prioritization/urgency.detector       ← Level 2: deploy-block + urgent flag
strategy/fix-strategy.builder         ← Level 2: selects isolation or refactor strategy
strategy/isolation.strategy           ← Level 2: boundary/state isolation strategies
strategy/refactor.strategy            ← Level 2: dependency/SRP refactor strategies
utils/normalization.util.ts           ← Level 3: clampScore()
utils/weight.util.ts                  ← Level 3: weighted score composition
state.ts                              ← Level 3
types.ts                              ← Level 4
```

### evolution
```
evolution-orchestrator.ts              ← Level 1
agents/pattern-detector.agent.ts       ← Level 2: detects current pattern from report
agents/evolution-strategy.agent.ts     ← Level 2: selects target + builds strategy
agents/migration-planner.agent.ts      ← Level 2: ordered migration steps
agents/risk-analyzer.agent.ts          ← Level 2: LOW/MEDIUM/HIGH risk assessment
agents/tradeoff-evaluator.agent.ts     ← Level 2: documents tradeoffs
utils/pattern-map.util.ts              ← Level 3: pattern signal mapping
utils/strategy-builder.util.ts         ← Level 3: narrative builder
utils/dependency-graph.util.ts         ← Level 3
utils/scoring.util.ts                  ← Level 3: evolution plan score
state.ts                               ← Level 3
types.ts                               ← Level 4
```

### architecture-fixer
```
orchestrator/fixer.orchestrator.ts     ← Level 1
orchestrator/pipeline.manager.ts       ← Level 1 (sub-pipeline)
mapping/violation.mapper.ts            ← Level 2: raw → FixableViolation
strategies/layer-violation.strategy.ts ← Level 2
strategies/dependency-cycle.strategy.ts← Level 2
strategies/domain-leakage.strategy.ts  ← Level 2
strategies/srp-violation.strategy.ts   ← Level 2
planner/fix-plan.builder.ts            ← Level 2: ordered FixPlan with risk scoring
transformer/import.rewriter.ts         ← Level 2
transformer/file.mover.ts              ← Level 2
transformer/code.splitter.ts           ← Level 2
validator/fix.validator.ts             ← Level 2
bridge/patch.generator.ts              ← Level 2: unified diff generation
bridge/execution.adapter.ts            ← Level 2: NoopExecutionAdapter (dry-run)
state/fix-session.state.ts             ← Level 3
types.ts                               ← Level 4
```

---

## Who Calls Whom (Cross-Module)

```
boundary-analysis     ──→ (standalone, no cross-module calls)
dependency-analysis   ──→ (standalone)
responsibility-analysis──→ (standalone)
hvp-analysis          ──→ (standalone)
pattern-detection     ──→ (standalone)

decision-engine       ──→ consumes ArchitectureAnalysisReport
                           (output from any of the 5 analysis modules)

evolution             ──→ consumes ArchitectureAnalysisReport
                           (same report type as decision-engine)

architecture-fixer    ──→ consumes violations from any analysis module
                           via RawViolation (normalized through violation.mapper)
```

---

## Completion Status

| Module | Types | State | Agents/Utils | Orchestrator | Index | Test | replit.md |
|---|---|---|---|---|---|---|---|
| boundary-analysis | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| dependency-analysis | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| responsibility-analysis | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| hvp-analysis | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| pattern-detection | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| decision-engine | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| evolution | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| architecture-fixer | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **root index.ts** | ✓ | — | — | — | ✓ | — | — |
| **root replit.md** | — | — | — | — | — | — | ✓ |

**Overall: ~100% complete**

---

## Cohesion + Coupling Rules (enforced by design)

- **High cohesion**: every file in a module has a single, named responsibility  
  (orchestrator, agent, util, state, type, test)
- **Low coupling**: modules communicate only through frozen public types  
  exported by `index.ts`; they never import each other's internal files
- **State isolation**: only `state.ts` files hold mutable state; agents and utils are pure
- **No cross-layer imports**: agents never import orchestrators; types never import agents
