import type { Alternative, StrategyComparison } from "../types";
import { compositeScore } from "../utils/scoring.util";

export interface StrategyComparatorOutput {
  success: boolean;
  logs: string[];
  error?: string;
  comparison?: StrategyComparison;
}

export function compareStrategies(alternatives: Alternative[]): StrategyComparatorOutput {
  const logs: string[] = [];

  try {
    logs.push(`[strategy-comparator] comparing ${alternatives.length} alternative(s)`);

    if (alternatives.length === 0) {
      const comparison: StrategyComparison = {
        winnerId: "none",
        winnerTitle: "No alternatives available",
        rationale: "No alternatives were generated to compare",
        tradeoffs: [],
        scores: [],
      };
      logs.push("[strategy-comparator] no alternatives to compare");
      return { success: true, logs, comparison };
    }

    const scored = alternatives.map((alt) => {
      const composite = compositeScore(alt.speedScore, alt.riskScore, alt.efficiencyScore);
      logs.push(`[strategy-comparator] "${alt.title}": speed=${alt.speedScore} risk=${alt.riskScore} efficiency=${alt.efficiencyScore} composite=${composite}`);
      return { id: alt.id, composite };
    });

    scored.sort((a, b) => b.composite - a.composite);
    const winner = scored[0];
    const winnerAlt = alternatives.find((a) => a.id === winner.id)!;

    const tradeoffs: string[] = [];
    if (scored.length > 1) {
      const runnerUp = alternatives.find((a) => a.id === scored[1].id)!;
      if (runnerUp.speedScore > winnerAlt.speedScore) {
        tradeoffs.push(`"${runnerUp.title}" is faster but scores lower on risk and efficiency`);
      }
      if (runnerUp.riskScore < winnerAlt.riskScore) {
        tradeoffs.push(`"${runnerUp.title}" carries lower risk but sacrifices efficiency`);
      }
    }
    if (winnerAlt.speedScore < 0.65) {
      tradeoffs.push(`Winner "${winnerAlt.title}" is not the fastest — prioritizes safety and efficiency over speed`);
    }

    const rationale = `"${winnerAlt.title}" selected with composite score ${winner.composite.toFixed(3)} `
      + `(efficiency=${winnerAlt.efficiencyScore}, risk=${winnerAlt.riskScore}, speed=${winnerAlt.speedScore}). `
      + `Weighted: efficiency 40%, risk 35%, speed 25%.`;

    logs.push(`[strategy-comparator] winner: "${winnerAlt.title}" composite=${winner.composite}`);

    return {
      success: true,
      logs,
      comparison: {
        winnerId: winner.id,
        winnerTitle: winnerAlt.title,
        rationale,
        tradeoffs,
        scores: scored,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(`[strategy-comparator] ERROR: ${message}`);
    return { success: false, logs, error: message };
  }
}
