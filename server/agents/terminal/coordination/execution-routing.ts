/**
 * server/agents/terminal/coordination/execution-routing.ts
 *
 * Routes execution steps to the correct tool via the coordinator.
 * Determines tool name, builds input payload, and sets timeouts.
 */

import type { ExecutionStep, RoutingDecision } from '../types/terminal.types.ts';

const DEFAULT_TIMEOUT_MS = 30_000;
const NPM_TIMEOUT_MS     = 120_000;
const SCRIPT_TIMEOUT_MS  = 60_000;

/**
 * Produce a RoutingDecision from an ExecutionStep.
 * Returns null if the step type has no tool mapping.
 */
export function routeStep(step: ExecutionStep): RoutingDecision | null {
  const { type, input, timeoutMs } = step;

  switch (type) {
    case 'run_command': {
      if (!input.command) return null;
      return {
        toolName:  'run_command',
        input:     { command: input.command, env: input.env },
        timeoutMs: timeoutMs ?? DEFAULT_TIMEOUT_MS,
      };
    }

    case 'npm_install': {
      return {
        toolName:  'npm_install',
        input:     { packages: input.packages ?? [], dev: input.dev ?? false },
        timeoutMs: NPM_TIMEOUT_MS,
      };
    }

    case 'npm_run_script': {
      if (!input.script) return null;
      return {
        toolName:  'npm_run_script',
        input:     { script: input.script },
        timeoutMs: timeoutMs ?? SCRIPT_TIMEOUT_MS,
      };
    }

    case 'npm_build': {
      return {
        toolName:  'npm_run_script',
        input:     { script: 'build' },
        timeoutMs: NPM_TIMEOUT_MS,
      };
    }

    case 'npm_test': {
      return {
        toolName:  'npm_run_script',
        input:     { script: input.script ?? 'test' },
        timeoutMs: timeoutMs ?? SCRIPT_TIMEOUT_MS,
      };
    }

    case 'find_free_port': {
      return {
        toolName:  'find_free_port',
        input:     { hint: input.hint },
        timeoutMs: DEFAULT_TIMEOUT_MS,
      };
    }

    case 'port_in_use': {
      if (!input.port) return null;
      return {
        toolName:  'port_in_use',
        input:     { port: input.port },
        timeoutMs: DEFAULT_TIMEOUT_MS,
      };
    }

    default:
      return null;
  }
}
