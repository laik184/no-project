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
  coordinateNpmScript,
  coordinateNpmBuild,
  coordinateNpmTest,
  coordinateProcessStart,
  coordinateResolvePort,
  TERMINAL_TOOLS,
} from './tool-coordinator.ts';
import { executeTool, resultError } from './dispatcher-client.ts';

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
      const pkgs = Array.isArray(input.packages) ? (input.packages as string[]).filter(Boolean) : [];
      const dev  = Boolean(input.dev);
      if (pkgs.length === 0 && !input.packageName) {
        const r = await executeTool(TERMINAL_TOOLS.RUN_COMMAND, { command: 'npm install', cwd: input.cwd, timeoutMs }, context, { timeoutMs: timeoutMs ?? 120_000 });
        return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
      }
      const packageName = String(input.packageName ?? pkgs[0] ?? '').trim();
      if (!packageName) return fail('npm_install requires input.packageName or input.packages');
      const r = await executeTool(TERMINAL_TOOLS.NPM_INSTALL, {
        packageName, packages: pkgs, dev, manager: input.manager, cwd: input.cwd,
      }, context, { timeoutMs: timeoutMs ?? 120_000 });
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
      const sessionId = String(input.sessionId ?? context.runId ?? '');
      if (!sessionId) return fail('process_stop requires input.sessionId');
      const r = await executeTool(TERMINAL_TOOLS.PROCESS_STOP, { sessionId, force: Boolean(input.force) }, context, { timeoutMs });
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'resolve_port': {
      const preferred = input.preferred ? Number(input.preferred) : undefined;
      const r = await coordinateResolvePort(context, preferred, { timeoutMs });
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'write_file': {
      const path = String(input.path ?? '');
      if (!path) return fail('write_file requires input.path');
      const r = await executeTool(TERMINAL_TOOLS.WRITE_FILE, { path, content: String(input.content ?? '') }, context, { timeoutMs });
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'read_file': {
      const path = String(input.path ?? '');
      if (!path) return fail('read_file requires input.path');
      const r = await executeTool(TERMINAL_TOOLS.READ_FILE, { path }, context, { timeoutMs });
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'patch_file': {
      const path = String(input.path ?? '');
      if (!path) return fail('patch_file requires input.path');
      const r = await executeTool(TERMINAL_TOOLS.PATCH_FILE, { ...input, path }, context, { timeoutMs });
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'delete_file': {
      const path = String(input.path ?? '');
      if (!path) return fail('delete_file requires input.path');
      const r = await executeTool(TERMINAL_TOOLS.DELETE_FILE, { path }, context, { timeoutMs });
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'list_directory': {
      const path = String(input.path ?? '.');
      const r = await executeTool(TERMINAL_TOOLS.READ_FOLDER, { path }, context, { timeoutMs });
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'search_files': {
      const query = String(input.query ?? input.pattern ?? '');
      if (!query) return fail('search_files requires input.query or input.pattern');
      const r = await executeTool(TERMINAL_TOOLS.SEARCH_TEXT, { query, path: input.path ?? '.' }, context, { timeoutMs });
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'validate_output':
      return fail('validate_output has no registered tool-backed side effect and cannot report success');

    case 'checkpoint':
      return fail('checkpoint has no registered persistence-backed tool and cannot report success');

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
