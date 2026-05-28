/**
 * planning/runtime-plan.ts
 * Produces ExecutionSteps for runtime and endpoint phases.
 */

import type { VerificationPhase, VerificationInput, EndpointSpec } from '../types/verifier.types.ts';
import type { ExecutionStep } from '../types/execution.types.ts';
import { makeStep, estimateTimeoutMs } from '../utils/planning-utils.ts';
import { VERIFIER_TOOLS } from '../coordination/tool-coordinator.ts';
import { randomUUID } from 'node:crypto';

const DEFAULT_PORT = 3001;

export function runtimePhasePlan(
  phase: VerificationPhase,
  input: VerificationInput,
): ExecutionStep[] {
  const port = input.port ?? DEFAULT_PORT;
  const base = { projectId: input.projectId, sandboxRoot: input.sandboxRoot, port };

  switch (phase) {
    case 'runtime':
      return runtimeSteps(base);

    case 'endpoints':
      return endpointSteps(base, input.endpoints ?? []);

    default:
      return [];
  }
}

function runtimeSteps(base: Record<string, unknown>): ExecutionStep[] {
  return [
    makeStep('runtime', VERIFIER_TOOLS.SERVER_HEALTH, base, {
      required:  true,
      timeoutMs: estimateTimeoutMs('runtime'),
      retry:     { maxAttempts: 3, delayMs: 2000, backoff: 'linear' },
    }),
    makeStep('runtime', VERIFIER_TOOLS.RUNTIME_VALIDATE, base, {
      required:  false,
      timeoutMs: 15_000,
    }),
    makeStep('runtime', VERIFIER_TOOLS.CRASH_DETECT, base, {
      required:  false,
      timeoutMs: 10_000,
    }),
  ];
}

function endpointSteps(
  base:      Record<string, unknown>,
  endpoints: EndpointSpec[],
): ExecutionStep[] {
  if (!endpoints.length) return [];

  return endpoints.map((ep) => ({
    id:       randomUUID(),
    phase:    'endpoints' as VerificationPhase,
    toolName: VERIFIER_TOOLS.ENDPOINT_VALIDATE,
    input:    {
      ...base,
      path:           ep.path,
      method:         ep.method,
      expectedStatus: ep.expectedStatus,
      body:           ep.body,
      headers:        ep.headers,
    },
    required:    false,
    timeoutMs:   15_000,
    retryPolicy: { maxAttempts: 2, delayMs: 1000, backoff: 'linear' as const },
  }));
}
