/**
 * server/tools/core/execute-tool.ts
 *
 * DEPRECATED — Fix #1 + #7.
 *
 * This module was a shadow executor used by node-executor.ts.
 * node-executor.ts has been migrated to use the canonical
 * `dispatch()` from `registry/tool-dispatcher.ts`.
 *
 * This file is preserved as a compatibility shim so any remaining
 * imports continue to compile. DO NOT use in new code.
 *
 * Migration path:
 *   OLD: import { executeTool } from '../../tools/core/execute-tool.ts'
 *   NEW: import { dispatch }    from '../../tools/registry/tool-dispatcher.ts'
 */

import { dispatch }     from '../registry/tool-dispatcher.ts';
import type { ToolExecutionContext } from '../registry/tool-types.ts';

/** @deprecated Use ToolExecutionContext from registry/tool-types.ts */
export type ToolContext = ToolExecutionContext;

/** @deprecated Retained for type compatibility only */
export interface RegisteredToolEntry {
  tool: {
    name:        string;
    description: string;
    parameters?: Record<string, unknown>;
  };
  category:    string;
  terminal:    boolean;
  permissions: readonly string[];
  handler:     (args: Record<string, unknown>, ctx: ToolExecutionContext) => Promise<unknown>;
  timeoutMs:   number;
}

/** @deprecated Retained for type compatibility only */
export interface ToolExecuteResult {
  ok:         boolean;
  result?:    unknown;
  error?:     string;
  durationMs: number;
}

/**
 * @deprecated Use dispatch() from registry/tool-dispatcher.ts directly.
 * Routes through the canonical dispatcher so existing callers maintain
 * correct behavior while being migrated.
 */
export async function executeTool(
  entry: RegisteredToolEntry,
  args:  Record<string, unknown>,
  ctx:   ToolExecutionContext,
): Promise<ToolExecuteResult> {
  const result = await dispatch(entry.tool.name, args, ctx);
  if (result.ok) {
    return { ok: true, result: (result as { ok: true; data: unknown }).data, durationMs: result.durationMs };
  }
  return { ok: false, error: result.error, durationMs: result.durationMs };
}
