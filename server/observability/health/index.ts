import {
  runFullHealthCheck,
  runLivenessOrchestrator,
  runReadinessOrchestrator,
  buildHealthEndpointResponse,
  buildLivenessEndpointResponse,
  buildReadinessEndpointResponse,
} from "./orchestrator.js";
import { INITIAL_STATE } from "./state.js";
import type {
  AgentResult,
  DependencyChecker,
  HealthResponse,
  HealthState,
} from "./types.js";

let _state: Readonly<HealthState> = INITIAL_STATE;

export async function getHealth(options?: {
  readonly dependencies?: readonly DependencyChecker[];
  readonly isInitialized?: boolean;
  readonly configLoaded?: boolean;
  readonly timeoutMs?: number;
}): Promise<Readonly<AgentResult>> {
  const result = await runFullHealthCheck(options ?? {}, _state);
  _state = result.nextState;
  return result;
}

export async function getReadiness(options?: {
  readonly isInitialized?: boolean;
  readonly configLoaded?: boolean;
  readonly dependencies?: readonly DependencyChecker[];
  readonly timeoutMs?: number;
}): Promise<Readonly<AgentResult>> {
  const result = await runReadinessOrchestrator(options ?? {}, _state);
  _state = result.nextState;
  return result;
}

export async function getLiveness(): Promise<Readonly<AgentResult>> {
  const result = await runLivenessOrchestrator(_state);
  _state = result.nextState;
  return result;
}

export function getState(): Readonly<HealthState> {
  return _state;
}

export function resetState(): void {
  _state = INITIAL_STATE;
}

export {
  buildHealthEndpointResponse,
  buildLivenessEndpointResponse,
  buildReadinessEndpointResponse,
} from "./orchestrator.js";

export {
  runFullHealthCheck,
  runLivenessOrchestrator,
  runReadinessOrchestrator,
} from "./orchestrator.js";

export { INITIAL_STATE, transitionState } from "./state.js";

export type {
  AgentResult,
  CheckResult,
  CheckStatus,
  DependencyChecker,
  DependencyStatus,
  HealthResponse,
  HealthState,
  HealthStateStatus,
  HealthStatus,
  LivenessResult,
  ReadinessResult,
  StatePatch,
} from "./types.js";
