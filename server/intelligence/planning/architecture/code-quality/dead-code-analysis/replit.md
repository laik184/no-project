# dead-code-analysis

## Purpose
Identifies unreachable code, unused exports, deprecated patterns, and orphaned modules across the codebase.

## Orchestrator
`orchestrator.ts` — coordinates dead-code detection agents and produces a `DeadCodeReport`.

## Agents
| Agent | Responsibility |
|---|---|
| `unreachable-code.agent.ts` | Detects code blocks that can never be executed |
| `unused-export.agent.ts` | Finds exported symbols with no consumers |
| `deprecated-pattern.agent.ts` | Flags deprecated API usage and legacy patterns |
| `orphan-module.agent.ts` | Identifies modules with no import graph connections |

## Flow
```
DeadCodeInput
  → unreachable-code detection
  → unused-export scanning
  → deprecated-pattern flagging
  → orphan-module detection
  → DeadCodeReport { issues, riskLevel }
```

## State
`state.ts` — tracks session phases and issue counters.

## Types
`types.ts` — `DeadCodeIssueType`, `DeadCodeSeverity`, `DeadCodeReport`.
