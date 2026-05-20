# Agents Folder

## Purpose
Contains L2 agents for test-ops. Each agent owns exactly one part of the pipeline.

## Call Graph
`orchestrator.ts` calls:
- `test-runner.agent.ts`
- `test-discovery.agent.ts`
- `test-executor.agent.ts`
- `result-parser.agent.ts`
- `coverage-analyzer.agent.ts`
- `failure-analyzer.agent.ts`

## Import Rule
Agents do not import other agents. Agents may import only `../utils/*` and `../types`.
