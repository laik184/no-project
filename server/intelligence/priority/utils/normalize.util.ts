export function normalizeToRange(value: number, min: number, max: number): number {
  if (max === min) return 50;
  const normalized = ((value - min) / (max - min)) * 100;
  return Math.min(Math.max(Math.round(normalized * 100) / 100, 0), 100);
}

export function normalizeScores(
  scores: ReadonlyArray<{ taskId: string; raw: number }>
): ReadonlyArray<{ taskId: string; normalized: number }> {
  if (scores.length === 0) return [];

  const values = scores.map((s) => s.raw);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return scores.map((s) => ({
    taskId: s.taskId,
    normalized: normalizeToRange(s.raw, min, max),
  }));
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(Math.max(value, min), max);
}

export function scaleToHundred(value: number, maxValue: number): number {
  if (maxValue === 0) return 0;
  return clamp(Math.round((value / maxValue) * 100));
}
