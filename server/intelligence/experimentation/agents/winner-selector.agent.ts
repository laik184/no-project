import type { Variant, ComparisonResult, WinnerResult } from "../types";

export interface WinnerSelectorOutput {
  success: boolean;
  logs: string[];
  error?: string;
  winner?: WinnerResult;
}

function buildRationale(
  winner: Variant,
  best: ComparisonResult,
  runnerUp: ComparisonResult | undefined
): string {
  const parts: string[] = [
    `"${winner.name}" (${winner.strategy}) selected with composite score ${best.compositeScore.toFixed(3)}.`,
    `Speed=${best.speedScore.toFixed(3)}, Accuracy=${best.accuracyScore.toFixed(3)}, SuccessRate=${best.successRateScore.toFixed(3)}.`,
  ];
  if (runnerUp) {
    const margin = (best.compositeScore - runnerUp.compositeScore).toFixed(3);
    parts.push(`Margin over runner-up: ${margin}.`);
  }
  return parts.join(" ");
}

export function selectWinner(
  comparisons: ComparisonResult[],
  variants: Variant[]
): WinnerSelectorOutput {
  const logs: string[] = [];
  try {
    logs.push(`[winner-selector] selecting from ${comparisons.length} comparison(s)`);

    if (comparisons.length === 0) {
      return { success: false, logs, error: "no comparisons available to select winner" };
    }

    const sorted = [...comparisons].sort((a, b) => b.compositeScore - a.compositeScore);
    const best = sorted[0]!;
    const runnerUp = sorted[1];

    const winnerVariant = variants.find((v) => v.id === best.variantId);
    if (!winnerVariant) {
      return { success: false, logs, error: `winner variant id=${best.variantId} not found in variants list` };
    }

    const rationale = buildRationale(winnerVariant, best, runnerUp);
    logs.push(`[winner-selector] winner=${winnerVariant.name} score=${best.compositeScore}`);

    return {
      success: true,
      logs,
      winner: { variant: winnerVariant, comparisonResult: best, rationale },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(`[winner-selector] ERROR: ${message}`);
    return { success: false, logs, error: message };
  }
}
