# Testing Intelligence Module

**Path**: `server/agents/frontend-intelligence/testing/`
**Engine**: `testing-orchestrator.ts`
**Total Files**: 12

---

## Purpose

Pure static testing analysis engine for frontend component coverage.
Accepts structured `ComponentDescriptor[]` (each component's name, type,
stateful/effectful traits) and `TestFileDescriptor[]` (each test file's
path, framework, test count, and list of tested component names). Runs five
sequential analysis passes and produces an immutable `TestingAnalysisReport`.
No test execution, no filesystem access, no runtime calls.

---

## What It Handles

| Domain | Detection |
|---|---|
| **Presence** | Whether test files exist, how many frameworks are used, test-to-source ratio |
| **Mapping** | Which test files cover which components via name-matching + explicit `testedComponentNames` |
| **Critical Components** | Identifies high-priority components (pages, forms, stateful hooks, contexts) using a criticality scoring model |
| **Missing Tests** | Flags untested components with severity based on their criticality and type |
| **Coverage Score** | Weighted 0–100 composite score across presence, mapping, critical coverage, and test quality |

---

## What It Does NOT Handle

- Executing tests (Jest, Vitest, Playwright, Cypress, etc.)
- Parsing TypeScript/JavaScript ASTs or reading test file contents
- Measuring actual line/branch/function code coverage (Istanbul/c8)
- Accessing the filesystem or reading config files
- Modifying components or generating test stubs
- Git operations, CI pipeline, or deployment checks
- ESLint rules or TypeScript type errors
- Bundle size, routing, accessibility, or state analysis

---

## File-by-File Responsibility

| File | Responsibility |
|---|---|
| `types.ts` | All TypeScript types — zero imports, zero logic |
| `state.ts` | Session lifecycle, intermediate mapping store, stage tracking. Imports types only |
| `index.ts` | Public re-exports only |
| `testing-orchestrator.ts` | Sole coordinator: validates input, calls all 5 agents in fixed order, produces frozen TestingAnalysisReport |
| `presence-detector.agent.ts` | Computes hasTests, totalTestFiles, frameworks, test-to-source ratio, and presence score |
| `component-test-mapper.agent.ts` | Maps each component to test files using name matching + explicit component name lists |
| `critical-component.detector.ts` | Identifies critical components via type + state/effect/export traits; flags untested criticals |
| `missing-test-detector.agent.ts` | Generates MissingTestIssue for each untested component with type-specific suggestions |
| `coverage-estimator.agent.ts` | Computes the 4 domain scores and weighted 20/40/30/10 composite CoverageScoreBreakdown |
| `utils/test-pattern.matcher.ts` | Test file path pattern matching, base name extraction, framework detection from file path |
| `utils/component-resolver.ts` | Component type inference, criticality scoring, criticality reason builder |
| `replit.md` | Full documentation |

---

## HVP Layer Diagram

```
Level 1 — Orchestration
  testing-orchestrator.ts
    • Sole public entry point
    • Input validation (type + shape)
    • Fixed-order coordination of all 5 agents
    • Session lifecycle management
    • Returns frozen TestingAnalysisReport

Level 2 — Agents (5 independent, no cross-imports)
  presence-detector.agent.ts
  component-test-mapper.agent.ts
  critical-component.detector.ts
  missing-test-detector.agent.ts
  coverage-estimator.agent.ts

  Rules:
    • No agent imports another agent
    • Each returns its own typed readonly result
    • May import types and utils only

Level 3 — Utilities (pure computation, no side effects)
  utils/test-pattern.matcher.ts   ← path matching, framework detection, name normalization
  utils/component-resolver.ts     ← type inference, criticality scoring, reason builder

Level 0 — Foundation (no logic)
  types.ts   ← zero imports, zero logic
  state.ts   ← imports types only
```

---

## Call Flow Diagram

```
index.ts
  ↓ analyzeTesting(rawInput)
testing-orchestrator.ts
  ↓ validateInput(rawInput)
  ↓ initSession(input)                                     ← state
  ↓ detectPresence(testFiles, components.length)           ← presence-detector.agent
  ↓ mapComponentsToTests(components, testFiles)            ← component-test-mapper.agent
  ↓ detectCriticalComponents(components, mappings)         ← critical-component.detector
  ↓ detectMissingTests(components, mappings)               ← missing-test-detector.agent
  ↓ storeIntermediateMapping(mappings, criticals)          ← state
  ↓ buildCoverageBreakdown(presence, mappings, criticals, testFiles)  ← coverage-estimator.agent
  ↓ deriveSeverity(score)                                  ← coverage-estimator.agent
  ↓ Object.freeze(report)
  → TestingAnalysisReport
```

