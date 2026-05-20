import type { ImprovementAction, Bottleneck } from "../types";

export interface ImprovementPrioritizerOutput {
  success: boolean;
  logs: string[];
  error?: string;
  prioritizedActions?: ImprovementAction[];
}

const SEVERITY_WEIGHT: Record<Bottleneck["severity"], number> = {
  critical: 40,
  high: 25,
  medium: 12,
  low: 5,
};

function severityForArea(area: string, bottlenecks: Bottleneck[]): Bottleneck["severity"] {
  const match = bottlenecks.find((b) => b.area === area);
  return match?.severity ?? "low";
}

export function prioritizeImprovements(
  actions: ImprovementAction[],
  bottlenecks: Bottleneck[]
): ImprovementPrioritizerOutput {
  const logs: string[] = [];

  try {
    const ranked = actions.map((action) => {
      const severity = severityForArea(action.targetArea, bottlenecks);
      const severityScore = SEVERITY_WEIGHT[severity];
      const effortPenalty = Math.round(action.estimatedEffort / 10);

      const rawScore =
        action.optimizationScore * 0.5 +
        action.estimatedImpact * 0.3 +
        severityScore * 0.2 -
        effortPenalty;

      const finalScore = Math.max(0, Math.round(rawScore));

      logs.push(
        `[improvement-prioritizer] "${action.title}": opt=${action.optimizationScore} impact=${action.estimatedImpact} severity=${severity}(${severityScore}) effort_penalty=${effortPenalty} score=${finalScore}`
      );

      return { ...action, priority: finalScore };
    });

    ranked.sort((a, b) => b.priority - a.priority);

    const withRank: ImprovementAction[] = ranked.map((a, idx) => ({
      ...a,
      priority: idx + 1,
    }));

    logs.push(`[improvement-prioritizer] final ranking: ${withRank.map((a) => `"${a.title}"(rank=${a.priority})`).join(", ")}`);

    return { success: true, logs, prioritizedActions: withRank };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(`[improvement-prioritizer] ERROR: ${message}`);
    return { success: false, logs, error: message };
  }
}
