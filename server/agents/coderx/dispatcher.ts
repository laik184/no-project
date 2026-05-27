import { dispatch as centralDispatch } from '../../tools/registry/tool-dispatcher.ts';
import type { ToolExecutionContext }   from '../../tools/registry/tool-types.ts';

export interface DispatchResult {
  success: boolean;
  output:  string;
  error?:  string;
}

export interface DispatchOptions {
  basePath: string;
}

const TOOL_NAME_MAP: Record<string, string> = {
  write_file:   'fs_write_file',
  read_file:    'fs_read_file',
  edit_file:    'fs_patch_file',
  generate_api: 'coding_generate_rest_api',
};

function adaptArgs(
  coderxName: string,
  args: Record<string, unknown>,
): Record<string, unknown> {
  if (coderxName === 'edit_file') {
    return { path: args.path, target: args.old_content, replacement: args.new_content };
  }
  return args;
}

function buildContext(basePath: string): ToolExecutionContext {
  return Object.freeze({ runId: 'coderx', projectId: 'coderx', sandboxRoot: basePath, meta: {} });
}

export async function dispatch(
  toolName: string,
  args:     Record<string, unknown>,
  opts:     DispatchOptions,
): Promise<DispatchResult> {
  const centralName = TOOL_NAME_MAP[toolName];
  if (!centralName) {
    return { success: false, output: '', error: `Unknown tool: "${toolName}"` };
  }

  const result = await centralDispatch(centralName, adaptArgs(toolName, args), buildContext(opts.basePath));

  if (!result.ok) {
    return { success: false, output: '', error: result.error };
  }

  const data   = (result as { ok: true; data: unknown }).data;
  const output = typeof data === 'string' ? data : data != null ? JSON.stringify(data) : '';

  return { success: true, output };
}
