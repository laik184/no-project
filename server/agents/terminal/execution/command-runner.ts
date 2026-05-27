import { shellExecute }           from './shell-executor.ts';
import { validateExecutionOptions } from '../validation/execution-validator.ts';
import { validateCommandOutput }    from '../validation/output-validator.ts';
import { validateExitCode }         from '../validation/exitcode-validator.ts';
import { assertWorkspaceReady }     from '../workspace/workspace-resolver.ts';
import { publishEvent }             from '../events/event-publisher.ts';
import { runtimeLogger }            from '../telemetry/runtime-logger.ts';
import { executionTrace }           from '../telemetry/execution-trace.ts';
import { getLimitsForCommand }      from '../security/resource-limits.ts';
import type { ExecutionOptions, ExecutionResult } from '../types/execution.types.ts';

export async function runCommand(opts: ExecutionOptions): Promise<ExecutionResult> {
  const optCheck = validateExecutionOptions(opts);
  if (!optCheck.valid) {
    throw new Error(`[command-runner] Invalid options: ${optCheck.errors.join('; ')}`);
  }

  const cwd      = await assertWorkspaceReady(opts.projectId);
  const limits   = getLimitsForCommand(opts.command);
  const traceId  = executionTrace.start(opts.runId, opts.command);

  publishEvent('terminal.execution.started', {
    runId: opts.runId, command: opts.command, projectId: opts.projectId, timestamp: new Date(),
  });

  let result: ExecutionResult;
  try {
    result = await shellExecute(opts.command, cwd, opts.timeoutMs ?? limits.maxRuntimeMs);
  } catch (err: any) {
    executionTrace.end(traceId, 1);
    publishEvent('terminal.execution.failed', {
      runId: opts.runId, command: opts.command, error: err.message, timestamp: new Date(),
    });
    runtimeLogger.error(opts.runId, `[command-runner] Failed: ${err.message}`);
    throw err;
  }

  executionTrace.end(traceId, result.exitCode);

  const outputCheck = validateCommandOutput(result.exitCode, result.stdout, result.stderr);
  if (!outputCheck.valid) {
    runtimeLogger.warn(opts.runId, `[command-runner] Output validation: ${outputCheck.errors.join('; ')}`);
  }

  const exitCheck = validateExitCode(result.exitCode);
  publishEvent('terminal.execution.completed', {
    runId: opts.runId, command: opts.command,
    exitCode: result.exitCode, durationMs: result.durationMs, timestamp: new Date(),
  });

  runtimeLogger.info(opts.runId, `[command-runner] exit=${result.exitCode} dur=${result.durationMs}ms`);
  return result;
}
