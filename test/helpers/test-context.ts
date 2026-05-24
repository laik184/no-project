/**
 * test/helpers/test-context.ts
 *
 * Factory helpers for creating typed test contexts, run IDs, and project IDs.
 * Ensures deterministic, unique IDs across parallel test runs.
 */

import { vi }    from "vitest";
import crypto    from "crypto";

// ── ID factories ──────────────────────────────────────────────────────────────

let _seqRun     = 0;
let _seqProject = 0;

/** Generate a deterministic runId scoped to the current test. */
export function makeRunId(prefix = "test-run"): string {
  return `${prefix}-${++_seqRun}-${crypto.randomBytes(4).toString("hex")}`;
}

/** Generate a deterministic projectId. */
export function makeProjectId(): number {
  return 1000 + (++_seqProject);
}

/** Reset ID counters (call in beforeEach if strict ordering matters). */
export function resetIdCounters(): void {
  _seqRun     = 0;
  _seqProject = 0;
}

// ── Timer helpers ─────────────────────────────────────────────────────────────

/**
 * Run an async operation with a timeout guard.
 * Throws if the promise does not resolve within ms.
 */
export function withTimeout<T>(promise: Promise<T>, ms = 5_000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Test timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/**
 * Advance fake timers by ms and flush microtasks.
 * Only useful when vi.useFakeTimers() is active.
 */
export async function tick(ms = 0): Promise<void> {
  vi.advanceTimersByTime(ms);
  await Promise.resolve();
}

// ── Assertion helpers ─────────────────────────────────────────────────────────

/** Assert a function throws an error matching the message pattern. */
export async function assertThrowsAsync(
  fn:      () => Promise<unknown>,
  pattern: string | RegExp,
): Promise<void> {
  let threw = false;
  try {
    await fn();
  } catch (err: any) {
    threw = true;
    const msg = err?.message ?? String(err);
    const matches = typeof pattern === "string" ? msg.includes(pattern) : pattern.test(msg);
    if (!matches) {
      throw new Error(`Expected error matching "${pattern}" but got: "${msg}"`);
    }
  }
  if (!threw) throw new Error(`Expected function to throw but it did not.`);
}

/** Wait until a condition becomes true, polling every intervalMs. */
export async function waitUntil(
  condition:  () => boolean | Promise<boolean>,
  timeoutMs = 3_000,
  intervalMs = 20,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`waitUntil: condition not met within ${timeoutMs}ms`);
}

// ── Telemetry assertion helper ────────────────────────────────────────────────

export function expectTelemetryEmitted(
  mockEmit: ReturnType<typeof vi.fn>,
  eventType: string,
): void {
  const calls = mockEmit.mock.calls;
  const found  = calls.some(([event, payload]: [string, any]) =>
    event === "agent.event" && payload?.eventType === eventType,
  );
  if (!found) {
    const types = calls
      .filter(([e]: [string]) => e === "agent.event")
      .map(([, p]: [string, any]) => p?.eventType);
    throw new Error(
      `Expected telemetry eventType "${eventType}" but got: [${types.join(", ")}]`,
    );
  }
}
