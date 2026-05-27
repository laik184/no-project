/**
 * server/tools/core/tool-context.ts
 *
 * DEPRECATED — Fix #7 (multiple context systems unified).
 *
 * The duplicate ToolContext type and createContext() factory have been
 * unified into the canonical ToolExecutionContext + buildContext() in:
 *   - server/tools/registry/tool-types.ts  (type)
 *   - server/tools/shared/context-builder.ts (factory)
 *
 * This shim re-exports from those canonical locations so existing
 * imports continue to compile without changes.
 *
 * Migration path:
 *   OLD: import { ToolContext, createContext } from '../../tools/core/tool-context.ts'
 *   NEW: import { ToolExecutionContext, buildContext } from '../../tools/shared/context-builder.ts'
 */

export type {
  ToolExecutionContext as ToolContext,
} from '../registry/tool-types.ts';

import { buildContext, buildSystemContext } from '../shared/context-builder.ts';
import type { ToolExecutionContext }        from '../registry/tool-types.ts';

/**
 * @deprecated Use buildContext(runId, projectId) from shared/context-builder.ts.
 * NOTE: argument order is swapped from the original createContext(projectId, runId).
 * This adapter preserves the OLD order for backward compatibility.
 */
export function createContext(
  projectId: string | number,
  runId:     string,
  signal?:   AbortSignal,
): ToolExecutionContext {
  return buildContext(runId, String(projectId), { signal });
}

export function createSystemContext(
  overrides: Partial<ToolExecutionContext> = {},
): ToolExecutionContext {
  return buildSystemContext(overrides);
}
