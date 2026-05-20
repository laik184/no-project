export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeToUnit(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return clamp((value - min) / (max - min));
}

export function normalizePercent(value: number): number {
  return clamp(value / 100);
}

export function invertUnit(value: number): number {
  return clamp(1 - clamp(value));
}

export function normalizeLatency(latencyMs: number): number {
  if (latencyMs <= 50) return 1;
  if (latencyMs >= 5000) return 0;
  return clamp(1 - (latencyMs - 50) / (5000 - 50));
}

export function normalizeErrorRate(rate: number): number {
  if (rate <= 0) return 1;
  if (rate >= 1) return 0;
  return clamp(1 - rate);
}

export function normalizeMemory(usageMb: number, maxMb = 2048): number {
  if (usageMb <= 0) return 1;
  if (usageMb >= maxMb) return 0;
  return clamp(1 - usageMb / maxMb);
}

export function normalizeCpu(percent: number): number {
  if (percent <= 0) return 1;
  if (percent >= 100) return 0;
  return clamp(1 - percent / 100);
}

export function scaleTo100(unitValue: number): number {
  return Math.round(clamp(unitValue) * 100);
}
