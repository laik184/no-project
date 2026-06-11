/**
 * server/agents/terminal/execution/step-runner.ts
 *
 * Executes ONE execution step by dispatching directly to dispatcher-client.
 * No intermediate routing layers — no execution-routing.ts, no tool-coordinator.ts.
 *
 * Execution chain: step-runner → dispatcher-client → tool-dispatcher → registry → tool
 *
 * No direct tool implementations. No shell calls. No child_process.
 * Pure orchestration: ExecutionStep → tool call → StepOutcome.
 */

import type { ExecutionStep, StepOutcome }  from '../types/terminal.types.ts';
import type { TerminalExecutionContext }     from '../core/terminal-context.ts';
import type { ToolExecutionContext }         from '../coordination/dispatcher-client.ts';
import { executeTool, resultError }          from '../coordination/dispatcher-client.ts';
import { TERMINAL_TOOLS }                   from '../coordination/tool-coordinator.ts';
import { withRetry, policyForStepType }     from './retry-manager.ts';
import { terminalLogger }                   from '../telemetry/terminal-logger.ts';
import { terminalMetrics }                  from '../telemetry/terminal-metrics.ts';
import { elapsedMs }                        from '../utils/execution-utils.ts';

// ── Step route result ─────────────────────────────────────────────────────────

type StepRouteResult =
  | { success: true;  output: string; filePath?: string }
  | { success: false; error: string };

// ── Inline routing: step.type → tool dispatch ─────────────────────────────────

