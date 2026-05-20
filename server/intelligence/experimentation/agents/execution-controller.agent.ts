import type { Variant } from "../types";
import { seededRandom, generateLatencyMs, generateAccuracy, bernoulli } from "../utils/randomizer.util";
import { clamp, round3 } from "../utils/scoring.util";

export interface RawExecutionResult {
  variantId: string;
  success: boolean;
  latencyMs: number;
  accuracyScore: number;
  rawScore: number;
}

export interface ExecutionControllerOutput {
  success: boolean;
  logs: string[];
  error?: string;
  rawResults?: RawExecutionResult[];
}

const STRATEGY_BASE: Record<string, { latency: number; accuracy: number; successRate: number }> = {
  "control-baseline":      { latency: 1800, accuracy: 0.72, successRate: 0.85 },
  "treatment-alternative": { latency: 1200, accuracy: 0.78, successRate: 0.80 },
  "greedy-fast":           { latency: 700,  accuracy: 0.65, successRate: 0.75 },
  "conservative-safe":     { latency: 2500, accuracy: 0.88, successRate: 0.95 },
  "balanced-hybrid":       { latency: 1400, accuracy: 0.80, successRate: 0.88 },
  "aggressive-optimized":  { latency: 900,  accuracy: 0.74, successRate: 0.72 },
  "exploratory-random":    { latency: 1600, accuracy: 0.70, successRate: 0.78 },
};

const DEFAULT_BASE = { latency: 1500, accuracy: 0.75, successRate: 0.82 };

export function executeVariants(variants: Variant[]): ExecutionControllerOutput {
  const logs: string[] = [];
  try {
    logs.push(`[execution-controller] simulating ${variants.length} variant(s)`);

    const rawResults: RawExecutionResult[] = variants.map((v) => {
      const rng = seededRandom(`${v.id}-${v.strategy}`);
      const base = STRATEGY_BASE[v.strategy] ?? DEFAULT_BASE;

      const aggressiveness = typeof v.parameters.aggressiveness === "number"
        ? clamp(v.parameters.aggressiveness)
        : 0.5;

      const adjustedLatency = base.latency * (1 - aggressiveness * 0.2);
      const adjustedAccuracy = base.accuracy + aggressiveness * 0.05;
      const adjustedSuccessRate = base.successRate - aggressiveness * 0.05;

      const latencyMs = generateLatencyMs(adjustedLatency, rng);
      const accuracyScore = generateAccuracy(adjustedAccuracy, rng);
      const success = bernoulli(adjustedSuccessRate, rng);
      const rawScore = round3(
        clamp(accuracyScore * (success ? 1.0 : 0.4) * (1 - latencyMs / 10000))
      );

      logs.push(
        `[execution-controller] ${v.id}: success=${success} latency=${latencyMs}ms accuracy=${accuracyScore} raw=${rawScore}`
      );

      return { variantId: v.id, success, latencyMs, accuracyScore, rawScore };
    });

    return { success: true, logs, rawResults };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(`[execution-controller] ERROR: ${message}`);
    return { success: false, logs, error: message };
  }
}
