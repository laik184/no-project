import { clamp } from "./clamp.util.js";

export function normalizeScore(value: number): number {
  const safeValue = Number.isFinite(value) ? value : 0;
  return clamp(safeValue, 0, 100);
}
