import type { ExperimentPlan, Variant } from "../types";
import { seededRandom, jitter, pickRandom } from "../utils/randomizer.util";
import { clamp } from "../utils/scoring.util";

export interface VariantGeneratorOutput {
  success: boolean;
  logs: string[];
  error?: string;
  variants?: Variant[];
}

const STRATEGY_TEMPLATES = [
  "greedy-fast",
  "conservative-safe",
  "balanced-hybrid",
  "aggressive-optimized",
  "exploratory-random",
] as const;

function makeVariantId(index: number, goal: string): string {
  const suffix = (goal.length % 100).toString(16).padStart(2, "0");
  return `v${index + 1}-${suffix}`;
}

export function generateVariants(plan: ExperimentPlan): VariantGeneratorOutput {
  const logs: string[] = [];
  try {
    logs.push(`[variant-generator] generating ${plan.strategyCount} variants for testType=${plan.testType}`);

    const rng = seededRandom(plan.goal);
    const count = Math.max(2, Math.min(5, plan.strategyCount));
    const variants: Variant[] = [];

    for (let i = 0; i < count; i++) {
      const strategy = plan.testType === "a-b"
        ? (i === 0 ? "control-baseline" : "treatment-alternative")
        : pickRandom([...STRATEGY_TEMPLATES], rng);

      const learningRate = jitter(0.01, 0.5, rng);
      const batchSize = Math.max(1, Math.round(jitter(32, 0.5, rng)));
      const temperature = jitter(0.7, 0.3, rng);
      const maxRetries = Math.max(1, Math.round(jitter(3, 0.3, rng)));
      const timeoutMs = Math.max(100, Math.round(jitter(2000, 0.4, rng)));
      const aggressiveness = clamp(jitter(0.5, 0.6, rng));

      const variant: Variant = {
        id: makeVariantId(i, plan.goal),
        name: `Variant-${String.fromCharCode(65 + i)}`,
        strategy,
        parameters: {
          learningRate,
          batchSize,
          temperature,
          maxRetries,
          timeoutMs,
          aggressiveness,
        },
      };

      variants.push(variant);
      logs.push(`[variant-generator] ${variant.id}/${variant.name} strategy=${strategy} lr=${learningRate} batch=${batchSize}`);
    }

    return { success: true, logs, variants };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(`[variant-generator] ERROR: ${message}`);
    return { success: false, logs, error: message };
  }
}
