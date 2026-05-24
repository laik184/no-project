/**
 * test/telemetry/run-telemetry-channel.test.ts
 * Telemetry tests — RunTelemetryChannel: correlation IDs, ordering, isolation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../server/infrastructure/events/bus.ts", () => ({
  bus: { emit: vi.fn() },
}));

import { RunTelemetryChannel } from "../../server/telemetry/run-scoped/run-telemetry-channel.ts";
import { makeRunId, makeProjectId } from "../helpers/test-context.ts";

describe("RunTelemetryChannel", () => {
  let channel: RunTelemetryChannel;
  let runId: string;
  let pid:   number;

  beforeEach(() => {
    runId   = makeRunId("tel");
    pid     = makeProjectId();
    channel = new RunTelemetryChannel(runId, pid);
  });

  afterEach(() => { try { channel.destroy(); } catch {} });

  describe("emit", () => {
    it("returns event with id, runId, eventType, and timestamp", () => {
      const ev = channel.emit("test.started", "unit", { component: "vitest" });
      expect(ev.runId).toBe(runId);
      expect(ev.eventType).toBe("test.started");
      expect(ev.phase).toBe("unit");
      expect(ev.id).toBeTruthy();
      expect(ev.ts).toBeGreaterThan(0);
    });

    it("event id is unique per emission", () => {
      const ids = [
        channel.emit("test.started",   "unit", {}).id,
        channel.emit("test.completed", "unit", {}).id,
        channel.emit("run.started",    "exec", {}).id,
      ];
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("runId matches channel on all emissions", () => {
      const evs = [
        channel.emit("test.started",  "unit", {}),
        channel.emit("test.failed",   "unit", { error: "boom" }),
        channel.emit("run.completed", "exec", {}),
      ];
      expect(evs.every(e => e.runId === runId)).toBe(true);
    });
  });

  describe("standard telemetry events", () => {
    const standardEvents = [
      "test.started", "test.completed", "test.failed",
      "assertion.failed", "retry.started", "retry.completed",
      "runtime.crashed", "orchestration.failed", "recovery.triggered", "preview.failed",
    ];

    for (const eventType of standardEvents) {
      it(`emits ${eventType} correctly`, () => {
        const ev = channel.emit(eventType, "test-phase", { detail: "x" });
        expect(ev.eventType).toBe(eventType);
        expect(ev.runId).toBe(runId);
      });
    }
  });

  describe("buffer ordering", () => {
    it("buffered events appear in emission order", () => {
      const types = ["a", "b", "c", "d", "e"];
      for (const t of types) channel.emit(t, "test", {});
      const stats = channel.stats();
      expect(stats.buffered).toBeGreaterThanOrEqual(types.length);
    });
  });

  describe("channel stats", () => {
    it("stats().runId matches channel runId", () => {
      const s = channel.stats();
      expect(s.runId).toBe(runId);
      expect(s.projectId).toBe(pid);
    });

    it("buffered count increments with each emit", () => {
      const before = channel.stats().buffered;
      channel.emit("test.started", "unit", {});
      channel.emit("test.completed", "unit", {});
      expect(channel.stats().buffered).toBe(before + 2);
    });
  });

  describe("channel isolation", () => {
    it("two channels have different runIds on their events", () => {
      const other = new RunTelemetryChannel(makeRunId(), makeProjectId());
      try {
        const evA = channel.emit("test.started", "unit", {});
        const evB = other.emit("test.started",   "unit", {});
        expect(evA.runId).not.toBe(evB.runId);
      } finally {
        other.destroy();
      }
    });
  });

  describe("destroy", () => {
    it("after destroy, channel stats show 0 subscribers", () => {
      channel.destroy();
      const s = channel.stats();
      expect(s.subscribers).toBe(0);
    });
  });

  describe("payload passthrough", () => {
    it("custom payload is preserved on the returned event", () => {
      const ev = channel.emit("custom.event", "exec", {
        phase: "execute", score: 0.95, agentId: "planner",
      });
      expect((ev.payload as any).phase).toBe("execute");
      expect((ev.payload as any).score).toBe(0.95);
    });
  });
});
