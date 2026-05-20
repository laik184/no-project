import { transitionState } from "../state.js";
import type { AgentResult, RateLimitConfig, RateLimiterState, RequestContext } from "../types.js";
import { buildError, buildLog } from "../utils/logger.util.js";
import { buildLimitConfigKey } from "../utils/key-builder.util.js";

const SOURCE = "rate-limiter-generator";

export interface GeneratorInput {
  readonly config: Readonly<RateLimitConfig>;
  readonly state: Readonly<RateLimiterState>;
}

export function registerLimiter(input: GeneratorInput): Readonly<AgentResult> {
  const { config, state } = input;

  if (!config.maxRequests || !config.windowMs) {
    const msg = "Invalid config: maxRequests and windowMs are required";
    return {
      nextState: transitionState(state, {
        appendError: buildError(SOURCE, msg),
        appendLog: buildLog(SOURCE, msg),
      }),
      output: Object.freeze({
        success: false,
        allowed: false,
        remaining: 0,
        resetTime: 0,
        logs: Object.freeze([buildLog(SOURCE, msg)]),
        error: "invalid_config",
      }),
    };
  }

  const configKey = buildLimitConfigKey(config.target, config.routeKey);
  const updatedLimits = { ...state.activeLimits, [configKey]: config };
  const log = buildLog(
    SOURCE,
    `Rate limiter registered: target=${config.target} strategy=${config.strategy} max=${config.maxRequests} window=${config.windowMs}ms key=${configKey}`,
  );

  return {
    nextState: transitionState(state, {
      status: "ACTIVE",
      activeLimits: updatedLimits,
      appendLog: log,
    }),
    output: Object.freeze({
      success: true,
      allowed: true,
      remaining: config.maxRequests,
      resetTime: Date.now() + config.windowMs,
      logs: Object.freeze([log]),
    }),
  };
}

export function resolveConfig(
  context: Readonly<RequestContext>,
  state: Readonly<RateLimiterState>,
  target: string,
): Readonly<RateLimitConfig> | null {
  const routeKey = buildLimitConfigKey(target, context.route);
  const globalKey = buildLimitConfigKey(target);
  return state.activeLimits[routeKey] ?? state.activeLimits[globalKey] ?? null;
}
