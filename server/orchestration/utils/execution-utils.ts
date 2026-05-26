/**
 * Reusable async execution utilities for orchestration.
 */

export interface TimeoutOptions {
  timeoutMs: number;
  signal?: AbortSignal;
}

/** Run a promise with a hard timeout. Rejects with TimeoutError on breach. */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  options: TimeoutOptions
): Promise<T> {
  const { timeoutMs, signal } = options;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new AbortError('Operation was aborted'));
      });
    }

    fn()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/** Execute a function and suppress any thrown error, returning undefined instead. */
export async function safeExec<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch {
    return undefined;
  }
}

/** Delay execution for the given number of milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry a function up to maxAttempts, with a static delay between attempts. */
export async function retryFixed<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  delayMs: number
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) await sleep(delayMs);
    }
  }
  throw lastError;
}

/** Run async tasks with a concurrency limit. */
export async function runConcurrent<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

/** Measure execution time of an async function. */
export async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, durationMs: Date.now() - start };
}

/** Resolve a promise or return a fallback value on error. */
export async function withFallback<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class AbortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AbortError';
  }
}
