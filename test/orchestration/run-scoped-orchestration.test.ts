/**
 * test/orchestration/run-scoped-orchestration.test.ts
 * Orchestration tests — phase transitions, checkpoints, recovery, parallel fabric.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../server/infrastructure/events/bus.ts", () => ({
  bus: { emit: vi.fn() },
}));

import { RunScopedOrchestrator }       from "../../server/orchestration/distributed/run-scoped-orchestrator.ts";
import { parallelOrchestrationFabric } from "../../server/orchestration/distributed/parallel-orchestration-fabric.ts";
import { makeRunId, makeProjectId }    from "../helpers/test-context.ts";

describe("Orchestration: run-scoped lifecycle", () => {
  let runId: string;
  let pid:   number;

  beforeEach(() => {
    runId = makeRunId("orch");
    pid   = makeProjectId();
    parallelOrchestrationFabric.start();
  });

  afterEach(() => {
    for (const id of parallelOrchestrationFabric.activeRunIds()) {
      parallelOrchestrationFabric.fail(id, "test-cleanup");
    }
    parallelOrchestrationFabric.stop();
  });

  describe("phase state machine", () => {
    it("observe → analyze → plan → execute → complete", () => {
      const o = new RunScopedOrchestrator(runId, pid);
      for (const phase of ["observe","analyze","plan","execute","complete"] as const) {
        expect(o.transition(phase).ok).toBe(true);
      }
      expect(o.isTerminal).toBe(true);
      expect(o.phase).toBe("complete");
    });

    it("cannot transition from terminal complete state", () => {
      const o = new RunScopedOrchestrator(runId, pid);
      o.transition("complete");
      expect(o.transition("observe").ok).toBe(false);
    });

    it("failed is also terminal", () => {
      const o = new RunScopedOrchestrator(runId, pid);
      o.fail("test-fail");
      expect(o.isTerminal).toBe(true);
      expect(o.transition("observe").ok).toBe(false);
    });

    it("recovering → execute is allowed (not terminal)", () => {
      const o = new RunScopedOrchestrator(runId, pid);
      o.transition("execute");
      o.recover("transient-error");
      expect(o.phase).toBe("recovering");
      expect(o.transition("execute").ok).toBe(true);
    });
  });

  describe("checkpoint history", () => {
    it("checkpoint is recorded for every transition", () => {
      const o = new RunScopedOrchestrator(runId, pid);
      o.transition("observe");
      o.transition("analyze");
      o.transition("plan");
      expect(o.snapshot().checkpoints).toHaveLength(3);
    });

    it("latestCheckpoint returns most recently transitioned phase", () => {
      const o = new RunScopedOrchestrator(runId, pid);
      o.transition("observe");
      o.transition("analyze");
      expect(o.latestCheckpoint()?.phase).toBe("analyze");
    });

    it("lastCheckpointBefore pinpoints the phase before rollback target", () => {
      const o = new RunScopedOrchestrator(runId, pid);
      o.transition("observe");
      o.transition("plan");
      o.transition("execute");
      const cp = o.lastCheckpointBefore("execute");
      expect(cp?.phase).toBe("plan");
    });

    it("snapshot preserves full checkpoint sequence", () => {
      const o = new RunScopedOrchestrator(runId, pid);
      o.transition("observe");
      o.transition("analyze");
      o.transition("plan");
      const snap = o.snapshot();
      expect(snap.checkpoints.map(c => c.phase)).toEqual(["observe","analyze","plan"]);
    });
  });

  describe("recovery", () => {
    it("recover transitions to recovering then allows re-execute", () => {
      const o = new RunScopedOrchestrator(runId, pid);
      o.transition("execute");
      const rr = o.recover("transient-error");
      expect(rr.ok).toBe(true);
      expect(o.phase).toBe("recovering");
      expect(o.transition("execute").ok).toBe(true);
    });

    it("failCount increments on each fail call", () => {
      const o = new RunScopedOrchestrator(runId, pid);
      o.transition("execute");
      o.recover("e1");
      o.fail("final");
      expect(o.snapshot().failCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("metadata", () => {
    it("setMeta / getMeta stores arbitrary execution metadata", () => {
      const o = new RunScopedOrchestrator(runId, pid);
      o.setMeta("reflection.score",   0.87);
      o.setMeta("reflection.summary", "code quality improved");
      expect(o.getMeta("reflection.score")).toBe(0.87);
      expect(o.getMeta("reflection.summary")).toBe("code quality improved");
    });

    it("meta is isolated between orchestrator instances", () => {
      const o1 = new RunScopedOrchestrator(runId,         pid);
      const o2 = new RunScopedOrchestrator(makeRunId(), pid);
      o1.setMeta("shared", "A");
      o2.setMeta("shared", "B");
      expect(o1.getMeta("shared")).toBe("A");
      expect(o2.getMeta("shared")).toBe("B");
      o2.fail("cleanup");
    });
  });

  describe("parallel fabric delegation", () => {
    it("fabric.spawn creates an isolated orchestrator per run", () => {
      const rA = makeRunId(); const rB = makeRunId();
      parallelOrchestrationFabric.spawn(rA, makeProjectId());
      parallelOrchestrationFabric.spawn(rB, makeProjectId());
      parallelOrchestrationFabric.transition(rA, "observe");
      parallelOrchestrationFabric.transition(rB, "analyze");
      expect(parallelOrchestrationFabric.get(rA)?.phase).toBe("observe");
      expect(parallelOrchestrationFabric.get(rB)?.phase).toBe("analyze");
    });

    it("parallel fabric snapshot reports positive capacity", () => {
      const snap = parallelOrchestrationFabric.snapshot();
      expect(snap.capacity).toBeGreaterThan(0);
      expect(snap.pressure).toBeGreaterThanOrEqual(0);
    });
  });
});
