# security-analysis

## Purpose
Performs static security analysis covering injection vulnerabilities, authentication gaps, insecure dependencies, and sensitive data exposure.

## Orchestrator
`orchestrator.ts` — orchestrates security scanning agents and returns a `SecurityReport`.

## Agents
| Agent | Responsibility |
|---|---|
| `injection-scanner.agent.ts` | Detects SQL, command, and template injection vectors |
| `auth-gap.agent.ts` | Identifies routes and handlers lacking authentication guards |
| `dependency-audit.agent.ts` | Flags packages with known CVEs |
| `data-exposure.agent.ts` | Finds sensitive fields (passwords, tokens) that may leak |

## Flow
```
SecurityInput
  → injection scanning → auth gaps → dependency audit → data exposure
  → SecurityReport { findings, riskLevel, recommendations }
```

## State
`state.ts` — session lifecycle and per-finding counters (critical, high, medium, low).

## Types
`types.ts` — `SecurityFinding`, `SecuritySeverity`, `SecurityReport`.
