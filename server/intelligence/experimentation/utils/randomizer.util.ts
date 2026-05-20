import { clamp, round3 } from "./scoring.util";

let seed = 0xdeadbeef;

function lcg(): number {
  seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
  return seed / 0xffffffff;
}

export function seededRandom(input: string): () => number {
  let localSeed = 0;
  for (let i = 0; i < input.length; i++) {
    localSeed = (Math.imul(31, localSeed) + input.charCodeAt(i)) >>> 0;
  }
  return () => {
    localSeed = (Math.imul(1664525, localSeed) + 1013904223) >>> 0;
    return localSeed / 0xffffffff;
  };
}

export function pickRandom<T>(items: T[], rng: () => number = lcg): T {
  if (items.length === 0) throw new Error("pickRandom: empty array");
  return items[Math.floor(rng() * items.length)]!;
}

export function jitter(base: number, maxPct: number, rng: () => number = lcg): number {
  const factor = 1 + (rng() * 2 - 1) * maxPct;
  return round3(clamp(base * factor));
}

export function generateLatencyMs(baseMs: number, rng: () => number = lcg): number {
  const noise = (rng() * 2 - 1) * baseMs * 0.3;
  return Math.max(1, Math.round(baseMs + noise));
}

export function generateAccuracy(base: number, rng: () => number = lcg): number {
  const noise = (rng() * 2 - 1) * 0.1;
  return round3(clamp(base + noise));
}

export function bernoulli(probability: number, rng: () => number = lcg): boolean {
  return rng() < clamp(probability);
}
