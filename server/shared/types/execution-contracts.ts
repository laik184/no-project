/**
 * server/shared/types/execution-contracts.ts
 *
 * Shared execution contract types consumed by all agent dispatcher-clients.
 * Re-exports from the canonical tool-types to avoid duplication.
 */
export type {
  ToolExecutionContext,
  ToolExecutionResult,
  ToolErrorCode,
  RetryPolicy,
} from '../../tools/registry/tool-types.ts';
