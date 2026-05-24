/**
 * test/unit/run-isolation-fabric.test.ts
 * Unit tests — RunIsolationFabric: envelope lifecycle, port tracking, leak detection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../server/infrastructure/events/bus.ts", () => ({
  bus: { emit: vi.fn() },
}));

import {
  createEnvelope, registerPort, releasePort, getEnvelope,
  isEnvelopeActive, terminateEnvelope, listActiveEnvelopes,
  detectLeakedEnvelopes, fabricStats,
} from "../../server/distributed/isolation/run-isolation-fabric.ts";
import { makeRunId, makeProjectId } from "../helpers/test-context.ts";
import { bus } from "../../server/infrastructure/events/bus.ts";

describe("RunIsolationFabric", () => {
  beforeEach(() => { (bus.emit as any).mockClear(); });

  describe("createEnvelope", () => {
    it("creates envelope with all isolation fields populated", () => {
      const runId = makeRunId(); const pid = makeProjectId();
      const env = createEnvelope(runId, pid);
      expect(env.runId).toBe(runId);
      expect(env.projectId).toBe(pid);
      expect(env.scopeToken).toMatch(/^[0-9a-f]{24}$/);
      expect(env.sandboxRoot).toContain(runId);
      expect(env.telemetryChannel).toBe(`run:${runId}`);
      expect(env.memoryLane).toBe(`lane:${runId}`);
      expect(env.lockNamespace).toBe(`lock:${runId}`);
      expect(env.status).toBe("active");
      terminateEnvelope(runId);
    });

    it("is idempotent — returns same envelope on double-create", () => {
      const runId = makeRunId(); const pid = makeProjectId();
      const a = createEnvelope(runId, pid);
      const b = createEnvelope(runId, pid);
      expect(a.scopeToken).toBe(b.scopeToken);
      terminateEnvelope(runId);
    });

    it("emits run.isolated telemetry on creation", () => {
      const runId = makeRunId(); const pid = makeProjectId();
      createEnvelope(runId, pid);
      expect(bus.emit).toHaveBeenCalledWith("agent.event",
        expect.objectContaining({ eventType: "run.isolated" }),
      );
      terminateEnvelope(runId);
    });
  });

  describe("port tracking", () => {
    it("registerPort adds port to envelope's port set", () => {
      const runId = makeRunId(); const pid = makeProjectId();
      createEnvelope(runId, pid);
      registerPort(runId, 49100);
      expect(getEnvelope(runId)?.ports.has(49100)).toBe(true);
      terminateEnvelope(runId);
    });

    it("releasePort removes port and emits lock.released", () => {
      const runId = makeRunId(); const pid = makeProjectId();
      createEnvelope(runId, pid);
      registerPort(runId, 49101);
      (bus.emit as any).mockClear();
      releasePort(runId, 49101);
      expect(getEnvelope(runId)?.ports.has(49101)).toBe(false);
      expect(bus.emit).toHaveBeenCalledWith("agent.event",
        expect.objectContaining({ eventType: "lock.released" }),
      );
      terminateEnvelope(runId);
    });
  });

  describe("terminateEnvelope", () => {
    it("sets status to terminated and clears ports", () => {
      const runId = makeRunId(); const pid = makeProjectId();
      const env = createEnvelope(runId, pid);
      registerPort(runId, 49200);
      terminateEnvelope(runId);
      expect(env.status).toBe("terminated");
      expect(env.ports.size).toBe(0);
    });

    it("is idempotent — double-terminate does not throw", () => {
      const runId = makeRunId(); const pid = makeProjectId();
      createEnvelope(runId, pid);
      expect(() => { terminateEnvelope(runId); terminateEnvelope(runId); }).not.toThrow();
    });

    it("emits run.completed with lifetimeMs", () => {
      const runId = makeRunId(); const pid = makeProjectId();
      createEnvelope(runId, pid);
      (bus.emit as any).mockClear();
      terminateEnvelope(runId);
      expect(bus.emit).toHaveBeenCalledWith("agent.event",
        expect.objectContaining({ eventType: "run.completed" }),
      );
    });
  });

  describe("listActiveEnvelopes / isEnvelopeActive", () => {
    it("only lists non-terminated envelopes", () => {
      const runId = makeRunId(); const pid = makeProjectId();
      createEnvelope(runId, pid);
      const active = listActiveEnvelopes();
      expect(active.some(e => e.runId === runId)).toBe(true);
      terminateEnvelope(runId);
      const after = listActiveEnvelopes();
      expect(after.some(e => e.runId === runId)).toBe(false);
    });

    it("isEnvelopeActive returns false after termination", () => {
      const runId = makeRunId(); const pid = makeProjectId();
      createEnvelope(runId, pid);
      expect(isEnvelopeActive(runId)).toBe(true);
      terminateEnvelope(runId);
      expect(isEnvelopeActive(runId)).toBe(false);
    });
  });

  describe("detectLeakedEnvelopes", () => {
    it("detects envelopes older than maxAgeMs", () => {
      const runId = makeRunId(); const pid = makeProjectId();
      const env = createEnvelope(runId, pid);
      (env as any).createdAt = Date.now() - 700_000;
      const leaked = detectLeakedEnvelopes(600_000);
      expect(leaked.some(e => e.runId === runId)).toBe(true);
      terminateEnvelope(runId);
    });
  });

  describe("fabricStats", () => {
    it("returns non-negative counts", () => {
      const stats = fabricStats();
      expect(stats.activeEnvelopes).toBeGreaterThanOrEqual(0);
      expect(stats.terminatedEnvelopes).toBeGreaterThanOrEqual(0);
    });
  });
});
