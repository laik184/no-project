/**
 * test/unit/run-scoped-orchestrator.test.ts
 * Unit tests — RunScopedOrchestrator: phase state machine, checkpoints, telemetry.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../server/infrastructure/events/bus.ts", () => ({
  bus: { emit: vi.fn() },
}));

import { RunScopedOrchestrator } from "../../server/orchestration/distributed/run-scoped-orchestrator.ts";
import { makeRunId, makeProjectId, expectTelemetryEmitted } from "../helpers/test-context.ts";
import { bus } from "../../server/infrastructure/events/bus.ts";

describe("RunScopedOrchestrator", () => {
  let orch: RunScopedOrchestrator;
  let runId: string;
  let pid: number;

  beforeEach(() => {
    runId = makeRunId();
    pid   = makeProjectId();
    orch  = new RunScopedOrchestrator(runId, pid);
    (bus.emit as any).mockClear();
  });

  describe("construction", () => {
    it("starts in pending phase", () => {
      expect(orch.phase).toBe("pending");
      expect(orch.isTerminal).toBe(false);
    });

    it("emits run.started telemetry", () => {
      const o = new RunScopedOrchestrator(makeRunId(), makeProjectId());
      expectTelemetryEmitted(bus.emit as any, "run.started");
      o.fail("cleanup"); // avoid leak
    });
  });

  describe("transition", () => {
    it("advances phase and records checkpoint", () => {
      const res = orch.transition("observe", { source: "test" });
      expect(res.ok).toBe(true);
      expect(orch.phase).toBe("observe");
      expect(orch.latestCheckpoint()?.phase).toBe("observe");
    });

    it("emits run.phase telemetry on each transition", () => {
      orch.transition("observe");
      expectTelemetryEmitted(bus.emit as any, "run.phase.observe");
    });

    it("rejects transition from terminal phase", () => {
      orch.transition("complete");
      const res = orch.transition("observe");
      expect(res.ok).toBe(false);
    });

    it("complete phase marks isTerminal=true", () => {
      orch.transition("complete");
      expect(orch.isTerminal).toBe(true);
    });

    it("failed phase marks isTerminal=true", () => {
      orch.fail("test-fail");
      expect(orch.isTerminal).toBe(true);
    });

    it("multi-phase progression works end-to-end", () => {
      const phases = ["observe", "analyze", "plan", "execute", "complete"] as const;
      for (const phase of phases) {
        const r = orch.transition(phase);
        expect(r.ok).toBe(true);
      }
      expect(orch.phase).toBe("complete");
    });
  });

  describe("checkpoints", () => {
    it("latestCheckpoint returns most recent phase", () => {
      orch.transition("observe");
      orch.transition("analyze");
      expect(orch.latestCheckpoint()?.phase).toBe("analyze");
    });

    it("lastCheckpointBefore returns checkpoint before the given phase", () => {
      orch.transition("observe");
      orch.transition("analyze");
      const cp = orch.lastCheckpointBefore("analyze");
      expect(cp?.phase).toBe("observe");
    });

    it("snapshot preserves checkpoint history", () => {
      orch.transition("observe");
      orch.transition("plan");
      const snap = orch.snapshot();
      expect(snap.checkpoints).toHaveLength(2);
    });
  });

  describe("metadata", () => {
    it("setMeta / getMeta store and retrieve values", () => {
      orch.setMeta("key1", "value1");
      expect(orch.getMeta("key1")).toBe("value1");
    });

    it("meta is isolated between orchestrator instances", () => {
      const other = new RunScopedOrchestrator(makeRunId(), makeProjectId());
      orch.setMeta("shared", "A");
      other.setMeta("shared", "B");
      expect(orch.getMeta("shared")).toBe("A");
      expect(other.getMeta("shared")).toBe("B");
      other.fail("cleanup");
    });
  });

  describe("fail / recover", () => {
    it("fail increments failCount and transitions to failed", () => {
      orch.fail("error-reason");
      expect(orch.phase).toBe("failed");
      expect(orch.snapshot().failCount).toBe(1);
    });

    it("recover transitions to recovering phase", () => {
      orch.transition("execute");
      const res = orch.recover("transient-error");
      expect(res.ok).toBe(true);
      expect(orch.phase).toBe("recovering");
    });
  });
});
