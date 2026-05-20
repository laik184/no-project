import { PriorityItem, TaskInput, ConflictResolution } from "../types";
import { clamp } from "../utils/normalize.util";

const TIE_SCORE_TOLERANCE = 1;

export function resolveConflicts(
  priorities: readonly PriorityItem[],
  tasks: readonly TaskInput[]
): readonly PriorityItem[] {
  const taskMeta = new Map(tasks.map((t) => [t.id, t]));
  const resolutions = applyTieBreaks(priorities, taskMeta);

  const resolvedMap = new Map(resolutions.map((r) => [r.taskId, r]));

  return Object.freeze(
    priorities.map((p) => {
      const resolution = resolvedMap.get(p.taskId);
      if (!resolution || !resolution.tieBreakApplied) return p;
      return Object.freeze({
        ...p,
        score: resolution.adjustedScore,
        reason: `${p.reason} | Tie-break: ${resolution.reason}`,
      });
    })
  );
}

function applyTieBreaks(
  priorities: readonly PriorityItem[],
  taskMeta: Map<string, TaskInput>
): ConflictResolution[] {
  const groups = groupByScore(priorities);
  const resolutions: ConflictResolution[] = [];

  for (const group of groups.values()) {
    if (group.length <= 1) {
      resolutions.push(
        Object.freeze({ taskId: group[0].taskId, adjustedScore: group[0].score, tieBreakApplied: false, reason: "" })
      );
      continue;
    }

    const tieBreaks = group.map((item) => {
      const meta = taskMeta.get(item.taskId);
      const score = computeTieBreakScore(item, meta);
      return { item, score };
    });

    tieBreaks.sort((a, b) => b.score - a.score);

    for (let i = 0; i < tieBreaks.length; i++) {
      const { item } = tieBreaks[i];
      const adjustment = (tieBreaks.length - 1 - i) * 0.5;
      resolutions.push(
        Object.freeze({
          taskId: item.taskId,
          adjustedScore: clamp(item.score + adjustment),
          tieBreakApplied: adjustment !== 0,
          reason: adjustment !== 0
            ? `Tie-break position ${i + 1} of ${tieBreaks.length} — adjusted +${adjustment}`
            : "Tie-break applied, no score change needed.",
        })
      );
    }
  }

  return resolutions;
}

function groupByScore(priorities: readonly PriorityItem[]): Map<number, PriorityItem[]> {
  const groups = new Map<number, PriorityItem[]>();
  for (const p of priorities) {
    const bucket = Math.round(p.score / TIE_SCORE_TOLERANCE) * TIE_SCORE_TOLERANCE;
    const existing = groups.get(bucket) ?? [];
    groups.set(bucket, [...existing, p]);
  }
  return groups;
}

function computeTieBreakScore(item: PriorityItem, meta?: TaskInput): number {
  let score = 0;
  if (!meta) return score;
  if (meta.systemCritical) score += 10;
  if (meta.userFacing)     score += 7;
  if (meta.deadline)       score += 5;
  const depCount = (meta.dependencies ?? []).length;
  score -= depCount * 2;
  score += Math.min((meta.tags?.length ?? 0), 5);
  return score;
}
