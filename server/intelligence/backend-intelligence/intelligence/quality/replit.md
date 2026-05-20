# Backend Quality Engine

## 1. System Overview
The Quality Engine is a deterministic aggregation module that converts backend intelligence signals into a single immutable quality report. It is intentionally split by responsibility (dimension scoring, weight management, score aggregation, grade classification) to preserve high cohesion and low coupling.

## 2. Scoring Logic Explanation
1. Input scores are received through the `QualityInput` contract.
2. Each dimension is normalized to a strict `[0..100]` range by `dimension.scorer.agent.ts`.
3. `weight.manager.agent.ts` resolves and normalizes dimension weights.
4. `score.aggregator.agent.ts` computes the weighted total using:
   - `FINAL_SCORE = Σ(score × weight)`
5. `grade.classifier.agent.ts` maps the final score to a letter grade.
6. `quality.orchestrator.ts` assembles an immutable `QualityReport` and updates immutable state.

## 3. Weight Distribution
- architecture: `0.25`
- security: `0.25`
- performance: `0.20`
- codeQuality: `0.15`
- risk: `0.15`

Total: `1.00`

## 4. Call Flow Diagram
```text
index.ts
  ↓
quality.orchestrator.ts
  ↓
dimension.scorer.agent.ts
  ↓
weight.manager.agent.ts
  ↓
score.aggregator.agent.ts
  ↓
grade.classifier.agent.ts
  ↓
return QualityReport
```

## 5. Example Input / Output
### Input (`QualityInput`)
```json
{
  "architecture": 92,
  "security": 88,
  "performance": 79,
  "codeQuality": 84,
  "risk": 70
}
```

### Output (`QualityReport`)
```json
{
  "score": 83.9,
  "grade": "B",
  "breakdown": {
    "architecture": 92,
    "security": 88,
    "performance": 79,
    "codeQuality": 84,
    "risk": 70
  }
}
```
