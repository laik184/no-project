import type { LimitStrategy, RateLimitConfig } from "../types.js";

const SOURCE = "limiter-strategy-selector";

export interface StrategySelection {
  readonly strategy: LimitStrategy;
  readonly reason: string;
}

export function selectStrategy(config: Readonly<RateLimitConfig>): StrategySelection {
  if (config.strategy) {
    return Object.freeze({ strategy: config.strategy, reason: "explicit_config" });
  }

  if (config.burstCapacity !== undefined || config.refillRatePerMs !== undefined) {
    return Object.freeze({ strategy: "TOKEN_BUCKET", reason: "burst_capacity_configured" });
  }

  if (config.windowMs <= 60_000) {
    return Object.freeze({ strategy: "SLIDING_WINDOW", reason: "short_window_best_fit" });
  }

  return Object.freeze({ strategy: "FIXED_WINDOW", reason: "long_window_default" });
}

export function describeStrategy(strategy: LimitStrategy): string {
  switch (strategy) {
    case "SLIDING_WINDOW":
      return "Rolling timestamp window — precise, no boundary bursts";
    case "TOKEN_BUCKET":
      return "Token bucket — burst-tolerant with steady refill rate";
    case "FIXED_WINDOW":
      return "Fixed time window — simple, low overhead, boundary burst risk";
  }
}
