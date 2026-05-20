# Backend Intelligence Report Engine

## 1. System Overview
The Backend Intelligence Report Engine consolidates typed outputs from all backend-intelligence modules into one immutable report. The engine follows an HVP pipeline: orchestration (L1), domain agents (L2), utilities (L3), and shared contracts/state (L0).

Design guarantees:
- High cohesion: each file has one responsibility.
- Low coupling: no agent depends on another agent internals.
- Immutable output: every major object is frozen and final report is `Object.freeze(...)`.
- No partial data: required sections are always generated even when inputs are missing.

## 2. Folder Responsibilities
- `report.orchestrator.ts` (L1): Runs full report pipeline.
- `types.ts` (L0): Input/output contracts.
- `state.ts` (L0): Immutable state transitions.
- `index.ts`: Public exports.

### Agents (L2)
- `agents/summary.builder.agent.ts`: Builds high-level summary.
- `agents/section.generator.agent.ts`: Builds Architecture/Performance/Security/Database/Deployment sections.
- `agents/issue.grouping.agent.ts`: Groups normalized issues by severity/domain/type.
- `agents/action.plan.agent.ts`: Builds prioritized action steps.
- `agents/formatter.agent.ts`: Produces sorted, readable final report structure.

### Utils (L3)
- `utils/merge.util.ts`: Collects issue arrays and score candidates.
- `utils/normalize.util.ts`: Converts mixed upstream outputs into normalized issues.
- `utils/sort.util.ts`: Sorting for issues, sections, and actions.

## 3. Call Flow Diagram
```text
index.ts
  -> buildBackendIntelligenceReport (report.orchestrator.ts)
      -> normalizeInputs (utils/normalize.util.ts)
      -> groupIssues (agents/issue.grouping.agent.ts)
      -> generateSections (agents/section.generator.agent.ts)
      -> buildSummary (agents/summary.builder.agent.ts)
      -> buildActionPlan (agents/action.plan.agent.ts)
      -> formatReport (agents/formatter.agent.ts)
      -> FinalReport (frozen)
```

## 4. Input Contract (All Modules)
`ReportInput`

```json
{
  "analysis": {},
  "decision": {},
  "security": {},
  "generation": {},
  "deployment": {},
  "priority": {},
  "consistency": {},
  "recommendation": {},
  "quality": {},
  "context": {}
}
```

Each module is consumed as `IntelligenceModuleOutput`, with optional issue-like arrays (`issues`, `findings`, `risks`, `recommendations`) and optional scores.

## 5. Output Format
`FinalReport`

```json
{
  "summary": {
    "overallScore": 82,
    "criticalIssues": 1,
    "warnings": 4,
    "strengths": ["Deployment posture is healthy."],
    "quickSummary": "Immediate remediation required: 1 critical issue(s) and 4 warning(s) detected."
  },
  "sections": [
    {
      "name": "Architecture",
      "score": 75,
      "status": "WARNING",
      "highlights": ["..."],
      "issueCount": 2
    }
  ],
  "actions": [
    {
      "step": "Resolve critical security risk: Missing token validation.",
      "priority": "P0",
      "impact": "HIGH"
    }
  ],
  "score": 82,
  "status": "WARNING"
}
```

## 6. Example Report
```ts
import { buildBackendIntelligenceReport } from "./index.js";

const report = buildBackendIntelligenceReport({
  security: {
    findings: [
      {
        id: "sec-1",
        title: "Missing token validation",
        message: "Auth middleware does not validate JWT signature",
        severity: "CRITICAL",
        domain: "security",
        type: "authentication",
      },
    ],
  },
  deployment: {
    issues: [
      {
        title: "No rollback plan",
        message: "Release workflow lacks rollback guardrails",
        severity: "HIGH",
        domain: "deployment",
      },
    ],
  },
});

console.log(report.status); // CRITICAL
console.log(report.actions[0]?.priority); // P0
```
