import type { ImprovementAction, StrategyType } from "../types";

export interface StrategySelectorOutput {
  success: boolean;
  logs: string[];
  error?: string;
  selectedStrategy?: StrategyType;
  strategyRationale?: string;
}

const STRATEGY_PRIORITY: Record<StrategyType, number> = {
  cache: 5,
  parallelize: 4,
  "retry-tune": 3,
  optimize: 2,
  refactor: 1,
};

function strategyFrequency(actions: ImprovementAction[]): Map<StrategyType, number> {
  const freq = new Map<StrategyType, number>();
  for (const a of actions) {
    freq.set(a.strategy, (freq.get(a.strategy) ?? 0) + 1);
  }
  return freq;
}

function strategyTotalImpact(actions: ImprovementAction[]): Map<StrategyType, number> {
  const totals = new Map<StrategyType, number>();
  for (const a of actions) {
    totals.set(a.strategy, (totals.get(a.strategy) ?? 0) + a.estimatedImpact);
  }
  return totals;
}

export function selectStrategy(actions: ImprovementAction[]): StrategySelectorOutput {
  const logs: string[] = [];

  try {
    if (actions.length === 0) {
      const selected: StrategyType = "optimize";
      logs.push("[strategy-selector] no actions — defaulting to 'optimize'");
      return {
        success: true,
        logs,
        selectedStrategy: selected,
        strategyRationale: "Default: no bottlenecks detected",
      };
    }

    const freq = strategyFrequency(actions);
    const impact = strategyTotalImpact(actions);

    const strategies = [...freq.keys()];
    let best: StrategyType = strategies[0];
    let bestScore = -Infinity;

    for (const s of strategies) {
      const freqScore = (freq.get(s) ?? 0) * 10;
      const impactScore = (impact.get(s) ?? 0) * 0.5;
      const priorityScore = STRATEGY_PRIORITY[s] * 5;
      const total = freqScore + impactScore + priorityScore;

      logs.push(`[strategy-selector] ${s}: freq=${freq.get(s)} impact=${impact.get(s)} priority=${STRATEGY_PRIORITY[s]} total=${total.toFixed(1)}`);

      if (total > bestScore) {
        bestScore = total;
        best = s;
      }
    }

    const rationale = `Selected '${best}' — appears ${freq.get(best)} time(s), total impact ${impact.get(best)}, strategy priority ${STRATEGY_PRIORITY[best]}`;
    logs.push(`[strategy-selector] selected: ${best}`);

    return { success: true, logs, selectedStrategy: best, strategyRationale: rationale };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(`[strategy-selector] ERROR: ${message}`);
    return { success: false, logs, error: message };
  }
}
