/**
 * server/tools/registry/tool-dispatcher.ts
 *
 * THE single execution pipeline for all tool invocations.
 *
 * Responsibilities:
 *   - permission resolution
 *   - timeout enforcement
 *   - retry with backoff
 *   - metrics recording  (Fix #3 — was dead)
 *   - audit recording    (Fix #4 — was dead)
 *   - normalized output
 *
 * Never throws — always returns ToolExecutionResult.
 */

import type {
  ToolExecutionContext,
  ToolExecutionResult,
  ToolDefinition,
  ToolErrorCode,
  RetryPolicy,
} from './tool-types.ts';
import { resolveToolWithPermissions } from './tool-resolver.ts';
import { ToolNotFoundError, ToolPermissionError } from './tool-resolver.ts';
import { recordMetric }  from './tool-metrics.ts';
import { recordAudit }   from './tool-security.ts';
import { getTool }       from './tool-registry.ts';
import { bus }           from '../../infrastructure/events/bus.ts';

// ── Dispatch options ──────────────────────────────────────────────────────────

export interface DispatchOptions {
  timeoutMs?: number;
  retry?:     RetryPolicy;
}

// ── Internal: timeout wrapper ─────────────────────────────────────────────────

function withTimeout<T>(
  fn:       () => Promise<T>,
  ms:       number,
  toolName: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`[ToolDispatcher] Tool "${toolName}" timed out after ${ms}ms`)),
      ms,
    );
    fn()
      .then((v) => { clearTimeout(timer); resolve(v); })
      .catch((e) => { clearTimeout(timer); reject(e); });
  });
}

// ── Internal: retry with backoff ──────────────────────────────────────────────

