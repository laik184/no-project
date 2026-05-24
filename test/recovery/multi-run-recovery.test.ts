/**
 * test/recovery/multi-run-recovery.test.ts
 * Recovery tests — circuit breaker, retry escalation, cross-run isolation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../server/infrastructure/events/bus.ts", () => ({
  bus: { emit: vi.fn() },
}));
vi.mock("../../server/orchestration/distributed/parallel-orchestration-fabric.ts", () => ({
  parallelOrchestrationFabric: {
    fail: vi.fn(), get: vi.fn().mockReturnValue({ recover: vi.fn() }), isActive: vi.fn().mockReturnValue(true),
  },
}));

import {
  triggerRecovery, resolveRecovery, getAttempts, isCircuitOpen,
  clearRecoveryState, setPolicyForRun, stats,
} from "../../server/orchestration/distributed/multi-run-recovery.ts";
import { makeRunId, makeProjectId } from "../helpers/test-context.ts";

describe("MultiRunRecovery — recovery systems", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe("retry escalation", () => {
    it("strategy escalates from retry → rollback → circuit-break", async () => {
      const runId = makeRunId(); const pid = makeProjectId();
      setPolicyForRun(runId, pid, { maxRetries: 2, retryDelayMs: 0 });
      const strategies: string[] = [];
      for (let i = 0; i < 3; i++) {
        const attempt = await triggerRecovery(runId, pid, `crash-${i}`);
        strategies.push(attempt.strategy);
        resolveRecovery(runId, false);
      }
      expect(strategies[0]).toBe("retry");
      expect(strategies[strategies.length - 1]).toBe("circuit-break");
      clearRecoveryState(runId);
    });
  });

  describe("circuit breaker", () => {
    it("circuit opens after maxRetries exhausted", async () => {
      const runId = makeRunId(); const pid = makeProjectId();
      setPolicyForRun(runId, pid, { maxRetries: 1, retryDelayMs: 0 });
      for (let i = 0; i < 2; i++) {
        await triggerRecovery(runId, pid, `c${i}`);
        resolveRecovery(runId, false);
      }
      expect(isCircuitOpen(runId)).toBe(true);
      clearRecoveryState(runId);
    });

    it("circuit remains closed after successful recovery", async () => {
      const runId = makeRunId(); const pid = makeProjectId();
      setPolicyForRun(runId, pid, { maxRetries: 3, retryDelayMs: 0 });
      await triggerRecovery(runId, pid, "crash");
      resolveRecovery(runId, true);
      expect(isCircuitOpen(runId)).toBe(false);
      clearRecoveryState(runId);
    });
  });

  describe("cross-run isolation", () => {
    it("open circuit in runA does not affect runB", async () => {
      const [rA, rB] = [makeRunId(), makeRunId()]; const pid = makeProjectId();
      setPolicyForRun(rA, pid, { maxRetries: 0, retryDelayMs: 0 });
      setPolicyForRun(rB, pid, { maxRetries: 3, retryDelayMs: 0 });
      await triggerRecovery(rA, pid, "crash"); resolveRecovery(rA, false);
      expect(isCircuitOpen(rA)).toBe(true);
      expect(isCircuitOpen(rB)).toBe(false);
      clearRecoveryState(rA); clearRecoveryState(rB);
    });

    it("attempts for runA do not appear in runB history", async () => {
      const [rA, rB] = [makeRunId(), makeRunId()]; const pid = makeProjectId();
      setPolicyForRun(rA, pid, { retryDelayMs: 0 });
      await triggerRecovery(rA, pid, "crash");
      expect(getAttempts(rB)).toHaveLength(0);
      clearRecoveryState(rA); clearRecoveryState(rB);
    });
  });

  describe("10 concurrent runs", () => {
    it("10 runs can each trigger and resolve recovery independently", async () => {
      const runs = Array.from({ length: 10 }, () => ({ runId: makeRunId(), pid: makeProjectId() }));
      for (const { runId, pid } of runs) {
        setPolicyForRun(runId, pid, { retryDelayMs: 0 });
      }
      await Promise.all(runs.map(({ runId, pid }) => triggerRecovery(runId, pid, "crash")));
      for (const { runId } of runs) resolveRecovery(runId, true);

      for (const { runId } of runs) {
        expect(isCircuitOpen(runId)).toBe(false);
        expect(getAttempts(runId).at(-1)?.result).toBe("success");
        clearRecoveryState(runId);
      }
    });
  });

  describe("stats", () => {
    it("totalAttempts increases with each triggered recovery", async () => {
      const before = stats().totalAttempts;
      const runId = makeRunId(); const pid = makeProjectId();
      setPolicyForRun(runId, pid, { retryDelayMs: 0 });
      await triggerRecovery(runId, pid, "crash");
      expect(stats().totalAttempts).toBeGreaterThan(before);
      clearRecoveryState(runId);
    });
  });
});
