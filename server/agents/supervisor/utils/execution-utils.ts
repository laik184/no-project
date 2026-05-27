export { withTimeout, sleep, timed, runConcurrent, retryFixed } from '../../../orchestration/utils/execution-utils.ts';

import { withTimeout } from '../../../orchestration/utils/execution-utils.ts';

/**
 * Race a promise against a timeout, returning null on timeout instead of throwing.
 */
export async function withTimeoutOrNull<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
): Promise<T | null> {
  try {
    return await withTimeout(fn, { timeoutMs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('timed out')) return null;
    throw err;
  }
}

/**
 * Run fn with a deadline. Returns { ok, value, error, durationMs }.
 */
export async function runWithResult<T>(fn: () => Promise<T>, timeoutMs?: number): Promise<{
  ok: boolean;
  value?: T;
  error?: string;
  durationMs: number;
}> {
  const start = Date.now();
  try {
    const runner = timeoutMs ? () => withTimeout(fn, { timeoutMs }) : fn;
    const value = await runner();
    return { ok: true, value, durationMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Sequentially execute async fns, stopping on first failure.
 */
export async function runSequential<T>(
  tasks: Array<() => Promise<T>>,
): Promise<{ results: T[]; failedAt: number | null }> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i++) {
    try {
      results.push(await tasks[i]());
    } catch {
      return { results, failedAt: i };
    }
  }
  return { results, failedAt: null };
}

/**
 * Debounce: only execute once per `ms` window.
 */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { fn(...args); timer = null; }, ms);
  };
}
