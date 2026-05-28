/**
 * server/agents/terminal/coordination/execution-routing.ts
 *
 * Routes execution steps to the appropriate coordination function.
 * Pure orchestration — maps StepType → coordinator call.
 * No direct execution, no tool implementation.
 */

import type { ExecutionStep, StepOutcome } from '../types/terminal.types.ts';
import type { ToolExecutionContext }        from '../../../shared/types/execution-contracts.ts';
import {
  coordinateCommand,
  coordinateNpmInstall,
  coordinateNpmScript,
  coordinateNpmBuild,
  coordinateNpmTest,
  coordinateProcessStart,
  coordinateProcessStop,
  coordinateResolvePort,
} from './tool-coordinator.ts';
import { resultError } from './dispatcher-client.ts';

// ── Route a step to its coordinator ──────────────────────────────────────────

export async function routeStep(
  step:    ExecutionStep,
  context: ToolExecutionContext,
): Promise<Omit<StepOutcome, 'stepId' | 'durationMs' | 'attempt'>> {
  const { type, input, timeoutMs } = step;

  switch (type) {
    case 'run_command': {
      const cmd = String(input.command ?? '');
      if (!cmd) return fail('run_command requires input.command');
      const r = await coordinateCommand(cmd, context, timeoutMs);
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'npm_install': {
      const pkgs = Array.isArray(input.packages) ? (input.packages as string[]) : [];
      const dev  = Boolean(input.dev);
      const r = await coordinateNpmInstall(context, pkgs, dev, { timeoutMs });
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'npm_run': {
      const script = String(input.script ?? input.command ?? '');
      if (!script) return fail('npm_run requires input.script');
      const r = await coordinateNpmScript(script, context, timeoutMs);
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'npm_build': {
      const r = await coordinateNpmBuild(context, { timeoutMs });
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'npm_test': {
      const r = await coordinateNpmTest(context, { timeoutMs });
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'process_start': {
      const cmd = String(input.command ?? '');
      if (!cmd) return fail('process_start requires input.command');
      const r = await coordinateProcessStart(cmd, context, { timeoutMs });
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'process_stop': {
      const pid = Number(input.pid ?? 0);
      if (!pid) return fail('process_stop requires input.pid');
      const r = await coordinateProcessStop(pid, context, { timeoutMs });
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'resolve_port': {
      const preferred = input.preferred ? Number(input.preferred) : undefined;
      const r = await coordinateResolvePort(context, preferred, { timeoutMs });
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'validate_output':
      return ok(`Validated: ${String(input.description ?? step.label)}`);

    case 'checkpoint':
      return ok('Checkpoint recorded');

    default:
      return fail(`Unknown step type: ${type}`);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok(output: string, filePath?: string): { success: true; output: string; filePath?: string } {
  return filePath ? { success: true, output, filePath } : { success: true, output };
}

function fail(error: string): { success: false; error: string } {
  return { success: false, error };
}

function extractOutput(data: unknown): string {
  if (typeof data === 'string') return data.slice(0, 800);
  if (data == null) return '';
  const d = data as Record<string, unknown>;
  const out = d.stdout ?? d.output ?? d.result ?? '';
  return String(out).slice(0, 800);
}
