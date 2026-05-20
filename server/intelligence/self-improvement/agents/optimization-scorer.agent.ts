import type { ImprovementAction, StrategyType } from "../types";
import { impactEffortScore, boostScore } from "../utils/scoring.util";

export interface OptimizationScorerOutput {
  success: boolean;
  logs: string[];
  error?: string;
  scoredActions?: ImprovementAction[];
}

const STRATEGY_BOOST: Record<StrategyType, number> = {
  cache: 8,
  parallelize: 6,
  "retry-tune": 5,
  optimize: 4,
  refactor: 2,
};

export function scoreOptimizations(
  actions: ImprovementAction[],
  selectedStrategy: StrategyType
): OptimizationScorerOutput {
  const logs: string[] = [];

  try {
    const scored: ImprovementAction[] = actions.map((action) => {
      let baseScore = impactEffortScore(action.estimatedImpact, action.estimatedEffort);

      const strategyBoost = action.strategy === selectedStrategy
        ? STRATEGY_BOOST[action.strategy]
        : 0;

      const highImpactBoost = action.estimatedImpact >= 70 ? 5 : 0;
      const lowEffortBoost = action.estimatedEffort <= 25 ? 4 : 0;

      const finalScore = boostScore(baseScore, strategyBoost + highImpactBoost + lowEffortBoost, 1);

      logs.push(
        `[optimization-scorer] "${action.title}": base=${baseScore} strategy_boost=${strategyBoost} impact_boost=${highImpactBoost} effort_boost=${lowEffortBoost} final=${finalScore}`
      );

      return { ...action, optimizationScore: finalScore };
    });

    logs.push(`[optimization-scorer] scored ${scored.length} action(s), strategy=${selectedStrategy}`);
    return { success: true, logs, scoredActions: scored };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(`[optimization-scorer] ERROR: ${message}`);
    return { success: false, logs, error: message };
  }
}
