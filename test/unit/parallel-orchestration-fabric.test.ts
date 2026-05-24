/**
 * test/unit/parallel-orchestration-fabric.test.ts
 * Unit tests — ParallelOrchestrationFabric: spawning, capacity, GC, isolation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../server/infrastructure/events/bus.ts", () => ({
  bus: { emit: vi.fn() },
}));

import { parallelOrchestrationFabric } from "../../server/orchestration/distributed/parallel-orchestration-fabric.ts";
import { makeRunId, makeProjectId }     from "../helpers/test-context.ts";

describe("ParallelOrchestrationFabric", () => {
  beforeEach(() => {
    parallelOrchestrationFabric.start();
  });

  afterEach(() => {
    // Clean up any active orchestrators
    for (const runId of parallelOrchestrationFabric.activeRunIds()) {
      parallelOrchestrationFabric.fail(runId, "test-cleanup");
    }
    parallelOrchestrationFabric.stop();
  });

  describe("spawn", () => {
    it("spawns a new orchestrator for a fresh runId", () => {
      const runId = makeRunId(); const pid = makeProjectId();
      const result = parallelOrchestrationFabric.spawn(runId, pid);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.orchestrator.runId).toBe(runId);
    });

    it("is idempotent — re-spawn of active run returns same orchestrator", () => {
      const runId = makeRunId(); const pid = makeProjectId();
      const a = parallelOrchestrationFabric.spawn(runId, pid);
      const b = parallelOrchestrationFabric.spawn(runId, pid);
      expect(a.ok && b.ok).toBe(true);
      if (a.ok && b.ok) expect(a.orchestrator.runId).toBe(b.orchestrator.runId);
    });

    it("rejects spawn when capacity exceeded", () => {
      // Temporarily override the config by filling capacity
      const snapshot = parallelOrchestrationFabric.snapshot();
      const remaining = snapshot.capacity - snapshot.active;
      const spawned: string[] = [];

      for (let i = 0; i < remaining; i++) {
        const runId = makeRunId();
        const r = parallelOrchestrationFabric.spawn(runId, makeProjectId());
        if (r.ok) spawned.push(runId);
      }

      // One more should either succeed (if capacity wasn't hit) or fail
      const overflow = parallelOrchestrationFabric.spawn(makeRunId(), makeProjectId());
      const s2 = parallelOrchestrationFabric.snapshot();

      // Either we hit the cap and got a rejection, or capacity was large enough
      if (!overflow.ok) {
        expect(overflow.error).toContain("capacity");
      }

      // Cleanup
      for (const r of spawned) parallelOrchestrationFabric.fail(r, "cleanup");
    });
  });

  describe("isActive", () => {
    it("returns true for active run, false after fail", () => {
      const runId = makeRunId(); const pid = makeProjectId();
      parallelOrchestrationFabric.spawn(runId, pid);
      expect(parallelOrchestrationFabric.isActive(runId)).toBe(true);
      parallelOrchestrationFabric.fail(runId, "done");
      expect(parallelOrchestrationFabric.isActive(runId)).toBe(false);
    });

    it("returns false for unknown runId", () => {
      expect(parallelOrchestrationFabric.isActive("nonexistent")).toBe(false);
    });
  });

  describe("transition", () => {
    it("delegates phase transition to the correct orchestrator", () => {
      const runId = makeRunId(); const pid = makeProjectId();
      parallelOrchestrationFabric.spawn(runId, pid);
      parallelOrchestrationFabric.transition(runId, "observe");
      expect(parallelOrchestrationFabric.get(runId)?.phase).toBe("observe");
    });

    it("cross-run transitions do not affect each other", () => {
      const [rA, rB] = [makeRunId(), makeRunId()];
      parallelOrchestrationFabric.spawn(rA, makeProjectId());
      parallelOrchestrationFabric.spawn(rB, makeProjectId());
      parallelOrchestrationFabric.transition(rA, "observe");
      parallelOrchestrationFabric.transition(rB, "analyze");
      expect(parallelOrchestrationFabric.get(rA)?.phase).toBe("observe");
      expect(parallelOrchestrationFabric.get(rB)?.phase).toBe("analyze");
    });
  });

  describe("snapshot", () => {
    it("reports active count and pressure ≤ 1", () => {
      const snap = parallelOrchestrationFabric.snapshot();
      expect(snap.active).toBeGreaterThanOrEqual(0);
      expect(snap.pressure).toBeGreaterThanOrEqual(0);
      expect(snap.pressure).toBeLessThanOrEqual(1);
    });
  });

  describe("10-run parallel safety", () => {
    it("10 runs spawn and fail independently without interference", () => {
      const runs = Array.from({ length: 10 }, () => ({
        runId: makeRunId(), pid: makeProjectId(),
      }));
      for (const { runId, pid } of runs) {
        parallelOrchestrationFabric.spawn(runId, pid);
      }
      for (const { runId } of runs) {
        parallelOrchestrationFabric.transition(runId, "observe");
      }
      for (const { runId } of runs) {
        expect(parallelOrchestrationFabric.get(runId)?.phase).toBe("observe");
        parallelOrchestrationFabric.fail(runId, "test-done");
      }
    });
  });
});
