/**
 * test/unit/retry-policy.test.ts  — P4 Test Infrastructure
 *
 * Unit tests for withRetry() — verifies backoff, retries, and exhaustion.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("../../server/infrastructure/events/bus.ts", () => ({
  bus: { emit: vi.fn() },
}));

import { withRetry, FAST_RETRY, NO_RETRY, type RetryContext } from "../../server/infrastructure/recovery/retry-policy.ts";

const ctx: RetryContext = { operationId: "test-op", runId: "run-001" };

describe("withRetry", () => {
  it("returns ok=true on first success", async () => {
    const fn    = vi.fn().mockResolvedValue("result");
    const r     = await withRetry(fn, NO_RETRY, ctx);
    expect(r.ok).toBe(true);
    expect(r.value).toBe("result");
    expect(r.attempts).toBe(0);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds on second attempt", async () => {
    let calls = 0;
    const fn  = vi.fn().mockImplementation(async () => {
      if (++calls < 2) throw new Error("transient");
      return "ok";
    });
    const policy = { ...FAST_RETRY, initialDelayMs: 1, maxRetries: 3 };
    const r      = await withRetry(fn, policy, ctx);
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(1);
  });

  it("returns ok=false after exhausting retries", async () => {
    const fn    = vi.fn().mockRejectedValue(new Error("permanent failure"));
    const policy = { maxRetries: 2, initialDelayMs: 1, backoffFactor: 1, maxDelayMs: 10 };
    const r      = await withRetry(fn, policy, ctx);
    expect(r.ok).toBe(false);
    expect(r.error?.message).toBe("permanent failure");
    expect(fn).toHaveBeenCalledTimes(3);  // 1 initial + 2 retries
  });

  it("never throws — returns RetryResult even on exhaustion", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(withRetry(fn, NO_RETRY, ctx)).resolves.toMatchObject({ ok: false });
  });
});
