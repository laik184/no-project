/**
 * server/agents/terminal/coordination/tool-coordinator.ts
 *
 * Maps execution step types to registered tool names and coordinates
 * the execution flow through the dispatcher client.
 * No direct tool execution — all calls go through executeViaDispatcher.
 */

import { executeViaDispatcher, executeSystem } from './dispatcher-client.ts';
import type { RoutingDecision, CommandResult, DispatchResponse } from '../types/terminal.types.ts';
import { terminalLogger } from '../telemetry/terminal-logger.ts';

/** Tool name registry for the terminal domain. */
const TOOL_MAP: Record<string, string> = {
  run_command:      'run_command',
  npm_install:      'npm_install',
  npm_run_script:   'npm_run_script',
  npm_build:        'npm_build',
  npm_test:         'npm_test',
  npm_ci:           'npm_ci',
  process_start:    'process_start',
  process_stop:     'process_stop',
  process_watch:    'process_watch',
  find_free_port:   'find_free_port',
  port_in_use:      'port_in_use',
  scan_port_range:  'scan_port_range',
};

export function resolveToolName(stepType: string): string | undefined {
  return TOOL_MAP[stepType];
}

/** Execute a command through the coordinator. */
export async function coordinateCommand(
  runId:       string,
  projectId:   string,
  sandboxRoot: string,
  decision:    RoutingDecision,
): Promise<DispatchResponse<CommandResult>> {
  terminalLogger.debug(runId, `coordinate → ${decision.toolName}`);

  return executeViaDispatcher<CommandResult>({
    toolName:    decision.toolName,
    input:       decision.input,
    runId,
    projectId,
    sandboxRoot,
    timeoutMs:   decision.timeoutMs,
  });
}

/** Execute a terminal tool as a system call (no full session context). */
export async function coordinateSystem<T = unknown>(
  toolName:    string,
  input:       Record<string, unknown>,
  sandboxRoot?: string,
  timeoutMs?:  number,
): Promise<DispatchResponse<T>> {
  return executeSystem<T>(toolName, input, sandboxRoot, timeoutMs);
}
