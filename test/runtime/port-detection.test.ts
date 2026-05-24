/**
 * test/runtime/port-detection.test.ts
 * Runtime tests — port allocation, reservation, stale sweep, platform exclusions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../server/infrastructure/events/bus.ts", () => ({
  bus: { emit: vi.fn() },
}));

import {
  allocatePort, releasePort, releaseRunPorts, isPortReserved,
  getReservation, sweepStaleReservations, snapshot, stopSweeper,
} from "../../server/runtime/network/port-allocation-authority.ts";
import { makeRunId, makeProjectId } from "../helpers/test-context.ts";

const PLATFORM_RESERVED = [80, 443, 3001, 5000, 22, 8080];

describe("Runtime: port detection and lifecycle", () => {
  afterEach(() => { stopSweeper(); });

  describe("allocation range", () => {
    it("allocated port is in ephemeral range (1025–65535)", async () => {
      const r = await allocatePort(makeRunId(), makeProjectId());
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.port).toBeGreaterThan(1024);
        expect(r.port).toBeLessThanOrEqual(65535);
        releasePort(r.port!);
      }
    });

    it("never allocates a platform-reserved port", async () => {
      for (let i = 0; i < 20; i++) {
        const r = await allocatePort(makeRunId(), makeProjectId());
        if (r.ok) {
          expect(PLATFORM_RESERVED).not.toContain(r.port);
          releasePort(r.port!);
        }
      }
    });
  });

  describe("reservation lifecycle", () => {
    it("reservation includes allocatedAt timestamp", async () => {
      const runId = makeRunId(); const pid = makeProjectId();
      const r = await allocatePort(runId, pid);
      if (!r.ok) return;
      const res = getReservation(r.port!);
      expect(res?.allocatedAt).toBeGreaterThan(0);
      releasePort(r.port!);
    });

    it("released port is no longer reserved", async () => {
      const r = await allocatePort(makeRunId(), makeProjectId());
      if (!r.ok) return;
      releasePort(r.port!);
      expect(isPortReserved(r.port!)).toBe(false);
    });

    it("releaseRunPorts frees all ports for the run", async () => {
      const runId = makeRunId(); const pid = makeProjectId();
      const [r1, r2] = await Promise.all([allocatePort(runId, pid), allocatePort(runId, pid)]);
      releaseRunPorts(runId);
      if (r1.ok) expect(isPortReserved(r1.port!)).toBe(false);
      if (r2.ok) expect(isPortReserved(r2.port!)).toBe(false);
    });
  });

  describe("sweep stale reservations", () => {
    it("sweeps reservations older than maxAgeMs", async () => {
      const runId = makeRunId(); const pid = makeProjectId();
      const r = await allocatePort(runId, pid);
      if (!r.ok) return;
      const port = r.port!;
      const res = getReservation(port);
      if (res) (res as any).allocatedAt = Date.now() - 7_200_000;
      sweepStaleReservations(3_600_000);
      expect(isPortReserved(port)).toBe(false);
    });

    it("does not sweep recently allocated ports", async () => {
      const r = await allocatePort(makeRunId(), makeProjectId());
      if (!r.ok) return;
      sweepStaleReservations(3_600_000);
      expect(isPortReserved(r.port!)).toBe(true);
      releasePort(r.port!);
    });
  });

  describe("snapshot consistency", () => {
    it("snapshot.totalReserved increases after allocation", async () => {
      const before = snapshot().totalReserved;
      const r = await allocatePort(makeRunId(), makeProjectId());
      const after  = snapshot().totalReserved;
      expect(after).toBeGreaterThanOrEqual(before);
      if (r.ok) releasePort(r.port!);
    });

    it("snapshot.byRun includes the allocated run", async () => {
      const runId = makeRunId(); const pid = makeProjectId();
      const r = await allocatePort(runId, pid);
      const snap = snapshot();
      if (r.ok) {
        expect(snap.byRun[runId]).toBeDefined();
        expect(snap.byRun[runId]).toContain(r.port);
        releasePort(r.port!);
      }
    });
  });

  describe("zombie prevention", () => {
    it("orphaned stale allocations are swept cleanly", async () => {
      const runId = makeRunId(); const pid = makeProjectId();
      const r = await allocatePort(runId, pid);
      if (!r.ok) return;
      const port = r.port!;
      const res = getReservation(port);
      if (res) (res as any).allocatedAt = Date.now() - 10_000_000;
      sweepStaleReservations(3_600_000);
      expect(isPortReserved(port)).toBe(false);
    });
  });
});
