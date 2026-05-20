# database-schema-analysis

## Purpose
Analyses database schema definitions for normalization issues, missing indexes, type mismatches, and relation integrity problems.

## Orchestrator
`orchestrator.ts` — coordinates schema analysis agents and returns a `DatabaseSchemaReport`.

## Agents
| Agent | Responsibility |
|---|---|
| `normalization.agent.ts` | Checks for 1NF/2NF/3NF violations and data redundancy |
| `index-coverage.agent.ts` | Identifies columns used in queries that lack indexes |
| `type-consistency.agent.ts` | Flags mismatched column types across relations |
| `relation-integrity.agent.ts` | Validates foreign key constraints and cascade rules |

## Flow
```
DatabaseSchemaInput
  → normalization → index-coverage → type-consistency → relation-integrity
  → DatabaseSchemaReport { issues, recommendations }
```

## State
`state.ts` — session phases and issue accumulation.

## Types
`types.ts` — `SchemaIssueType`, `SchemaSeverity`, `DatabaseSchemaReport`.
