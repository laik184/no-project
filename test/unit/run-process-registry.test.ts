/**
 * test/unit/run-process-registry.test.ts
 * Unit tests — RunProcessRegistry: PID ownership, conflict detection, cleanup.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../server/infrastructure/events/bus.ts", () => ({
  bus: { emit: vi.fn() },
}));

// Mock process.kill to avoid real signal sending in tests
const killMock = vi.fn();
vi.stubGlobal("process", { ...process, kill: killMock });

import {
  registerProcess, updateStatus, deregisterProcess,
  getRunProcesses, getActiveProcess, getOwner,
  terminateRunProcesses, stats,
} from "../../server/infrastructure/process/run-process-registry.ts";
import { makeRunId, makeProjectId } from "../helpers/test-context.ts";

// Use fake PIDs well above real process range for safety
let _fakePid = 900_000;
const nextPid = () => ++_fakePid;

describe("RunProcessRegistry", () => {
  beforeEach(() => { killMock.mockClear(); });

  describe("registerProcess", () => {
    it("registers a process under the correct run", () => {
      const runId = makeRunId(); const pid = makeProjectId(); const fakePid = nextPid();
      const conflict = registerProcess(fakePid, runId, pid, 49300);
      expect(conflict).toBeNull();
      const procs = getRunProcesses(runId);
      expect(procs.some(p => p.pid === fakePid)).toBe(true);
      deregisterProcess(fakePid);
    });

    it("detects PID ownership conflict across runs", () => {
      const runA = makeRunId(); const runB = makeRunId(); const pid = makeProjectId();
      const fakePid = nextPid();
      registerProcess(fakePid, runA, pid);
      const conflict = registerProcess(fakePid, runB, pid);
      expect(conflict).not.toBeNull();
      expect(conflict?.existingRunId).toBe(runA);
      expect(conflict?.claimingRunId).toBe(runB);
      deregisterProcess(fakePid);
    });

    it("allows re-registration for same runId (idempotent)", () => {
      const runId = makeRunId(); const pid = makeProjectId(); const fakePid = nextPid();
      registerProcess(fakePid, runId, pid);
      const conflict = registerProcess(fakePid, runId, pid);
      expect(conflict).toBeNull();
      deregisterProcess(fakePid);
    });
  });

  describe("updateStatus", () => {
    it("changes status to stopped", () => {
      const runId = makeRunId(); const pid = makeProjectId(); const fakePid = nextPid();
      registerProcess(fakePid, runId, pid);
      updateStatus(fakePid, "stopped");
      const procs = getRunProcesses(runId);
      expect(procs.find(p => p.pid === fakePid)?.status).toBe("stopped");
      deregisterProcess(fakePid);
    });

    it("no-ops for unknown PID", () => {
      expect(() => updateStatus(999_999_999, "crashed")).not.toThrow();
    });
  });

  describe("deregisterProcess", () => {
    it("removes process from registry", () => {
      const runId = makeRunId(); const pid = makeProjectId(); const fakePid = nextPid();
      registerProcess(fakePid, runId, pid);
      deregisterProcess(fakePid);
      expect(getRunProcesses(runId).some(p => p.pid === fakePid)).toBe(false);
    });

    it("is idempotent — double deregister does not throw", () => {
      const fakePid = nextPid();
      expect(() => { deregisterProcess(fakePid); deregisterProcess(fakePid); }).not.toThrow();
    });
  });

  describe("getOwner", () => {
    it("returns the runId that owns the PID", () => {
      const runId = makeRunId(); const pid = makeProjectId(); const fakePid = nextPid();
      registerProcess(fakePid, runId, pid);
      expect(getOwner(fakePid)).toBe(runId);
      deregisterProcess(fakePid);
    });

    it("returns undefined for unregistered PID", () => {
      expect(getOwner(999_888_777)).toBeUndefined();
    });
  });

  describe("getActiveProcess", () => {
    it("returns the running process for a run", () => {
      const runId = makeRunId(); const pid = makeProjectId(); const fakePid = nextPid();
      registerProcess(fakePid, runId, pid, 49400);
      const active = getActiveProcess(runId);
      expect(active?.pid).toBe(fakePid);
      deregisterProcess(fakePid);
    });
  });

  describe("stats", () => {
    it("returns non-negative counts", () => {
      const s = stats();
      expect(s.totalPids).toBeGreaterThanOrEqual(0);
      expect(s.activeRuns).toBeGreaterThanOrEqual(0);
    });
  });
});
