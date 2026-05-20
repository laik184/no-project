import { clamp, round3 } from "./scoring.util";

export function normalizeToUnit(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return clamp(round3((value - min) / (max - min)));
}

export function normalizeLatencies(latencies: number[]): number[] {
  if (latencies.length === 0) return [];
  const min = Math.min(...latencies);
  const max = Math.max(...latencies);
  return latencies.map((l) => normalizeToUnit(l, min, max));
}

export function normalizeAccuracies(accuracies: number[]): number[] {
  if (accuracies.length === 0) return [];
  const min = Math.min(...accuracies);
  const max = Math.max(...accuracies);
  return accuracies.map((a) => normalizeToUnit(a, min, max));
}

export function normalizeGoalText(goal: string): string {
  return (goal ?? "").trim().slice(0, 1000);
}

export function normalizeContextText(context: string): string {
  return (context ?? "").trim().slice(0, 1000);
}

export function normalizeHints(hints: string[] | undefined): string[] {
  if (!Array.isArray(hints)) return [];
  return hints.map((h) => h.trim()).filter((h) => h.length > 0).slice(0, 10);
}
