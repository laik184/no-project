/**
 * test/preview/run-scoped-preview.test.ts
 * Preview lifecycle tests — registerPreview, markReady, markError, destroyPreview.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../server/infrastructure/events/bus.ts", () => ({
  bus: {
    emit:      vi.fn(),
    on:        vi.fn().mockReturnValue(undefined),
    off:       vi.fn(),
    once:      vi.fn(),
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

import {
  registerPreview, markPreviewReady, markPreviewError, destroyPreview,
  syncPreview, getPreview, listActivePreviews, snapshot,
} from "../../server/preview/run-scoped-preview-fabric.ts";
import { makeRunId, makeProjectId } from "../helpers/test-context.ts";
import { bus } from "../../server/infrastructure/events/bus.ts";

describe("RunScopedPreviewFabric (functional)", () => {
  let runId: string;
  let pid:   number;

  beforeEach(() => {
    runId = makeRunId("preview");
    pid   = makeProjectId();
    (bus.emit as any).mockClear();
  });

  afterEach(() => {
    // destroyPreview keeps a 120s tombstone — just ensure status is marked
    const inst = getPreview(runId);
    if (inst && inst.status !== "destroyed") {
      try { destroyPreview(runId); } catch {}
    }
  });

  describe("registerPreview", () => {
    it("creates preview with initializing status and correct channels", () => {
      const inst = registerPreview(runId, pid);
      expect(inst.runId).toBe(runId);
      expect(inst.projectId).toBe(pid);
      expect(inst.status).toBe("initializing");
      expect(inst.channel).toBe(`preview:${runId}`);
      expect(inst.wsChannel).toBe(`ws:preview:${runId}`);
    });

    it("emits telemetry on registration", () => {
      registerPreview(runId, pid);
      expect(bus.emit).toHaveBeenCalled();
      const call = (bus.emit as any).mock.calls.find(
        ([ev, payload]: [string, any]) => ev === "agent.event" && payload?.runId === runId,
      );
      expect(call).toBeDefined();
    });

    it("idempotent — re-register returns same instance", () => {
      const a = registerPreview(runId, pid);
      const b = registerPreview(runId, pid);
      expect(a.channel).toBe(b.channel);
    });
  });

  describe("markPreviewReady", () => {
    it("transitions status to ready with port and url", () => {
      const inst = registerPreview(runId, pid);
      markPreviewReady(runId, 49600, "http://localhost:49600");
      expect(inst.status).toBe("ready");
      expect(inst.port).toBe(49600);
      expect(inst.url).toBe("http://localhost:49600");
    });

    it("emits telemetry after markPreviewReady", () => {
      registerPreview(runId, pid);
      const callsBefore = (bus.emit as any).mock.calls.length;
      markPreviewReady(runId, 49600, "http://localhost:49600");
      expect((bus.emit as any).mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  describe("markPreviewError", () => {
    it("transitions status to error with message", () => {
      const inst = registerPreview(runId, pid);
      markPreviewError(runId, "port-unreachable");
      expect(inst.status).toBe("error");
      expect(inst.errorMessage).toBe("port-unreachable");
    });

    it("emits telemetry after markPreviewError", () => {
      registerPreview(runId, pid);
      const callsBefore = (bus.emit as any).mock.calls.length;
      markPreviewError(runId, "crash");
      expect((bus.emit as any).mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  describe("destroyPreview", () => {
    it("marks instance as destroyed (tombstone stays 120s)", () => {
      registerPreview(runId, pid);
      destroyPreview(runId);
      // Tombstone stays in registry for 120s — but status must be "destroyed"
      const inst = getPreview(runId);
      expect(inst?.status ?? "destroyed").toBe("destroyed");
    });

    it("removed from listActivePreviews after destroy", () => {
      registerPreview(runId, pid);
      destroyPreview(runId);
      const active = listActivePreviews();
      expect(active.some(p => p.runId === runId)).toBe(false);
    });

    it("emits telemetry on destroy", () => {
      registerPreview(runId, pid);
      const callsBefore = (bus.emit as any).mock.calls.length;
      destroyPreview(runId);
      expect((bus.emit as any).mock.calls.length).toBeGreaterThan(callsBefore);
    });

    it("is idempotent — double destroy does not throw", () => {
      registerPreview(runId, pid);
      expect(() => { destroyPreview(runId); destroyPreview(runId); }).not.toThrow();
    });
  });

  describe("cross-run isolation", () => {
    it("two previews have distinct channels", () => {
      const [rA, rB] = [makeRunId(), makeRunId()];
      const instA = registerPreview(rA, makeProjectId());
      const instB = registerPreview(rB, makeProjectId());
      try {
        expect(instA.channel).not.toBe(instB.channel);
        expect(instA.wsChannel).not.toBe(instB.wsChannel);
      } finally {
        destroyPreview(rA);
        destroyPreview(rB);
      }
    });

    it("marking runA ready does not affect runB status", () => {
      const [rA, rB] = [makeRunId(), makeRunId()];
      registerPreview(rA, makeProjectId());
      const instB = registerPreview(rB, makeProjectId());
      try {
        markPreviewReady(rA, 49700, "http://x");
        expect(instB.status).toBe("initializing");
      } finally {
        destroyPreview(rA);
        destroyPreview(rB);
      }
    });
  });

  describe("snapshot / listActivePreviews", () => {
    it("snapshot reports correct active count", () => {
      registerPreview(runId, pid);
      const snap = snapshot();
      expect(snap.active).toBeGreaterThanOrEqual(1);
    });

    it("listActivePreviews includes registered preview", () => {
      registerPreview(runId, pid);
      const list = listActivePreviews();
      expect(list.some(p => p.runId === runId)).toBe(true);
    });
  });
});
