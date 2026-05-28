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

export const TERMINAL_TOOLS = {
  RUN_COMMAND:      'run_command',
  NPM_INSTALL:      'npm_install',
  NPM_RUN_SCRIPT:   'npm_run_script',
  NPM_BUILD:        'npm_build',
  NPM_TEST:         'npm_test',
  NPM_CI:           'npm_ci',
  WRITE_FILE:       'fs_write_file',
  READ_FILE:        'fs_read_file',
  PATCH_FILE:       'fs_patch_file',
  DELETE_FILE:      'fs_delete_file',
  READ_FOLDER:      'fs_read_folder',
  SEARCH_TEXT:      'fs_search_text',
  PROCESS_START:    'process_start',
  PROCESS_STOP:     'process_stop',
  PROCESS_REGISTER: 'process_register',
  CLEANUP_RUN:      'cleanup_run',
  RESOLVE_PORT:     'resolve_port',
  RELEASE_PORT:     'release_port',
  FIND_FREE_PORT:   'find_free_port',
  PORT_IN_USE:      'port_in_use',
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
    command, projectId: context.projectId, sandboxRoot: context.sandboxRoot, timeoutMs,
  }, context, { timeoutMs, label: `run_command(${command.slice(0, 40)})`, ...opts });
}

// ── NPM coordination ──────────────────────────────────────────────────────────

export async function coordinateNpmInstall(
  context:  ToolExecutionContext,
  packages: string[] = [],
  dev       = false,
  opts?:    TerminalDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(TERMINAL_TOOLS.NPM_INSTALL, {
    projectId: context.projectId, sandboxRoot: context.sandboxRoot, packages, dev,
  }, context, { timeoutMs: 120_000, label: 'npm_install', ...opts });
}

export async function coordinateNpmScript(
  script:    string,
  context:   ToolExecutionContext,
  timeoutMs?: number,
  opts?:     TerminalDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(TERMINAL_TOOLS.NPM_RUN_SCRIPT, {
    projectId: context.projectId, sandboxRoot: context.sandboxRoot, script,
  }, context, { timeoutMs: timeoutMs ?? 60_000, label: `npm_run(${script})`, ...opts });
}

export async function coordinateNpmBuild(
  context: ToolExecutionContext,
  opts?:   TerminalDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(TERMINAL_TOOLS.NPM_BUILD, {
    projectId: context.projectId, sandboxRoot: context.sandboxRoot,
  }, context, { timeoutMs: 180_000, label: 'npm_build', ...opts });
}

export async function coordinateNpmTest(
  context: ToolExecutionContext,
  opts?:   TerminalDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(TERMINAL_TOOLS.NPM_TEST, {
    projectId: context.projectId, sandboxRoot: context.sandboxRoot,
  }, context, { timeoutMs: 120_000, label: 'npm_test', ...opts });
}

// ── Process coordination ──────────────────────────────────────────────────────

export async function coordinateProcessStart(
  command:  string,
  context:  ToolExecutionContext,
  opts?:    TerminalDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(TERMINAL_TOOLS.PROCESS_START, {
    command, projectId: context.projectId, sandboxRoot: context.sandboxRoot,
  }, context, { label: `process_start(${command.slice(0, 30)})`, ...opts });
}

export async function coordinateProcessStop(
  pid:     number,
  context: ToolExecutionContext,
  opts?:   TerminalDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(TERMINAL_TOOLS.PROCESS_STOP, { pid }, context, {
    label: `process_stop(${pid})`, ...opts,
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
    runId: context.runId, projectId: context.projectId, preferred,
  }, context, { label: 'resolve_port', ...opts });
}