---

## Import Direction Rules

```
ALLOWED:
  testing-orchestrator       → presence-detector.agent
  testing-orchestrator       → component-test-mapper.agent
  testing-orchestrator       → critical-component.detector
  testing-orchestrator       → missing-test-detector.agent
  testing-orchestrator       → coverage-estimator.agent
  testing-orchestrator       → state
  testing-orchestrator       → types
  presence-detector.agent    → types
  presence-detector.agent    → utils/*
  component-test-mapper.agent → types
  component-test-mapper.agent → utils/*
  critical-component.detector → types
  critical-component.detector → utils/*
  missing-test-detector.agent → types
  missing-test-detector.agent → utils/*
  coverage-estimator.agent   → types
  state                      → types
  utils/*                    → types

FORBIDDEN:
  agent         → agent          (no cross-agent imports)
  agent         → state          (state is orchestrator-only)
  agent         → orchestrator   (no upward imports)
  state         → any agent
  utils/*       → any agent
  any module    → external agents or cross-domain modules
  any module    → runtime / filesystem / git
```

---

## Testing Lifecycle Explanation

### Phase 1 — Input Validation
The orchestrator validates that `sessionId` is a non-empty string,
`components` is a well-formed `ComponentDescriptor[]` (each with `id`,
`name`, `filePath`, `type`, and boolean flags), and `testFiles` is a valid
`TestFileDescriptor[]` (each with `id`, `filePath`, framework, testCount,
and `testedComponentNames`). Invalid input returns a frozen error report
with score 0 immediately — no exceptions are thrown.

### Phase 2 — Presence Detection
`detectPresence` computes whether test files exist at all, what frameworks
are in use (by deduplicating `testFramework` fields), and the test-to-source
ratio (testFiles.length / components.length). An empty `navigatedRoutes`-style
guard: if no test files exist at all, the presence score is 0 and downstream
mapping scores will also reflect zero coverage honestly.

### Phase 3 — Component-Test Mapping
`mapComponentsToTests` iterates each component and tries to find matching test
files using two signals:
1. **Explicit names**: `testFile.testedComponentNames` contains the component name
2. **Path-based**: the test file's base name (without `.test.tsx`) matches the component name

This produces a `ComponentTestMapping[]` where each entry declares `isTested`
and the list of covering test file paths.

### Phase 4 — Critical Component Detection
`detectCriticalComponents` scores each component for criticality using weighted
traits:

| Trait | Weight |
|---|---|
| page type | +35 pts |
| form type | +30 pts |
| context type | +25 pts |
| hook type | +20 pts |
| layout type | +20 pts |
| ui type | +10 pts |
| util type | +5 pts |
| hasState | +15 pts |
| hasEffects | +15 pts |
| hasProps | +10 pts |
| isExported | +5 pts |

Components scoring ≥ 40 are flagged as critical. Untested criticals with score
≥ 70 are CRITICAL severity; ≥ 40 are HIGH; below 40 are MEDIUM.

