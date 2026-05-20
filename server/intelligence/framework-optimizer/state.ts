import type { FrameworkOptimizerState } from "./types.js";
import { deepFreeze } from "./utils/deep-freeze.util.js";

export function createFrameworkOptimizerState(input: FrameworkOptimizerState): FrameworkOptimizerState {
  return deepFreeze({
    framework: input.framework,
    metrics: {
      performanceScore: input.metrics.performanceScore,
      bottlenecks: [...input.metrics.bottlenecks],
      suggestions: [...input.metrics.suggestions],
    },
    timestamp: input.timestamp,
  });
}
