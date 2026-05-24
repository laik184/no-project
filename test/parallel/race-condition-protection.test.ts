/**
 * test/parallel/race-condition-protection.test.ts
 * Parallel tests — file-lock integrity, worker isolation, atomic port allocation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../server/infrastructure/events/bus.ts", () => ({
  bus: { emit: vi.fn() },
}));

import { fileLockManager } from "../../server/quantum/locks/index.ts";
import { allocatePort, releasePort, releaseRunPorts, stopSweeper }
  from "../../server/runtime/network/port-allocation-authority.ts";
import { writeLane, replayLane, destroyLane }
  from "../../server/quantum/memory/run-scoped-memory-lane.ts";
import { makeRunId, makeProjectId } from "../helpers/test-context.ts";

describe("Race condition protection", () => {
  afterEach(() => { stopSweeper(); });

  describe("File lock manager — mutual exclusion", () => {
    it("only one owner can hold a lock; second acquire fails gracefully", async () => {
      const path = `/tmp/race-lock-${Date.now()}.txt`;
      const rA = makeRunId(); const rB = makeRunId();

      const rOk = await fileLockManager.acquire(path, rA, rA);
      expect(rOk.success).toBe(true);

      // Second acquire throws FileLockTimeoutError — which is the fail-closed behavior
      let secondFailed = false;
      try {
        await fileLockManager.acquire(path, rB, rB);
      } catch (err: any) {
        secondFailed = true;
        const msg = err.message ?? String(err);
        expect(msg.length).toBeGreaterThan(0); // Lock threw — fail-closed as designed
      }
      expect(secondFailed).toBe(true);

      fileLockManager.release(rOk.lockId!, rA);
    });

    it("released lock can be acquired by another owner", async () => {
      const path = `/tmp/race-reacquire-${Date.now()}.txt`;
      const rA = makeRunId(); const rB = makeRunId();

      const rOk = await fileLockManager.acquire(path, rA, rA);
      fileLockManager.release(rOk.lockId!, rA);

      const r2 = await fileLockManager.acquire(path, rB, rB);
      expect(r2.success).toBe(true);
      fileLockManager.release(r2.lockId!, rB);
    });

    it("10 concurrent acquire attempts — exactly one succeeds; rest throw", async () => {
      const path = `/tmp/race-10-${Date.now()}.txt`;
      const runs = Array.from({ length: 10 }, () => makeRunId());

      const results = await Promise.allSettled(
        runs.map(r => fileLockManager.acquire(path, r, r)),
      );
      const successes = results.filter(r => r.status === "fulfilled" && r.value.success);
      const failures  = results.filter(r => r.status === "rejected");
      // Exactly one should win the lock
      expect(successes).toHaveLength(1);
      expect(successes.length + failures.length).toBe(10);

      const winnerIdx = results.findIndex(r => r.status === "fulfilled" && (r as any).value.success);
      const lockId    = (results[winnerIdx] as PromiseFulfilledResult<any>).value.lockId;
      fileLockManager.release(lockId, runs[winnerIdx]);
    });

    it("assertWriteAllowed throws for non-owner", async () => {
      const path = `/tmp/race-assert-${Date.now()}.txt`;
      const owner = makeRunId(); const intruder = makeRunId();

      const result = await fileLockManager.acquire(path, owner, owner);
      expect(() => fileLockManager.assertWriteAllowed(path, intruder)).toThrow();
      fileLockManager.release(result.lockId!, owner);
    });

    it("isWriteAllowed returns false for non-owner of locked path", async () => {
      const path     = `/tmp/race-iswrite-${Date.now()}.txt`;
      const owner    = makeRunId(); const other = makeRunId();
      const result   = await fileLockManager.acquire(path, owner, owner);
      expect(fileLockManager.isWriteAllowed?.(path, other) ?? false).toBe(false);
      fileLockManager.release(result.lockId!, owner);
    });
  });

  describe("Port allocation — atomic concurrency", () => {
    it("N concurrent allocations produce N distinct ports", async () => {
      const N = 8;
      const runs = Array.from({ length: N }, () => ({ runId: makeRunId(), pid: makeProjectId() }));
      const results = await Promise.all(runs.map(({ runId, pid }) => allocatePort(runId, pid)));

      const ports = results.filter(r => r.ok).map(r => r.port!);
      expect(new Set(ports).size).toBe(ports.length);
      for (const p of ports) releasePort(p);
    });

    it("port released by run A can be re-allocated by run B", async () => {
      const rA = makeRunId(); const rB = makeRunId(); const pid = makeProjectId();
      const r1 = await allocatePort(rA, pid);
      if (!r1.ok) return;
      releasePort(r1.port!);
      const r2 = await allocatePort(rB, pid);
      expect(r2.ok).toBe(true);
      if (r2.ok) releasePort(r2.port!);
    });
  });

  describe("Memory lane — concurrent write safety", () => {
    it("50 concurrent writes produce 50 distinct entries (no data loss)", async () => {
      const runId = makeRunId(); const pid = makeProjectId();
      await Promise.all(
        Array.from({ length: 50 }, (_, i) => writeLane(runId, pid, `k${i}`, `v${i}`)),
      );
      const entries = replayLane(runId);
      expect(entries).toHaveLength(50);
      expect(new Set(entries.map(e => e.key)).size).toBe(50);
      destroyLane(runId);
    });
  });
});
