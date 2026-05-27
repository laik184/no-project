/**
 * server/tools/registry/tool-dispatcher.ts
 *
 * Executes a resolved tool with:
 *   - execution context injection
 *   - structured output normalization
 *   - timeout enforcement
 *   - retry with backoff
 *   - fail-safe error capture
 *
 * Never throws — always returns ToolExecutionResult.
 */

import type {
  ToolExecutionContext,
  ToolExecutionResult,
  ToolDefinition,
  RetryPolicy,
} from './tool-types.ts';
import { resolveToolWithPermissions } from './tool-resolver.ts';
import { ToolNotFoundError, ToolPermissionError } from './tool-resolver.ts';

// ── Dispatch options ──────────────────────────────────────────────────────────

export interface DispatchOptions {
  /** Override the tool's default timeoutMs. */
  timeoutMs?: number;
  /** Override the tool's default retry policy. */
  retry?:     RetryPolicy;
}

// ── Internal: timeout wrapper ─────────────────────────────────────────────────

function withTimeout<T>(
  fn:        () => Promise<T>,
  ms:        number,
  toolName:  string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`[ToolDispatcher] Tool "${toolName}" timed out after ${ms}ms`)),
      ms,
    );
    fn()
      .then((v) => { clearTimeout(timer); resolve(v); })
      .catch((e) => { clearTimeout(timer); reject(e);  });
  });
}

// ── Internal: retry with backoff ──────────────────────────────────────────────

async function withRetry<T>(
  fn:     () => Promise<T>,
  policy: RetryPolicy,
): Promise<T> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;

      if (attempt < policy.maxAttempts) {
        const delay = policy.backoff === 'exponential'
          ? policy.delayMs * Math.pow(2, attempt - 1)
          : policy.backoff === 'linear'
            ? policy.delayMs * attempt
            : 0;

        if (delay > 0) await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastErr;
}

// ── Internal: normalize error ─────────────────────────────────────────────────

function classifyError(err: unknown, durationMs: number): ToolExecutionResult<never> {
  if (err instanceof ToolNotFoundError)   return { ok: false, error: err.message, code: 'NOT_FOUND',        durationMs };
  if (err instanceof ToolPermissionError) return { ok: false, error: err.message, code: 'PERMISSION_DENIED', durationMs };

  const msg = err instanceof Error ? err.message : String(err);
  const code = msg.includes('timed out') ? 'TIMEOUT' : 'EXECUTION_ERROR';
  return { ok: false, error: msg, code, durationMs };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Dispatch a tool by name.
 * Resolves → validates permissions → retries → enforces timeout.
 * Never throws. Always returns a typed ToolExecutionResult.
 */
export async function dispatch<TInput = Record<string, unknown>, TOutput = unknown>(
  name:    string,
  input:   TInput,
  context: ToolExecutionContext,
  opts:    DispatchOptions = {},
): Promise<ToolExecutionResult<TOutput>> {
  const start = Date.now();

  let resolved: { definition: ToolDefinition };
  try {
    resolved = resolveToolWithPermissions(name, context);
  } catch (err) {
    return classifyError(err, Date.now() - start);
  }

  const { definition } = resolved;
  const timeoutMs = opts.timeoutMs ?? definition.timeoutMs;
  const retry     = opts.retry     ?? definition.retry;

  try {
    const data = await withRetry(
      () => withTimeout(
        () => definition.handler(input as Record<string, unknown>, context) as Promise<TOutput>,
        timeoutMs,
        name,
      ),
      retry,
    );

    return { ok: true, data, durationMs: Date.now() - start };
  } catch (err) {
    return classifyError(err, Date.now() - start);
  }
}

/**
 * Dispatch multiple tools in parallel.
 * Returns results in the same order as inputs.
 * Individual failures do not abort sibling dispatches.
 */
export async function dispatchAll<TOutput = unknown>(
  calls: Array<{
    name:    string;
    input:   Record<string, unknown>;
    context: ToolExecutionContext;
    opts?:   DispatchOptions;
  }>,
): Promise<Array<ToolExecutionResult<TOutput>>> {
  return Promise.all(
    calls.map(c => dispatch<Record<string, unknown>, TOutput>(c.name, c.input, c.context, c.opts)),
  );
}

/**
 * Dispatch tools in sequence, stopping on first failure.
 */
export async function dispatchSequential<TOutput = unknown>(
  calls: Array<{
    name:    string;
    input:   Record<string, unknown>;
    context: ToolExecutionContext;
    opts?:   DispatchOptions;
  }>,
): Promise<Array<ToolExecutionResult<TOutput>>> {
  const results: Array<ToolExecutionResult<TOutput>> = [];

  for (const call of calls) {
    const result = await dispatch<Record<string, unknown>, TOutput>(
      call.name, call.input, call.context, call.opts,
    );
    results.push(result);
    if (!result.ok) break;
  }

  return results;
}
