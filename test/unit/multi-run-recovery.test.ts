/**
 * test/unit/multi-run-recovery.test.ts
 * Unit tests — MultiRunRecoverySystem: strategy selection, circuit breaker, isolation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../server/infrastructure/events/bus.ts", () => ({
  bus: { emit: vi.fn() },
}));

vi.mock("../../server/orchestration/distributed/parallel-orchestration-fabric.ts", () => ({
  parallelOrchestrationFabric: {
    fail:    vi.fn(),
    get:     vi.fn().mockReturnValue({ recover: vi.fn() }),
    isActive: vi.fn().mockReturnValue(true),
  },
}));

import {
  triggerRecovery, resolveRecovery, getAttempts,
  isCircuitOpen, clearRecoveryState, setPolicyForRun, stats,
} from "../../server/orchestration/distributed/multi-run-recovery.ts";
import { makeRunId, makeProjectId } from "../helpers/test-context.ts";

describe("MultiRunRecoverySystem", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe("triggerRecovery", () => {
    it("creates attempt #1 with retry strategy", async () => {
      const runId = makeRunId(); const pid = makeProjectId();
      setPolicyForRun(runId, pid, { retryDelayMs: 0 });
      const attempt = await triggerRecovery(runId, pid, "test-crash");
      expect(attempt.attemptNum).toBe(1);
      expect(attempt.strategy).toBe("retry");
      expect(attempt.result).toBe("pending");
      clearRecoveryState(runId);
    });

    it("escalates strategy on subsequent attempts", async () => {
      const runId = makeRunId(); const pid = makeProjectId();
      setPolicyForRun(runId, pid, { retryDelayMs: 0, minTimeout: 0 });
      const a1 = await triggerRecovery(runId, pid, "crash-1");
      resolveRecovery(runId, false);
      const a2 = await triggerRecovery(runId, pid, "crash-2");
      resolveRecovery(runId, false);
      expect(a1.strategy).not.toBe(a2.strategy);
      clearRecoveryState(runId);
    });

    it("opens circuit breaker after maxRetries", async () => {
      const runId = makeRunId(); const pid = makeProjectId();
      setPolicyForRun(runId, pid, { maxRetries: 2, retryDelayMs: 0 });
      for (let i = 0; i < 3; i++) {
        await triggerRecovery(runId, pid, `crash-${i}`);
        resolveRecovery(runId, false);
      }
      expect(isCircuitOpen(runId)).toBe(true);
      clearRecoveryState(runId);
    });

    it("circuit-break attempt uses circuit-break strategy", async () => {
      const runId = makeRunId(); const pid = makeProjectId();
      setPolicyForRun(runId, pid, { maxRetries: 1, retryDelayMs: 0 });
      await triggerRecovery(runId, pid, "crash-a");
      resolveRecovery(runId, false);
      await triggerRecovery(runId, pid, "crash-b");
      resolveRecovery(runId, false);
      const a3 = await triggerRecovery(runId, pid, "crash-c");
      expect(a3.strategy).toBe("circuit-break");
      clearRecoveryState(runId);
    });
  });

  describe("resolveRecovery", () => {
    it("marks the pending attempt as success", async () => {
      const runId = makeRunId(); const pid = makeProjectId();
      setPolicyForRun(runId, pid, { retryDelayMs: 0 });
      await triggerRecovery(runId, pid, "crash");
      resolveRecovery(runId, true);
      const attempts = getAttempts(runId);
      expect(attempts.at(-1)?.result).toBe("success");
      clearRecoveryState(runId);
    });

    it("is a no-op for unknown runId", () => {
      expect(() => resolveRecovery("nonexistent", true)).not.toThrow();
    });
  });

  describe("cross-run isolation", () => {
    it("recovery for runA does not affect runB", async () => {
      const runA = makeRunId(); const runB = makeRunId(); const pid = makeProjectId();
      setPolicyForRun(runA, pid, { retryDelayMs: 0 });
      setPolicyForRun(runB, pid, { retryDelayMs: 0 });
      await triggerRecovery(runA, pid, "crash-A");
      // runB should have zero attempts
      expect(getAttempts(runB)).toHaveLength(0);
      clearRecoveryState(runA);
      clearRecoveryState(runB);
    });
  });

  describe("stats", () => {
    it("returns non-negative counts", () => {
      const s = stats();
      expect(s.activeRuns).toBeGreaterThanOrEqual(0);
      expect(s.totalAttempts).toBeGreaterThanOrEqual(0);
      expect(s.openCircuits).toBeGreaterThanOrEqual(0);
    });
  });
});
