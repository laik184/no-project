/**
 * test/unit/run-isolation.test.ts  — P4 Test Infrastructure
 *
 * Unit tests for RunIsolation — context creation, tracking, destruction, leaks.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("../../server/infrastructure/events/bus.ts", () => ({
  bus: { emit: vi.fn() },
}));

import {
  createRunContext,
  trackFile,
  trackTimer,
  setScopedMeta,
  getScopedMeta,
  destroyRunContext,
  withRunContext,
  detectLeaks,
  listActiveContexts,
} from "../../server/infrastructure/isolation/run-isolation.ts";

describe("RunIsolation", () => {
  it("creates a context with correct runId and projectId", () => {
    const ctx = createRunContext("run-x", 42);
    expect(ctx.runId).toBe("run-x");
    expect(ctx.projectId).toBe(42);
    expect(ctx.scopeId).toMatch(/^[0-9a-f]{16}$/);
    destroyRunContext(ctx);
  });

  it("trackFile registers file paths", () => {
    const ctx = createRunContext("run-y", 1);
    trackFile(ctx, "/tmp/test.txt");
    expect(ctx.files.has("/tmp/test.txt")).toBe(true);
    destroyRunContext(ctx);
  });

  it("scoped meta is isolated per context", () => {
    const a = createRunContext("run-a", 1);
    const b = createRunContext("run-b", 1);
    setScopedMeta(a, "key", "valueA");
    setScopedMeta(b, "key", "valueB");
    expect(getScopedMeta(a, "key")).toBe("valueA");
    expect(getScopedMeta(b, "key")).toBe("valueB");
    destroyRunContext(a);
    destroyRunContext(b);
  });

  it("destroyRunContext clears all resources", async () => {
    const ctx = createRunContext("run-z", 1);
    trackFile(ctx, "/tmp/fake.txt");
    setScopedMeta(ctx, "x", 1);
    await destroyRunContext(ctx);
    expect(ctx.files.size).toBe(0);
    expect(ctx.meta.size).toBe(0);
  });

  it("withRunContext guarantees destruction even on error", async () => {
    let capturedCtx: any;
    await expect(withRunContext("run-err", 1, async (ctx) => {
      capturedCtx = ctx;
      throw new Error("run failed");
    })).rejects.toThrow("run failed");
    expect(listActiveContexts().find(c => c.scopeId === capturedCtx.scopeId)).toBeUndefined();
  });

  it("detectLeaks returns contexts older than maxAgeMs", async () => {
    const ctx = createRunContext("run-leak", 99);
    // Manually backdate
    (ctx as any).createdAt = Date.now() - 400_000;
    const leaked = detectLeaks(300_000);
    expect(leaked.some(c => c.scopeId === ctx.scopeId)).toBe(true);
    destroyRunContext(ctx);
  });
});