async function withRetry<T>(
  fn:     () => Promise<T>,
  policy: RetryPolicy,
): Promise<{ result: T; retries: number }> {
  let lastErr: unknown;
  let retries = 0;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      const result = await fn();
      return { result, retries };
    } catch (err) {
      lastErr = err;
      if (attempt < policy.maxAttempts) {
        retries++;
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

// ── Internal: error classification ───────────────────────────────────────────

type ToolFailureResult = { ok: false; error: string; code: ToolErrorCode; durationMs: number };

function classifyError(err: unknown, durationMs: number): ToolFailureResult {
  if (err instanceof ToolNotFoundError)   return { ok: false, error: err.message, code: 'NOT_FOUND',        durationMs };
  if (err instanceof ToolPermissionError) return { ok: false, error: err.message, code: 'PERMISSION_DENIED', durationMs };
  const msg  = err instanceof Error ? err.message : String(err);
  const code = msg.includes('timed out') ? 'TIMEOUT' : 'EXECUTION_ERROR';
  return { ok: false, error: msg, code, durationMs };
}

// ── Internal: derive category from tool name (best-effort) ────────────────────

function categoryOf(name: string, def?: ToolDefinition): string {
  return def?.category ?? name.split('_')[0] ?? 'unknown';
}


// ── Runtime event helpers ────────────────────────────────────────────────────

function publishToolEvent(
  eventType: string,
  name: string,
  context: ToolExecutionContext,
  payload: Record<string, unknown>,
): void {
  bus.emit('agent.event', {
    eventType,
    type: eventType,
    runId: context.runId,
    projectId: Number.isFinite(Number(context.projectId)) ? Number(context.projectId) : context.projectId,
    phase: context.meta.phaseId ?? context.meta.phase ?? context.meta.agent,
    payload: { tool: name, ...payload },
    ts: Date.now(),
  } as never);
}

function unwrapToolData(output: unknown): unknown {
  if (!output || typeof output !== 'object') return output;
  const record = output as Record<string, unknown>;
  return record.ok === true && 'data' in record ? record.data : output;
}

function publishShellOutput(name: string, context: ToolExecutionContext, output: unknown): void {
  const unwrapped = unwrapToolData(output);
  if (!unwrapped || typeof unwrapped !== 'object') return;
  const record = unwrapped as Record<string, unknown>;
  const stdout = typeof record.stdout === 'string' ? record.stdout : '';
  const stderr = typeof record.stderr === 'string' ? record.stderr : '';
  const outputText = typeof record.output === 'string' ? record.output : '';
  const combined = [stdout, stderr, outputText].filter(Boolean).join('\n');
  if (!combined.trim()) return;

  for (const line of combined.split(/\r?\n/).filter(Boolean).slice(-50)) {
    bus.emit('agent.event', {
      eventType: 'shell.output',
      type: 'shell.output',
      runId: context.runId,
      projectId: Number.isFinite(Number(context.projectId)) ? Number(context.projectId) : context.projectId,
      payload: { tool: name, runId: context.runId, line },
      ts: Date.now(),
    } as never);
  }
}

function publishFileWrites(name: string, context: ToolExecutionContext, output: unknown): void {
  const unwrapped = unwrapToolData(output);
  if (name !== 'fs_write_file' || !unwrapped || typeof unwrapped !== 'object') return;
  const path = (unwrapped as Record<string, unknown>).path;
  if (!path) return;
  publishToolEvent('agent.file_write', name, context, {
    status: 'done',
    label: `Wrote ${String(path)}`,
    path,
    args: { path },
  });
}

function assertRealityForTerminalOutput(name: string, definition: ToolDefinition, output: unknown): void {
  if (definition.category !== 'terminal') return;
  const unwrapped = unwrapToolData(output);
  if (!unwrapped || typeof unwrapped !== 'object') return;
  const record = unwrapped as Record<string, unknown>;
  if (typeof record.exitCode === 'number' && record.exitCode !== 0) {
    const detail = String(record.stderr ?? record.output ?? record.stdout ?? '').trim();
    throw new Error(`[${name}] exited with code ${record.exitCode}${detail ? `: ${detail}` : ''}`);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Dispatch a tool by name.
 * Resolves → validates permissions → retries → enforces timeout.
 * Records metrics and audit on every execution path.
 * Never throws. Always returns a typed ToolExecutionResult.
 */
export async function dispatch<TInput = Record<string, unknown>, TOutput = unknown>(
  name:    string,
  input:   TInput,
  context: ToolExecutionContext,
  opts:    DispatchOptions = {},
): Promise<ToolExecutionResult<TOutput>> {
  const start = Date.now();
  publishToolEvent('agent.tool_call', name, context, {
    status: 'running',
    label: name.replace(/_/g, ' '),
    args: input as Record<string, unknown>,
  });

  // ── Permission resolution ──────────────────────────────────────────────────
  let resolved: { definition: ToolDefinition };
  try {
    resolved = resolveToolWithPermissions(name, context);
  } catch (err) {
    const durationMs = Date.now() - start;
    const result     = classifyError(err, durationMs);
    const def        = getTool(name);

    recordMetric(name, false, durationMs);
    recordAudit({
      ts:        new Date().toISOString(),
      toolName:  name,
      category:  categoryOf(name, def) as never,
      runId:     context.runId,
      ok:        false,
      durationMs,
      errorCode: result.code,
    });

    publishToolEvent('tool.error', name, context, { status: 'error', error: result.error, code: result.code });
    return result;
  }

  const { definition } = resolved;
  const timeoutMs      = opts.timeoutMs ?? definition.timeoutMs;
  const retry          = opts.retry     ?? definition.retry;

  // ── Execution with retry + timeout ────────────────────────────────────────
  try {
    const { result: data, retries } = await withRetry(
      () => withTimeout(
        async () => {
          const result = await (definition.handler(input as Record<string, unknown>, context) as Promise<TOutput>);

          // Many tools (e.g. coding tools) return a ToolExecutionResult directly from
          // their handler instead of raw data. When they return { ok: false, ... } we
          // MUST throw so the retry + failure pipeline triggers — otherwise the failure
          // is silently wrapped as { ok: true, data: { ok: false } } and swallowed.
          assertRealityForTerminalOutput(name, definition, result);

          if (
            result !== null &&
            typeof result === 'object' &&
            'ok' in (result as object) &&
            (result as Record<string, unknown>).ok === false
          ) {
            const f = result as { error?: string };
            throw new Error(f.error ?? `Tool "${name}" returned a failure result`);
          }

          return result;
        },
        timeoutMs,
        name,
      ),
      retry,
    );

    const durationMs = Date.now() - start;
    const timedOut   = false;

    // If the handler returned a ToolExecutionResult (has .ok + .data), pass it
    // through directly — do NOT double-wrap as { ok: true, data: toolResult }.
    // Coding tools use codingOk() which returns { ok: true, data: GenerationResult }.
    if (
      data !== null &&
      typeof data === 'object' &&
      'ok' in (data as object) &&
      'data' in (data as object)
    ) {
      const toolResult = data as unknown as ToolExecutionResult<TOutput>;
      recordMetric(name, true, durationMs, retries, timedOut);
      recordAudit({
        ts:        new Date().toISOString(),
        toolName:  name,
        category:  definition.category,
        runId:     context.runId,
        ok:        true,
        durationMs,
      });
      publishShellOutput(name, context, toolResult.ok ? toolResult.data : undefined);
      publishFileWrites(name, context, toolResult.ok ? toolResult.data : undefined);
      publishToolEvent('tool.completed', name, context, { status: 'done', durationMs });
      return { ...toolResult, durationMs } as unknown as ToolExecutionResult<TOutput>;
    }

    recordMetric(name, true, durationMs, retries, timedOut);
    recordAudit({
      ts:        new Date().toISOString(),
      toolName:  name,
      category:  definition.category,
      runId:     context.runId,
      ok:        true,
      durationMs,
    });

    publishShellOutput(name, context, data);
    publishFileWrites(name, context, data);
    publishToolEvent('tool.completed', name, context, {
      status: 'done',
      durationMs,
      ...((data && typeof data === 'object' && 'exitCode' in (data as object)) ? { exitCode: (data as Record<string, unknown>).exitCode } : {}),
    });

    return { ok: true, data, durationMs };

  } catch (err) {
    const durationMs = Date.now() - start;
    const result     = classifyError(err, durationMs);
    const timedOut   = result.code === 'TIMEOUT';

    recordMetric(name, false, durationMs, 0, timedOut);
    recordAudit({
      ts:        new Date().toISOString(),
      toolName:  name,
      category:  definition.category,
      runId:     context.runId,
      ok:        false,
      durationMs,
      errorCode: result.code,
    });

    publishToolEvent('tool.error', name, context, { status: 'error', error: result.error, code: result.code });
    return result;
  }
}

/**
 * Dispatch multiple tools in parallel.
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
