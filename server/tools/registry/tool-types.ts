/**
 * server/tools/registry/tool-types.ts
 *
 * Core type contracts for the centralized tool execution layer.
 * Everything in server/tools/ depends on these types — never the reverse.
 */

// ── Categories ────────────────────────────────────────────────────────────────

export type ToolCategory =
  | 'filesystem'
  | 'terminal'
  | 'browser'
  | 'verifier'
  | 'coding';

// ── Permissions ───────────────────────────────────────────────────────────────

export type ToolPermission =
  | 'read'
  | 'write'
  | 'execute'
  | 'network'
  | 'process';

// ── Retry Policy ──────────────────────────────────────────────────────────────

export interface RetryPolicy {
  maxAttempts: number;
  delayMs:     number;
  backoff:     'none' | 'linear' | 'exponential';
}

// ── Input / Output schemas (lightweight — no runtime validation dep here) ──────

export type ToolInputSchema  = Record<string, FieldSchema>;
export type ToolOutputSchema = Record<string, FieldSchema>;

export interface FieldSchema {
  type:        'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?:   boolean;
  default?:    unknown;
}

// ── Tool Definition ───────────────────────────────────────────────────────────

export interface ToolDefinition<TInput = Record<string, unknown>, TOutput = unknown> {
  readonly name:        string;
  readonly category:    ToolCategory;
  readonly description: string;
  readonly inputSchema: ToolInputSchema;
  readonly permissions: readonly ToolPermission[];
  readonly timeoutMs:   number;
  readonly retry:       RetryPolicy;
  readonly handler:     ToolHandler<TInput, TOutput>;
}

// ── Execution Context ─────────────────────────────────────────────────────────

export interface ToolExecutionContext {
  readonly runId:     string;
  readonly projectId: string;
  readonly sandboxRoot: string;
  readonly signal?:   AbortSignal;
  readonly meta:      Record<string, unknown>;
}

// ── Execution Result ──────────────────────────────────────────────────────────

export type ToolExecutionResult<T = unknown> =
  | { ok: true;  data: T;      durationMs: number }
  | { ok: false; error: string; code: ToolErrorCode; durationMs: number };

export type ToolErrorCode =
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'TIMEOUT'
  | 'VALIDATION_ERROR'
  | 'EXECUTION_ERROR'
  | 'UNKNOWN';

// ── Handler ───────────────────────────────────────────────────────────────────

export type ToolHandler<TInput = Record<string, unknown>, TOutput = unknown> = (
  input:   TInput,
  context: ToolExecutionContext,
) => Promise<TOutput>;

// ── Registration payload ──────────────────────────────────────────────────────

export type ToolRegistrationEntry = Omit<ToolDefinition, 'handler'> & {
  readonly handler: ToolHandler;
};
