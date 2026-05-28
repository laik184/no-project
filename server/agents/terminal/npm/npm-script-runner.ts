/**
 * server/agents/terminal/npm/npm-script-runner.ts
 *
 * Agent-layer npm script runner.
 * Routes through the tool dispatcher — no direct npm execution.
 *
 * Consumed by: server/agents/executor/step-runner.ts
 *   npmRunScript(runId, projectId, script, { cwd?, timeoutMs? })
 */

import { executeViaDispatcher } from '../coordination/dispatcher-client.ts';
import { deriveSandboxRoot }    from '../core/terminal-context.ts';
import { terminalLogger }       from '../telemetry/terminal-logger.ts';
import type { CommandResult, NpmOptions } from '../types/terminal.types.ts';

const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Run an npm script in a project sandbox via the tool dispatcher.
 * Signature matches what executor/step-runner.ts expects.
 */
export async function npmRunScript(
  runId:     string,
  projectId: string,
  script:    string,
  opts:      NpmOptions = {},
): Promise<CommandResult> {
  const sandboxRoot = opts.cwd ?? deriveSandboxRoot(projectId);
  const timeoutMs   = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!script || !script.trim()) {
    throw new Error('[npm-script-runner] script name is required');
  }

  terminalLogger.info(runId, `npmRunScript dispatching`, { script, sandboxRoot });

  const response = await executeViaDispatcher<CommandResult>({
    toolName:    'npm_run_script',
    input:       { script },
    runId,
    projectId,
    sandboxRoot,
    timeoutMs,
  });

  if (response.ok && response.data) return response.data;

  return {
    exitCode:   1,
    stdout:     '',
    stderr:     response.error ?? 'npm_run_script dispatch failed',
    durationMs: response.durationMs,
    success:    false,
  };
}
