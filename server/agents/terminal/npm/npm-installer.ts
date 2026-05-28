/**
 * server/agents/terminal/npm/npm-installer.ts
 *
 * Agent-layer npm install orchestrator.
 * Routes through the tool dispatcher — no direct npm execution.
 *
 * Consumed by: server/agents/executor/step-runner.ts
 *   npmInstall(runId, projectId, packages, { cwd? })
 */

import { executeViaDispatcher, executeSystem } from '../coordination/dispatcher-client.ts';
import { validatePackageName }                  from '../validation/command-validator.ts';
import { deriveSandboxRoot }                    from '../core/terminal-context.ts';
import { terminalLogger }                       from '../telemetry/terminal-logger.ts';
import type { CommandResult, NpmOptions }        from '../types/terminal.types.ts';

/**
 * Install npm packages in a project sandbox via the tool dispatcher.
 * Signature matches what executor/step-runner.ts expects.
 */
export async function npmInstall(
  runId:     string,
  projectId: string,
  packages:  string[],
  opts:      NpmOptions = {},
): Promise<CommandResult> {
  const sandboxRoot = opts.cwd ?? deriveSandboxRoot(projectId);

  for (const pkg of packages) {
    const v = validatePackageName(pkg);
    if (!v.valid) {
      throw new Error(`[npm-installer] Invalid package name "${pkg}": ${v.errors.join('; ')}`);
    }
  }

  terminalLogger.info(runId, `npmInstall dispatching`, { packages, sandboxRoot });

  const response = await executeViaDispatcher<CommandResult>({
    toolName:    'npm_install',
    input:       { packages, dev: false },
    runId,
    projectId,
    sandboxRoot,
    timeoutMs:   120_000,
  });

  if (response.ok && response.data) return response.data;

  return {
    exitCode:   1,
    stdout:     '',
    stderr:     response.error ?? 'npm_install dispatch failed',
    durationMs: response.durationMs,
    success:    false,
  };
}

/**
 * Install a single package (convenience wrapper).
 */
export async function npmInstallOne(
  runId:     string,
  projectId: string,
  pkg:       string,
  dev        = false,
  opts:      NpmOptions = {},
): Promise<CommandResult> {
  const sandboxRoot = opts.cwd ?? deriveSandboxRoot(projectId);

  const response = await executeSystem<CommandResult>(
    'npm_install',
    { packages: [pkg], dev },
    sandboxRoot,
    120_000,
  );

  if (response.ok && response.data) return response.data;
  return {
    exitCode:   1,
    stdout:     '',
    stderr:     response.error ?? 'npm_install dispatch failed',
    durationMs: response.durationMs,
    success:    false,
  };
}
