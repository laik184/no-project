/**
 * test/telemetry/run-scoped-telemetry.test.ts
 * Telemetry tests — RunScopedTelemetry: spans, metrics, cross-run isolation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../server/infrastructure/events/bus.ts", () => ({
  bus: { emit: vi.fn() },
}));

import { RunTelemetryChannel } from "../../server/telemetry/run-scoped/run-telemetry-channel.ts";
import { makeRunId, makeProjectId } from "../helpers/test-context.ts";

describe("RunTelemetryChannel — advanced telemetry", () => {
  let channel: RunTelemetryChannel;
  let runId:   string;
  let pid:     number;

  beforeEach(() => {
    runId   = makeRunId("adv-tel");
    pid     = makeProjectId();
    channel = new RunTelemetryChannel(runId, pid);
  });

  afterEach(() => { try { channel.destroy(); } catch {} });

  describe("event sequence integrity", () => {
    it("event IDs encode sequential prefix for ordering", () => {
      const e1 = channel.emit("e1", "p", {});
      const e2 = channel.emit("e2", "p", {});
      const e3 = channel.emit("e3", "p", {});
      // IDs contain the seq number — parse and verify order
      const seqs = [e1, e2, e3].map(e => parseInt(e.id.split(":")[1] ?? "0", 10));
      expect(seqs[0]).toBeLessThan(seqs[1]);
      expect(seqs[1]).toBeLessThan(seqs[2]);
    });

    it("ts timestamps are non-decreasing", async () => {
      const e1 = channel.emit("e1", "p", {});
      await new Promise(r => setTimeout(r, 1));
      const e2 = channel.emit("e2", "p", {});
      expect(e2.ts).toBeGreaterThanOrEqual(e1.ts);
    });
  });

  describe("phase tagging", () => {
    it("phase is preserved on the event", () => {
      const ev = channel.emit("run.phase.execute", "execute", { step: 3 });
      expect(ev.phase).toBe("execute");
    });
  });

  describe("buffer limits", () => {
    it("buffered count does not grow unboundedly (capped at MAX_BUFFER)", () => {
      for (let i = 0; i < 600; i++) {
        channel.emit(`event-${i}`, "stress", {});
      }
      const stats = channel.stats();
      expect(stats.buffered).toBeLessThanOrEqual(500);
    });
  });

  describe("lastEventAt tracking", () => {
    it("lastEventAt is non-null after first emit", () => {
      channel.emit("test.started", "unit", {});
      expect(channel.stats().lastEventAt).not.toBeNull();
    });

    it("lastEventAt updates on each emit", async () => {
      const e1 = channel.emit("a", "p", {});
      const t1 = channel.stats().lastEventAt;
      await new Promise(r => setTimeout(r, 2));
      channel.emit("b", "p", {});
      const t2 = channel.stats().lastEventAt;
      expect(t2).toBeGreaterThanOrEqual(t1!);
    });
  });

  describe("10-run fan-out isolation", () => {
    it("10 channels emit independently without collision", () => {
      const channels = Array.from({ length: 10 }, () =>
        new RunTelemetryChannel(makeRunId(), makeProjectId()),
      );
      try {
        const events = channels.map(ch => ch.emit("test.started", "unit", {}));
        const runIds = events.map(e => e.runId);
        expect(new Set(runIds).size).toBe(10);
      } finally {
        channels.forEach(ch => { try { ch.destroy(); } catch {} });
      }
    });
  });
});
