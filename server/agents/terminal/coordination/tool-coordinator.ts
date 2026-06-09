/**
 * server/agents/terminal/coordination/tool-coordinator.ts
 *
 * Maps high-level execution tasks to specific tool dispatches.
 * Knows which tool to call for each execution concern.
 * ALL calls go through dispatcher-client — no direct execution here.
 */

import { executeTool, type TerminalDispatchOptions } from './dispatcher-client.ts';
import type { ToolExecutionContext, ToolExecutionResult } from '../../../shared/types/execution-contracts.ts';

// ── Terminal tool name constants ──────────────────────────────────────────────
// These MUST match the names registered in terminal-tool-registry.ts exactly.

export const TERMINAL_TOOLS = {
  RUN_COMMAND:      'terminal_execute_command',
  NPM_INSTALL:      'terminal_install_package',
  NPM_RUN_SCRIPT:   'terminal_npm_run_script',
  NPM_BUILD:        'terminal_npm_build',
  NPM_TEST:         'terminal_npm_test',
  NPM_CI:           'terminal_npm_ci',
  WRITE_FILE:       'fs_write_file',
  READ_FILE:        'fs_read_file',
  PATCH_FILE:       'fs_patch_file',
  DELETE_FILE:      'fs_delete_file',
  READ_FOLDER:      'fs_read_folder',
  SEARCH_TEXT:      'fs_search_text',
  PROCESS_START:    'terminal_start_runtime',
  PROCESS_STOP:     'terminal_stop_runtime',
  PROCESS_REGISTER: 'terminal_runtime_status',
  CLEANUP_RUN:      'terminal_cleanup_run',
  RESOLVE_PORT:     'terminal_find_free_port',
  RELEASE_PORT:     'terminal_find_free_port',
  FIND_FREE_PORT:   'terminal_find_free_port',
  PORT_IN_USE:      'terminal_port_in_use',
} as const;

type ToolName = typeof TERMINAL_TOOLS[keyof typeof TERMINAL_TOOLS];

// ── Generic coordinator call ──────────────────────────────────────────────────

export async function runTool<TOutput = unknown>(
  toolName: ToolName,
  input:    Record<string, unknown>,
  context:  ToolExecutionContext,
  opts?:    TerminalDispatchOptions,
): Promise<ToolExecutionResult<TOutput>> {
  return executeTool<TOutput>(toolName, input, context, opts);
}

// ── Command coordination ──────────────────────────────────────────────────────

export async function coordinateCommand(
  command:    string,
  context:    ToolExecutionContext,
  timeoutMs?: number,
  opts?:      TerminalDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(TERMINAL_TOOLS.RUN_COMMAND, {
    command, timeoutMs,
  }, context, { timeoutMs, label: `execute_command(${command.slice(0, 40)})`, ...opts });
}

// ── NPM coordination ──────────────────────────────────────────────────────────

export async function coordinateNpmInstall(
  context:  ToolExecutionContext,
  packages: string[] = [],
  dev       = false,
  opts?:    TerminalDispatchOptions,
): Promise<ToolExecutionResult> {
  // terminal_install_package takes a single packageName; install packages one by one.
  // If no packages specified, run `npm install` to restore from package.json.
  if (packages.length === 0) {
    return runTool(TERMINAL_TOOLS.RUN_COMMAND, {
      command: 'npm install',
    }, context, { timeoutMs: 120_000, label: 'npm_install', ...opts });
  }
  // Install first package; additional packages will need separate calls.
  return runTool(TERMINAL_TOOLS.NPM_INSTALL, {
    packageName: packages[0],
    dev,
  }, context, { timeoutMs: 120_000, label: `npm_install(${packages[0]})`, ...opts });
}

export async function coordinateNpmScript(
  script:    string,
  context:   ToolExecutionContext,
  timeoutMs?: number,
  opts?:     TerminalDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(TERMINAL_TOOLS.NPM_RUN_SCRIPT, {
    script,
    timeoutMs: timeoutMs ?? 60_000,
  }, context, { timeoutMs: timeoutMs ?? 60_000, label: `npm_run(${script})`, ...opts });
}

export async function coordinateNpmBuild(
  context: ToolExecutionContext,
  opts?:   TerminalDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(TERMINAL_TOOLS.NPM_BUILD, {}, context, {
    timeoutMs: 180_000, label: 'npm_build', ...opts,
  });
}

export async function coordinateNpmTest(
  context: ToolExecutionContext,
  opts?:   TerminalDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(TERMINAL_TOOLS.NPM_TEST, {}, context, {
    timeoutMs: 120_000, label: 'npm_test', ...opts,
  });
}

// ── Process coordination ──────────────────────────────────────────────────────

export async function coordinateProcessStart(
  command:  string,
  context:  ToolExecutionContext,
  opts?:    TerminalDispatchOptions,
): Promise<ToolExecutionResult> {
  const sessionId = context.runId ?? 'agent-session';
  return runTool(TERMINAL_TOOLS.PROCESS_START, {
    sessionId,
    command,
    cwd: context.sandboxRoot,
  }, context, { label: `process_start(${command.slice(0, 30)})`, ...opts });
}

export async function coordinateProcessStop(
  _pid:    number,
  context: ToolExecutionContext,
  opts?:   TerminalDispatchOptions,
): Promise<ToolExecutionResult> {
  const sessionId = context.runId ?? 'agent-session';
  return runTool(TERMINAL_TOOLS.PROCESS_STOP, { sessionId }, context, {
    label: `process_stop(${sessionId})`, ...opts,
  });
}

export async function coordinateCleanup(
  context: ToolExecutionContext,
  opts?:   TerminalDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(TERMINAL_TOOLS.CLEANUP_RUN, {
    runId: context.runId, projectId: context.projectId,
  }, context, { label: 'cleanup_run', ...opts });
}

// ── Port coordination ─────────────────────────────────────────────────────────

export async function coordinateResolvePort(
  context:     ToolExecutionContext,
  preferred?:  number,
  opts?:       TerminalDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(TERMINAL_TOOLS.RESOLVE_PORT, {
    preferred,
  }, context, { label: 'find_free_port', ...opts });
}
