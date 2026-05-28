/**
 * server/shared/types/execution-contracts.ts
 *
 * NEUTRAL shared type contracts for the execution layer.
 *
 * GOVERNANCE RULE: Agents MUST import ToolExecutionContext and ToolExecutionResult
 * from THIS file — NOT directly from server/tools/registry/tool-types.ts.
 *
 * Reason: tools/registry/ is a tool-layer implementation directory.
 * Agents importing from it directly creates a cross-layer type dependency.
 * This file is the neutral bridge that keeps the dependency graph clean.
 *
 * Re-exports only — no runtime logic.
 */

export type {
  ToolExecutionContext,
  ToolExecutionResult,
  ToolDefinition,
  RetryPolicy,
  ToolErrorCode,
} from '../../tools/registry/tool-types.ts';
