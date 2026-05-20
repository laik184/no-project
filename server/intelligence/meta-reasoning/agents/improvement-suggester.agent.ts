import type { DetectedFlaw, StrategyComparison, Alternative } from "../types";
import { normalizeSuggestion } from "../utils/normalize.util";

export interface ImprovementSuggesterOutput {
  success: boolean;
  logs: string[];
  error?: string;
  improvement?: string;
}

function buildFlawSummary(flaws: DetectedFlaw[]): string {
  if (flaws.length === 0) return "";
  const highFlaws = flaws.filter((f) => f.severity === "high");
  if (highFlaws.length > 0) {
    return `Address critical flaws first: ${highFlaws.map((f) => f.type.replace(/-/g, " ")).join(", ")}. `;
  }
  return `Resolve ${flaws.length} detected flaw(s): ${flaws.map((f) => f.type.replace(/-/g, " ")).join(", ")}. `;
}

function buildStrategyAdvice(comparison: StrategyComparison, alternatives: Alternative[]): string {
  if (comparison.winnerId === "none") return "Apply a conservative incremental strategy. ";
  const winner = alternatives.find((a) => a.id === comparison.winnerId);
  if (!winner) return `Adopt the "${comparison.winnerTitle}" approach. `;
  return `Adopt the "${winner.title}" approach: ${winner.approach} `;
}

function buildTradeoffNote(comparison: StrategyComparison): string {
  if (comparison.tradeoffs.length === 0) return "";
  return `Note tradeoff: ${comparison.tradeoffs[0]}`;
}

export function suggestImprovement(
  flaws: DetectedFlaw[],
  comparison: StrategyComparison,
  alternatives: Alternative[]
): ImprovementSuggesterOutput {
  const logs: string[] = [];

  try {
    logs.push(`[improvement-suggester] synthesizing improvement from ${flaws.length} flaw(s) and ${alternatives.length} alternative(s)`);

    const parts = [
      buildFlawSummary(flaws),
      buildStrategyAdvice(comparison, alternatives),
      buildTradeoffNote(comparison),
    ].filter((p) => p.trim().length > 0);

    const raw = parts.join("").trim();
    const improvement = normalizeSuggestion(raw);

    logs.push(`[improvement-suggester] suggestion: "${improvement.slice(0, 100)}${improvement.length > 100 ? "..." : ""}"`);
    return { success: true, logs, improvement };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(`[improvement-suggester] ERROR: ${message}`);
    return { success: false, logs, error: message };
  }
}
