# complexity-analysis

## Purpose
Measures cyclomatic and cognitive complexity, function length, nesting depth, and callback hell patterns across source files.

## Orchestrator
`orchestrator.ts` — runs the full complexity scoring pipeline and returns a structured `ComplexityReport`.

## Agents
| Agent | Responsibility |
|---|---|
| `cyclomatic-scorer.agent.ts` | Calculates cyclomatic complexity per function |
| `cognitive-scorer.agent.ts` | Measures cognitive complexity using nesting and control-flow weights |
| `function-length.agent.ts` | Detects functions and files that exceed line-count thresholds |
| `nesting-depth.agent.ts` | Identifies deeply nested blocks and callback pyramids |

## Flow
```
ComplexityInput
  → cyclomatic scoring → cognitive scoring
  → function-length analysis → nesting depth analysis
  → ComplexityReport { issues, score, severity }
```

## State
`state.ts` — session phases: IDLE → CYCLOMATIC_SCORING → COGNITIVE_SCORING → FUNCTION_LENGTH_ANALYSIS → NESTING_DEPTH_ANALYSIS → COMPLETE.

## Types
`types.ts` — `ComplexityIssueType`, `ComplexitySeverity`, `ComplexityPhase`, `ComplexityReport`.
