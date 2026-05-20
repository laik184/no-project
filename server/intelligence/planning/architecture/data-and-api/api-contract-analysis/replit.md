# api-contract-analysis

## Purpose
Validates API request/response contracts for schema compliance, versioning consistency, and breaking-change detection.

## Orchestrator
`orchestrator.ts` — runs contract validation agents and returns an `ApiContractReport`.

## Agents
| Agent | Responsibility |
|---|---|
| `schema-validator.agent.ts` | Validates request and response shapes against defined schemas |
| `versioning-checker.agent.ts` | Detects missing or inconsistent version annotations |
| `breaking-change.agent.ts` | Identifies changes that would break existing consumers |
| `contract-coverage.agent.ts` | Measures the proportion of endpoints with documented contracts |

## Flow
```
ApiContractInput
  → schema validation → versioning check → breaking-change detection
  → ApiContractReport { violations, coverageScore }
```

## State
`state.ts` — session phases and violation counters.

## Types
`types.ts` — `ContractViolation`, `ContractSeverity`, `ApiContractReport`.