### Phase 5 — Missing Test Detection
`detectMissingTests` generates a `MissingTestIssue` for every untested component
with a type-specific suggestion (e.g., "use renderHook()" for hooks, "test submit
behavior" for forms). Severity mirrors criticality scoring.

### Phase 6 — Coverage Estimation
`buildCoverageBreakdown` computes four domain scores:

```
presenceScore         = f(testToSourceRatio)       [0/20/45/75/100]
mappingScore          = (tested / total) × 100
criticalCoverageScore = (testedCriticals / criticals) × 100
testQualityScore      = f(avg tests per file)      [0/20/40/70/100]
```

Weighted composite:

```
coverageScore = presenceScore        × 0.20
              + mappingScore          × 0.40
              + criticalCoverageScore × 0.30
              + testQualityScore      × 0.10
```

Mapping (40%) and critical coverage (30%) are weighted highest because
they represent the most structurally important coverage signals.

---

## Scoring Thresholds

### Coverage Severity

| Score | OverallSeverity |
|---|---|
| ≥ 90 | NONE |
| ≥ 75 | LOW |
| ≥ 55 | MEDIUM |
| ≥ 35 | HIGH |
| < 35 | CRITICAL |

### Quality Score (avg tests per file)

| Avg Tests | testQualityScore |
|---|---|
| ≥ 10 | 100 |
| ≥ 5 | 70 |
| ≥ 2 | 40 |
| ≥ 1 | 20 |
| < 1 | 5 |

---

## Example Input

```typescript
const input: TestingAnalysisInput = {
  sessionId: "testing-001",
  components: [
    {
      id: "c1",
      name: "LoginPage",
      filePath: "src/pages/LoginPage.tsx",
      type: "page",
      hasProps: true,
      hasState: true,
      hasEffects: true,
      isExported: true,
    },
    {
      id: "c2",
      name: "useAuth",
      filePath: "src/hooks/useAuth.ts",
      type: "hook",
      hasProps: false,
      hasState: true,
      hasEffects: true,
      isExported: true,
    },
    {
      id: "c3",
      name: "Avatar",
      filePath: "src/components/Avatar.tsx",
      type: "ui",
      hasProps: true,
      hasState: false,
      hasEffects: false,
      isExported: true,
    },
    {
      id: "c4",
      name: "CheckoutForm",
      filePath: "src/forms/CheckoutForm.tsx",
      type: "form",
      hasProps: true,
      hasState: true,
      hasEffects: true,
      isExported: true,
    },
  ],
  testFiles: [
    {
      id: "t1",
      filePath: "src/pages/LoginPage.test.tsx",
      testedComponentNames: ["LoginPage"],
      testFramework: "jest",
      testCount: 8,
    },
  ],
};
```

## Example Output

```json
{
  "sessionId": "testing-001",
  "coverageScore": 32,
  "severity": "CRITICAL",
  "totalIssues": 5,
  "summary": "Test coverage score: 32/100 — CRITICAL. 4 components analyzed; 5 issues detected across missing tests and critical coverage gaps.",
  "scoreBreakdown": {
    "presenceScore": 20,
    "mappingScore": 25,
    "criticalCoverageScore": 33,
    "testQualityScore": 70,
    "overall": 32
  },
  "presenceResult": {
    "hasTests": true,
    "totalTestFiles": 1,
    "frameworks": ["jest"],
    "testToSourceRatio": 0.25
  },
  "missingTestIssues": [
    {
      "componentId": "c4",
      "componentName": "CheckoutForm",
      "severity": "CRITICAL",
      "reason": "\"CheckoutForm\" has no associated test file. This component is a form-level component, manages state, has side effects, making it a testing priority.",
      "suggestion": "Create \"src/forms/CheckoutForm.test.tsx\" using render() + userEvent. Test: field validation, submit behavior, and error state rendering."
    },
    {
      "componentId": "c2",
      "componentName": "useAuth",
      "severity": "HIGH",
      "reason": "\"useAuth\" has no associated test file. This component manages state, has side effects, making it a testing priority.",
      "suggestion": "Create \"src/hooks/useAuth.test.ts\" using renderHook(). Verify initial state, state transitions, and cleanup."
    },
    {
      "componentId": "c3",
      "componentName": "Avatar",
      "severity": "LOW",
      "reason": "\"Avatar\" has no associated test file. No coverage data available.",
      "suggestion": "Create \"src/components/Avatar.test.tsx\" with render() and snapshot/behavior assertions."
    }
  ],
  "criticalComponents": [
    {
      "componentId": "c4",
      "componentName": "CheckoutForm",
      "criticalityScore": 95,
      "isTested": false,
      "severity": "CRITICAL",
      "reasons": ["Form component: handles user input and validation", "Manages internal state", "Has side effects (useEffect)", "Receives props", "Exported: used by other modules"]
    },
    {
      "componentId": "c1",
      "componentName": "LoginPage",
      "criticalityScore": 80,
      "isTested": true,
      "severity": "LOW",
      "reasons": ["Page-level component: entry point for users", "Manages internal state", "Has side effects (useEffect)", "Receives props", "Exported"]
    }
  ]
}
```

---

## Planner Integration Contract

```typescript
import { analyzeTesting } from "./testing/index.js";

const report = analyzeTesting({
  sessionId: "review-001",
  components: extractedComponentDescriptors,  // from AST metadata extractor
  testFiles: discoveredTestFileDescriptors,    // from file-system scan layer
});

// Gate PR if CRITICAL untested components found
if (report.missingTestIssues.some(i => i.severity === "CRITICAL")) {
  blockMerge("Critical components are missing test coverage.");
}

// Feed coverage score into health dashboard
recordMetric("testing.coverage", report.coverageScore);

// Surface critical coverage gaps
report.criticalComponents
  .filter(c => !c.isTested && c.criticalityScore >= 70)
  .forEach(c => createTask(`Add tests for ${c.componentName}`, c.componentId));
```

This module is a **pure leaf**. It never calls the planner.
The planner calls this module and acts on its immutable output.
