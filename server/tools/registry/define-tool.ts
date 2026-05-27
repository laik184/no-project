/**
 * server/tools/registry/define-tool.ts
 *
 * Type-safe tool definition helper (Fix #15).
 *
 * Eliminates the `as unknown as ToolDefinition` double-cast pattern
 * that appeared in 47 coding-tool files.  The single cast is contained
 * here — all tool definitions become type-checked at their own level.
 *
 * Usage:
 *   export const myTool = defineTool<MyInputType>({
 *     name: 'my_tool',
 *     handler: async (input, ctx) => { ... },
 *     ...
 *   });
 */

import type {
  ToolDefinition,
  ToolHandler,
  ToolCategory,
  ToolPermission,
  RetryPolicy,
  ToolInputSchema,
} from './tool-types.ts';

export interface TypedToolDefinition<TInput, TOutput = unknown> {
  readonly name:        string;
  readonly category:    ToolCategory;
  readonly description: string;
  readonly inputSchema: ToolInputSchema;
  readonly permissions: readonly ToolPermission[];
  readonly timeoutMs:   number;
  readonly retry:       RetryPolicy;
  readonly handler:     ToolHandler<TInput, TOutput>;
}

/**
 * Wrap a strongly-typed tool definition into the registry's base `ToolDefinition`.
 * The single type coercion is concentrated here rather than scattered across tool files.
 */
export function defineTool<TInput = Record<string, unknown>, TOutput = unknown>(
  def: TypedToolDefinition<TInput, TOutput>,
): ToolDefinition {
  return def as unknown as ToolDefinition;
}

/**
 * Convenience alias for the common coding-generator pattern.
 */
export function defineCodingTool<TInput = Record<string, unknown>, TOutput = unknown>(
  def: TypedToolDefinition<TInput, TOutput>,
): ToolDefinition {
  return defineTool(def);
}
