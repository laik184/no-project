/**
 * server/quantum/execution/execution-timeout.ts
 *
 * Hard and soft timeout wrappers for async task execution.
 *
 *   withHardTimeout — rejects the promise after timeoutMs (no recovery)
 *   withSoftTimeout — fires a warning callback at softMs, then hard-kills at hardMs
 *
 * Both use Promise.race and never swallow the error — callers must handle.
 */

import { TaskTimeoutError } from "../scheduler/worker-errors.ts";

// ── Hard timeout ──────────────────────────────────────────────────────────────

/**
 * Race `work` against a hard deadline.
 * If the deadline fires first, rejects with TaskTimeoutError.
 */
export async function withHardTimeout<T>(
  work:      Promise<T>,
  timeoutMs: number,
  taskId:    string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new TaskTimeoutError(taskId, timeoutMs)),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([work, deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// ── Soft + hard timeout ───────────────────────────────────────────────────────

export interface SoftTimeoutOptions {
  taskId:       string;
  softMs:       number;   // fires onSoftExpiry but does not reject
  hardMs:       number;   // fires rejection after this
  onSoftExpiry: (taskId: string, elapsedMs: number) => void;
}

/**
 * Runs `work` with a two-stage timeout:
 *   1. At `softMs`: calls `onSoftExpiry` (e.g. emit a warning event) but continues
 *   2. At `hardMs`: rejects with TaskTimeoutError
 */
export async function withSoftTimeout<T>(
  work: Promise<T>,
  opts: SoftTimeoutOptions,
): Promise<T> {
  const t0 = Date.now();
  let softTimer: ReturnType<typeof setTimeout> | undefined;
  let hardTimer: ReturnType<typeof setTimeout> | undefined;

  const hardDeadline = new Promise<never>((_, reject) => {
    hardTimer = setTimeout(
      () => reject(new TaskTimeoutError(opts.taskId, opts.hardMs)),
      opts.hardMs,
    );
  });

  softTimer = setTimeout(
    () => opts.onSoftExpiry(opts.taskId, Date.now() - t0),
    opts.softMs,
  );

  try {
    return await Promise.race([work, hardDeadline]);
  } finally {
    if (softTimer !== undefined) clearTimeout(softTimer);
    if (hardTimer !== undefined) clearTimeout(hardTimer);
  }
}

// ── AbortSignal-aware runner ──────────────────────────────────────────────────

/**
 * Run `fn` but short-circuit if the AbortSignal fires before completion.
 * Useful for cooperative cancellation without relying on timeout alone.
 */
export async function withAbortGuard<T>(
  fn:     () => Promise<T>,
  signal: AbortSignal,
  taskId: string,
): Promise<T> {
  if (signal.aborted) {
    throw new Error(`Task "${taskId}" aborted before start`);
  }

  const abortPromise = new Promise<never>((_, reject) => {
    signal.addEventListener("abort", () =>
      reject(new Error(`Task "${taskId}" aborted`)), { once: true },
    );
  });

  return Promise.race([fn(), abortPromise]);
}
