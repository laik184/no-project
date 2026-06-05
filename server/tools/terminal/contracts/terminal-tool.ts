/**
 * server/tools/terminal/contracts/terminal-tool.ts
 *
 * Re-exports the platform ToolDefinition so terminal tools
 * only need one import for their base type.
 */

export type {
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolHandler,
} from '../../registry/tool-types.ts';
