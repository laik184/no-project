/**
 * test/unit/port-allocation-authority.test.ts
 * Unit tests — PortAllocationAuthority: atomic allocation, ownership, cleanup.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../server/infrastructure/events/bus.ts", () => ({
  bus: { emit: vi.fn() },
}));

import {
  allocatePort, releasePort, releaseRunPorts, isPortReserved,
  getReservation, getRunPorts, sweepStaleReservations, snapshot,
  stopSweeper,
} from "../../server/runtime/network/port-allocation-authority.ts";
import { makeRunId, makeProjectId } from "../helpers/test-context.ts";

describe("PortAllocationAuthority", () => {
  afterEach(() => { stopSweeper(); });

  describe("allocatePort", () => {
    it("returns ok=true with a valid port number", async () => {
      const runId = makeRunId(); const pid = makeProjectId();
      const result = await allocatePort(runId, pid);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.port).toBeGreaterThan(1024);
        expect(result.port).toBeLessThanOrEqual(65535);
        releasePort(result.port);
      }
    });

    it("reserved port appears in snapshot", async () => {
      const runId = makeRunId(); const pid = makeProjectId();
      const result = await allocatePort(runId, pid);
      if (!result.ok) return;
      const { byRun } = snapshot();
      expect(byRun[runId]).toContain(result.port);
      releasePort(result.port);
    });

    it("allocated port passes isPortReserved check", async () => {
      const runId = makeRunId(); const pid = makeProjectId();
      const result = await allocatePort(runId, pid);
      if (!result.ok) return;
      expect(isPortReserved(result.port!)).toBe(true);
      releasePort(result.port!);
    });

    it("allocates different ports for concurrent runs", async () => {
      const [r1, r2] = [makeRunId(), makeRunId()];
      const [p1, p2] = [makeProjectId(), makeProjectId()];
      const [res1, res2] = await Promise.all([allocatePort(r1, p1), allocatePort(r2, p2)]);
      expect(res1.ok && res2.ok).toBe(true);
      if (res1.ok && res2.ok) {
        expect(res1.port).not.toBe(res2.port);
        releasePort(res1.port!);
        releasePort(res2.port!);
      }
    });
  });

  describe("releasePort", () => {
    it("removes reservation after release", async () => {
      const runId = makeRunId(); const pid = makeProjectId();
      const result = await allocatePort(runId, pid);
      if (!result.ok) return;
      releasePort(result.port!);
      expect(isPortReserved(result.port!)).toBe(false);
    });

    it("is idempotent — double-release does not throw", async () => {
      const runId = makeRunId(); const pid = makeProjectId();
      const result = await allocatePort(runId, pid);
      if (!result.ok) return;
      expect(() => { releasePort(result.port!); releasePort(result.port!); }).not.toThrow();
    });
  });

  describe("releaseRunPorts", () => {
    it("releases all ports for a run", async () => {
      const runId = makeRunId(); const pid = makeProjectId();
      const [r1, r2] = await Promise.all([allocatePort(runId, pid), allocatePort(runId, pid)]);
      releaseRunPorts(runId);
      if (r1.ok) expect(isPortReserved(r1.port!)).toBe(false);
      if (r2.ok) expect(isPortReserved(r2.port!)).toBe(false);
    });
  });

  describe("getReservation", () => {
    it("returns reservation with correct runId", async () => {
      const runId = makeRunId(); const pid = makeProjectId();
      const result = await allocatePort(runId, pid);
      if (!result.ok) return;
      const res = getReservation(result.port!);
      expect(res?.runId).toBe(runId);
      expect(res?.projectId).toBe(pid);
      releasePort(result.port!);
    });
  });

  describe("sweepStaleReservations", () => {
    it("removes reservations older than maxAgeMs", async () => {
      const runId = makeRunId(); const pid = makeProjectId();
      const result = await allocatePort(runId, pid);
      if (!result.ok) return;
      const port = result.port!;
      // Backdate the allocation
      const res = getReservation(port);
      if (res) (res as any).allocatedAt = Date.now() - 7_200_000;
      const swept = sweepStaleReservations(3_600_000);
      expect(swept).toBeGreaterThanOrEqual(1);
      expect(isPortReserved(port)).toBe(false);
    });
  });

  describe("getRunPorts", () => {
    it("returns empty array for unknown runId", () => {
      expect(getRunPorts("nonexistent-run")).toEqual([]);
    });
  });
});
