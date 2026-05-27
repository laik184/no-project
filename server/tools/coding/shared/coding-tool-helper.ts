/**
 * server/tools/coding/shared/coding-tool-helper.ts
 *
 * Typed helper for defining coding tools without TypeScript
 * contravariance errors on handler input parameters.
 *
 * Usage:
 *   export const myTool = defineCodingTool<MyInput>({ ... });
 *
 * This erases the input generic for the registry (which expects
 * ToolHandler<Record<string, unknown>>) while keeping full type
 * safety inside each handler.
 */

import type {
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolPermission,
  RetryPolicy,
  ToolInputSchema,
  ToolCategory,
} from '../../registry/tool-types.ts';

// A coding tool definition with a strictly-typed input parameter.
interface TypedCodingTool<TInput> {
  readonly name:        string;
  readonly category:    ToolCategory;
  readonly description: string;
  readonly inputSchema: ToolInputSchema;
  readonly permissions: readonly ToolPermission[];
  readonly timeoutMs:   number;
  readonly retry:       RetryPolicy;
  readonly handler:     (
    input:   TInput,
    context: ToolExecutionContext,
  ) => Promise<ToolExecutionResult>;
}

/**
 * Define a coding tool with a specific input type.
 * The return value is typed as `ToolDefinition` (registry-compatible).
 */
export function defineCodingTool<TInput>(
  def: TypedCodingTool<TInput>,
): ToolDefinition {
  return def as unknown as ToolDefinition;
}
