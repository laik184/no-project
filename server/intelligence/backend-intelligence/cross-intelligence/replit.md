# cross-intelligence

## Purpose
Synthesizes signals from multiple intelligence domains (quality, consistency, context, recommendation) into unified insights and correlation reports.

## Orchestrator
`orchestrator.ts` — `CrossIntelligenceOrchestrator` class; runs correlation, insight synthesis, and multi-signal analysis in sequence.

## Agents
| Agent | Responsibility |
|---|---|
| `correlation.engine.agent.ts` | Finds statistical and structural correlations across intelligence signals |
| `insight.synthesizer.agent.ts` | Condenses correlated signals into actionable insights |
| `multi-signal.analyzer.agent.ts` | Runs cross-domain analysis across all input signal categories |

## Flow
```
CrossIntelligenceInput
  → CorrelationEngineAgent.correlate()
  → InsightSynthesizerAgent.synthesize()
  → MultiSignalAnalyzerAgent.analyze()
  → CrossIntelligenceOutput { insights, report }
```

## State
`state.ts` — session lifecycle (sessionId, status, logs).

## Types
`types.ts` — `CrossIntelligenceInput`, `CrossIntelligenceOutput`, signal interfaces.

## Utils
`utils/logger.util.ts` — re-exports shared logger helpers (`pushLog`, `pushError`, `pushWarn`).
