/**
 * server/agents/coderx/llm-loop/tool-dispatcher.ts
 *
 * Fix #9 — CoderX private dispatcher eliminated.
 *
 * Previously this file contained a fully isolated execution system with
 * hand-rolled implementations of write_file, read_file, edit_file, and
 * generate_api — bypassing the central registry, permissions, retry,
 * metrics, and audit entirely.
 *
 * This file is now a thin adapter that:
 *   1. Maps coderX tool names → canonical registry tool names
 *   2. Builds a ToolExecutionContext from the basePath option
 *   3. Routes all calls through the central dispatch() function
 *
 * Benefits:
 *   - retry policy enforced on all coderX tool calls
 *   - metrics + audit recorded for coderX tool calls
 *   - permission model applies to coderX tool calls
 *   - single execution ecosystem (Fix #9 success criteria)
 */

import { dispatch as centralDispatch } from '../../../tools/registry/tool-dispatcher.ts';
import type { ToolExecutionContext }   from '../../../tools/registry/tool-types.ts';

export interface DispatchResult {
  success: boolean;
  output:  string;
  error?:  string;
}

export interface DispatchOptions {
  basePath: string;
}

// ── coderX tool name → canonical registry tool name ───────────────────────────

const TOOL_NAME_MAP: Record<string, string> = {
  write_file:    'fs_write_file',
  read_file:     'fs_read_file',
  edit_file:     'fs_patch_file',
  generate_api:  'coding_generate_rest_api',
};

// ── Argument adapters for tools with different schemas ────────────────────────

function adaptArgs(
  coderxName: string,
  args: Record<string, unknown>,
): Record<string, unknown> {
  if (coderxName === 'edit_file') {
    // coderX uses old_content/new_content; fs_patch_file uses target/replacement
    return {
      path:        args.path,
      target:      args.old_content,
      replacement: args.new_content,
    };
  }
  return args;
}

// ── Context builder — basePath becomes the sandboxRoot ───────────────────────

function buildCoderXContext(basePath: string): ToolExecutionContext {
  return Object.freeze({
    runId:       'coderx',
    projectId:   'coderx',
    sandboxRoot: basePath,
    meta:        {},
  });
}

// ── Public dispatch (same signature as before — backward compat) ──────────────

export async function dispatch(
  toolName: string,
  args:     Record<string, unknown>,
  opts:     DispatchOptions,
): Promise<DispatchResult> {
  const centralName = TOOL_NAME_MAP[toolName];
  if (!centralName) {
    return { success: false, output: '', error: `Unknown tool: "${toolName}"` };
  }

  const ctx    = buildCoderXContext(opts.basePath);
  const mapped = adaptArgs(toolName, args);
  const result = await centralDispatch(centralName, mapped, ctx);

  if (!result.ok) {
    return { success: false, output: '', error: result.error };
  }

  const data = (result as { ok: true; data: unknown }).data;
  const output = typeof data === 'string'
    ? data
    : data != null ? JSON.stringify(data) : '';

  return { success: true, output };
}
