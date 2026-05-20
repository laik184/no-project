# Consistency Engine

## 1. System Overview
The Consistency Engine is a pure intelligence module that receives structured outputs from multiple backend-intelligence modules and produces a deterministic, unified truth. It does not execute external systems, mutate upstream data, or depend on module internals.

## 2. Role of Consistency Engine
- Detect output conflicts for shared subjects.
- Validate result quality and structural correctness.
- Resolve disagreements using deterministic selection rules.
- Return a unified truth package that downstream layers can trust.

## 3. Folder Responsibilities
- `consistency.orchestrator.ts` (L1): Coordinates end-to-end consistency flow.
- `agents/conflict.detector.agent.ts` (L2): Finds contradictory statuses across modules.
- `agents/validation.engine.agent.ts` (L2): Validates shape, required fields, and score ranges.
- `agents/truth.selector.agent.ts` (L2): Selects winning truth via severity, confidence, and weighted score.
- `utils/compare.util.ts` (L3): Pure helpers for normalization, scoring difference, severity weight, and deep equality.
- `types.ts` (L0): Canonical contracts for inputs, conflicts, validations, truth, and output.
- `state.ts` (L0): Immutable state transitions and output assembly.
- `index.ts`: Public exports.

## 4. Call Flow Diagram
```text
index.ts
  -> runConsistencyEngine (consistency.orchestrator.ts)
       -> detectConflicts (agents/conflict.detector.agent.ts)
       -> validateOutputs (agents/validation.engine.agent.ts)
       -> selectTruth (agents/truth.selector.agent.ts)
       -> ConsistencyOutput
```

## 5. Conflict Resolution Logic
Truth selection is deterministic and follows this precedence:
1. **Validation gate**: invalid signals are excluded.
2. **Severity override**: higher severity wins (`CRITICAL > HIGH > MEDIUM > LOW`).
3. **Weighted scoring**: `weighted = score*0.6 + confidence*0.4 + severityWeight*0.2`.
4. **Confidence tiebreaker**: higher confidence wins for equal weighted scores.

This ensures no non-deterministic tie resolution.

## 6. Example Input/Output
### Input
```json
{
  "outputs": [
    {
      "module": "performance-analyzer",
      "subject": "api-latency",
      "status": "OK",
      "confidence": 0.72,
      "severity": "MEDIUM",
      "score": 0.69,
      "reasons": ["route percentile below threshold"]
    },
    {
      "module": "backend-architecture",
      "subject": "api-latency",
      "status": "NOT_OK",
      "confidence": 0.84,
      "severity": "HIGH",
      "score": 0.88,
      "reasons": ["layer coupling increases latency risk"]
    }
  ]
}
```

### Output
```json
{
  "isConsistent": false,
  "conflicts": [
    {
      "subject": "api-latency",
      "statuses": ["OK", "NOT_OK"],
      "modules": ["performance-analyzer", "backend-architecture"],
      "severity": "HIGH",
      "confidenceSpread": 0.12
    }
  ],
  "resolved": true,
  "finalTruth": [
    {
      "subject": "api-latency",
      "status": "NOT_OK",
      "selectedModule": "backend-architecture",
      "confidence": 0.84,
      "severity": "HIGH",
      "supportingModules": ["performance-analyzer"],
      "weightedScore": 1
    }
  ]
}
```
