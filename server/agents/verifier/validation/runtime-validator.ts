/**
 * validation/runtime-validator.ts
 * Validates runtime preconditions before phase execution.
 * Pure orchestration checks — no tool calls.
 */

import type { VerificationInput } from '../types/verifier.types.ts';

export interface RuntimeValidation {
  ready:    boolean;
  errors:   string[];
  warnings: string[];
}

const MIN_PORT = 1024;
const MAX_PORT = 65535;

export function validateRuntimePreconditions(input: VerificationInput): RuntimeValidation {
  const errors:   string[] = [];
  const warnings: string[] = [];

  const needsRuntime = input.phases.some((p) => p === 'runtime' || p === 'endpoints');

  if (needsRuntime) {
    const port = input.port ?? 3001;
    if (port < MIN_PORT || port > MAX_PORT) {
      errors.push(`Invalid port: ${port}. Must be between ${MIN_PORT} and ${MAX_PORT}`);
    }
  }

  if (input.phases.includes('endpoints')) {
    if (!input.endpoints?.length) {
      warnings.push('Endpoint phase requested but no endpoints defined');
    } else {
      for (const ep of input.endpoints) {
        if (!ep.path?.startsWith('/')) {
          errors.push(`Endpoint path must start with "/": ${ep.path}`);
        }
        if (ep.expectedStatus < 100 || ep.expectedStatus > 599) {
          errors.push(`Invalid expected status: ${ep.expectedStatus}`);
        }
      }
    }
  }

  return { ready: errors.length === 0, errors, warnings };
}

export function validateSandboxPath(sandboxRoot: string): boolean {
  return typeof sandboxRoot === 'string' && sandboxRoot.trim().length > 0 && sandboxRoot.startsWith('/');
}

export function validateRunId(runId: string): boolean {
  return typeof runId === 'string' && runId.trim().length >= 4;
}
