/**
 * server/agents/terminal/execution/command-runner.ts
 *
 * Agent-layer command runner.
 * Routes through the tool dispatcher — no direct shell execution.
 *
 * Consumed by: server/agents/executor/step-runner.ts
 */

import { coordinateSystem }   from '../coordination/tool-coordinator.ts';
import { validateCommand }    from '../validation/command-validator.ts';
import type { CommandResult, CommandRunOptions } from '../types/terminal.types.ts';

/**
 * Execute a shell command via the centralized tool dispatcher.
 * Validates the command first; throws on policy violation.
 */
export async function runCommand(opts: CommandRunOptions): Promise<CommandResult> {
  const { command, cwd, timeoutMs = 30_000, env } = opts;

  const validation = validateCommand(command);
  if (!validation.valid) {
    throw new Error(`[command-runner] Command rejected: ${validation.errors.join('; ')}`);
  }

  const response = await coordinateSystem<CommandResult>(
    'run_command',
    { command, cwd, timeoutMs, env },
    cwd,
    timeoutMs,
  );

  if (response.ok && response.data) {
    return response.data;
  }

  // Construct a synthetic failure result so callers get consistent types.
  return {
    exitCode:   1,
    stdout:     '',
    stderr:     response.error ?? 'dispatch failed',
    durationMs: response.durationMs,
    success:    false,
  };
}