async function dispatchStep(
  step:    ExecutionStep,
  toolCtx: ToolExecutionContext,
): Promise<StepRouteResult> {
  const { type, input, timeoutMs } = step;

  switch (type) {
    case 'run_command': {
      const cmd = String(input.command ?? '');
      if (!cmd) return fail('run_command requires input.command');
      const r = await executeTool(TERMINAL_TOOLS.RUN_COMMAND, {
        command: cmd, projectId: toolCtx.projectId,
        sandboxRoot: toolCtx.sandboxRoot, timeoutMs,
      }, toolCtx, { timeoutMs });
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'npm_install': {
      const pkgs = Array.isArray(input.packages) ? (input.packages as string[]).filter(Boolean) : [];
      const dev  = Boolean(input.dev);
      const manager = input.manager as string | undefined;
      const cwd = input.cwd as string | undefined;

      if (pkgs.length === 0 && !input.packageName) {
        const r = await executeTool(TERMINAL_TOOLS.RUN_COMMAND, {
          command: 'npm install', cwd, timeoutMs: timeoutMs ?? 120_000,
        }, toolCtx, { timeoutMs: timeoutMs ?? 120_000 });
        return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
      }

      const packageName = String(input.packageName ?? pkgs[0] ?? '').trim();
      if (!packageName) return fail('npm_install requires input.packageName or input.packages');
      const r = await executeTool(TERMINAL_TOOLS.NPM_INSTALL, {
        packageName, packages: pkgs, dev, manager, cwd,
      }, toolCtx, { timeoutMs: timeoutMs ?? 120_000 });
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'npm_run': {
      const script = String(input.script ?? input.command ?? '');
      if (!script) return fail('npm_run requires input.script');
      const r = await executeTool(TERMINAL_TOOLS.NPM_RUN_SCRIPT, {
        projectId: toolCtx.projectId, sandboxRoot: toolCtx.sandboxRoot, script,
      }, toolCtx, { timeoutMs: timeoutMs ?? 60_000 });
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'npm_build': {
      const r = await executeTool(TERMINAL_TOOLS.NPM_BUILD, {
        projectId: toolCtx.projectId, sandboxRoot: toolCtx.sandboxRoot,
      }, toolCtx, { timeoutMs: timeoutMs ?? 180_000 });
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'npm_test': {
      const r = await executeTool(TERMINAL_TOOLS.NPM_TEST, {
        projectId: toolCtx.projectId, sandboxRoot: toolCtx.sandboxRoot,
      }, toolCtx, { timeoutMs: timeoutMs ?? 120_000 });
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'process_start': {
      const cmd = String(input.command ?? '');
      if (!cmd) return fail('process_start requires input.command');
      const sessionId = String(input.sessionId ?? toolCtx.runId ?? 'agent-session');
      const r = await executeTool(TERMINAL_TOOLS.PROCESS_START, {
        sessionId, command: cmd, cwd: input.cwd ?? toolCtx.sandboxRoot,
      }, toolCtx, { timeoutMs });
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'process_stop': {
      const sessionId = String(input.sessionId ?? toolCtx.runId ?? '');
      if (!sessionId) return fail('process_stop requires input.sessionId');
      const r = await executeTool(TERMINAL_TOOLS.PROCESS_STOP, { sessionId, force: Boolean(input.force) }, toolCtx, { timeoutMs });
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'resolve_port': {
      const preferred = input.preferred ? Number(input.preferred) : undefined;
      const r = await executeTool(TERMINAL_TOOLS.RESOLVE_PORT, {
        runId: toolCtx.runId, projectId: toolCtx.projectId, preferred,
      }, toolCtx, { timeoutMs });
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'write_file': {
      const path = String(input.path ?? '');
      if (!path) return fail('write_file requires input.path');
      const r = await executeTool(TERMINAL_TOOLS.WRITE_FILE, { path, content: String(input.content ?? '') }, toolCtx, { timeoutMs });
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'read_file': {
      const path = String(input.path ?? '');
      if (!path) return fail('read_file requires input.path');
      const r = await executeTool(TERMINAL_TOOLS.READ_FILE, { path }, toolCtx, { timeoutMs });
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'patch_file': {
      const path = String(input.path ?? '');
      if (!path) return fail('patch_file requires input.path');
      const r = await executeTool(TERMINAL_TOOLS.PATCH_FILE, { ...input, path }, toolCtx, { timeoutMs });
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'delete_file': {
      const path = String(input.path ?? '');
      if (!path) return fail('delete_file requires input.path');
      const r = await executeTool(TERMINAL_TOOLS.DELETE_FILE, { path }, toolCtx, { timeoutMs });
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'list_directory': {
      const path = String(input.path ?? '.');
      const r = await executeTool(TERMINAL_TOOLS.READ_FOLDER, { path }, toolCtx, { timeoutMs });
      return r.ok ? ok(extractOutput(r.data)) : fail(resultError(r));
    }

    case 'search_files': {
      const query = String(input.query ?? input.pattern ?? '');
      if (!query) return fail('search_files requires input.query or input.pattern');
      const r = await executeTool(TERMINAL_TOOLS.SEARCH_TEXT, { query, path: input.path ?? '.' }, toolCtx, { timeoutMs });
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

function ok(output: string, filePath?: string): StepRouteResult {
  return filePath ? { success: true, output, filePath } : { success: true, output };
}

function fail(error: string): StepRouteResult {
  return { success: false, error };
}

function extractOutput(data: unknown): string {
  if (typeof data === 'string') return data.slice(0, 800);
  if (data == null) return '';
  const d = data as Record<string, unknown>;
  const out = d.stdout ?? d.output ?? d.result ?? '';
  return String(out).slice(0, 800);
}

// ── Public interface ──────────────────────────────────────────────────────────

export async function runStep(
  step:    ExecutionStep,
  context: TerminalExecutionContext,
): Promise<StepOutcome> {
  const startedAt = new Date();
  const policy    = policyForStepType(step.type);

  terminalLogger.step(context.runId, step.id, 'start', { type: step.type, label: step.label });

  const retryResult = await withRetry(
    () => dispatchStep(step, context.toolCtx),
    { runId: context.runId, stepId: step.id, policy },
    (r) => r.success,
  );

  const durationMs = elapsedMs(startedAt);
  const attempt    = retryResult.attempts;

  let outcome: StepOutcome;

  if (retryResult.success && retryResult.value) {
    const r = retryResult.value;
    outcome = {
      stepId:   step.id,
      success:  true,
      durationMs,
      attempt,
      output:   r.success ? r.output : undefined,
      filePath: r.success ? r.filePath : undefined,
    };
  } else {
    outcome = {
      stepId:  step.id,
      success: false,
      durationMs,
      attempt,
      error:   retryResult.lastError ?? 'Step failed',
    };
  }

  terminalMetrics.recordStep(context.runId, outcome.success, durationMs);
  terminalLogger.step(context.runId, step.id, outcome.success ? 'complete' : 'fail', {
    durationMs, attempt, error: outcome.error,
  });

  return outcome;
}
