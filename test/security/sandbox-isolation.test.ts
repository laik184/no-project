/**
 * test/security/sandbox-isolation.test.ts
 * Security tests — cross-run env isolation, PID ownership, file lock ownership.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../server/infrastructure/events/bus.ts", () => ({
  bus: {
    emit:      vi.fn(),
    on:        vi.fn().mockReturnValue(undefined),
    off:       vi.fn(),
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

vi.mock("fs/promises", () => ({
  default: {
    mkdir:   vi.fn().mockResolvedValue(undefined),
    rm:      vi.fn().mockResolvedValue(undefined),
    access:  vi.fn().mockResolvedValue(undefined),
    stat:    vi.fn().mockResolvedValue({ isDirectory: () => true }),
  },
}));

import {
  provisionSandbox, getSandboxScope, setSandboxEnv, getSandboxEnv,
  registerPid, deregisterPid, teardownSandbox,
} from "../../server/runtime/isolation/sandbox-isolation-manager.ts";
import { fileLockManager } from "../../server/quantum/locks/index.ts";
import { makeRunId, makeProjectId } from "../helpers/test-context.ts";

const BASE = ".sandbox-sec-test";

describe("Sandbox isolation — security", () => {
  let runId: string;
  let pid:   number;

  beforeEach(() => {
    runId = makeRunId("sec");
    pid   = makeProjectId();
  });

  describe("cross-run environment isolation", () => {
    it("env vars in scope A do not leak into scope B", async () => {
      const runB = makeRunId("sec-b");
      await provisionSandbox(runId, pid,     BASE);
      await provisionSandbox(runB,  pid + 1, BASE);
      setSandboxEnv(runId, "SECRET_A", "hunter2");
      const envB = getSandboxEnv(runB);
      expect(envB.SECRET_A).toBeUndefined();
      await teardownSandbox(runId); await teardownSandbox(runB);
    });

    it("PID tracking is isolated per scope", async () => {
      const runB = makeRunId("sec-pid-b");
      await provisionSandbox(runId, pid,     BASE);
      await provisionSandbox(runB,  pid + 1, BASE);
      registerPid(runId, 91001);
      const scopeB = getSandboxScope(runB);
      expect(scopeB?.ownedPids.has(91001)).toBe(false);
      await teardownSandbox(runId); await teardownSandbox(runB);
    });

    it("two runs have distinct project dirs", async () => {
      const runB = makeRunId("sec-dir-b");
      await provisionSandbox(runId, pid,     BASE);
      await provisionSandbox(runB,  pid + 1, BASE);
      const sA = getSandboxScope(runId);
      const sB = getSandboxScope(runB);
      expect(sA?.projectDir).not.toBe(sB?.projectDir);
      await teardownSandbox(runId); await teardownSandbox(runB);
    });
  });

  describe("scope teardown", () => {
    it("teardownSandbox removes scope from registry", async () => {
      await provisionSandbox(runId, pid, BASE);
      registerPid(runId, 88001);
      await teardownSandbox(runId);
      expect(getSandboxScope(runId)).toBeUndefined();
    });
  });

  describe("env var management", () => {
    it("setSandboxEnv / getSandboxEnv round-trip", async () => {
      await provisionSandbox(runId, pid, BASE);
      setSandboxEnv(runId, "MY_KEY", "my-value");
      const env = getSandboxEnv(runId);
      expect(env.MY_KEY).toBe("my-value");
      await teardownSandbox(runId);
    });
  });

  describe("file lock ownership enforcement", () => {
    it("assertWriteAllowed does not throw for owner", async () => {
      const path   = `/sandbox/sec-write-${Date.now()}.txt`;
      const result = await fileLockManager.acquire(path, runId, runId);
      expect(() => fileLockManager.assertWriteAllowed(path, runId)).not.toThrow();
      fileLockManager.release(result.lockId!, runId);
    });

    it("non-owner is blocked from writing to locked path", async () => {
      const path     = `/sandbox/sec-block-${Date.now()}.txt`;
      const intruder = makeRunId();
      const result   = await fileLockManager.acquire(path, runId, runId);
      expect(() => fileLockManager.assertWriteAllowed(path, intruder)).toThrow();
      fileLockManager.release(result.lockId!, runId);
    });

    it("10 concurrent lock attempts — exactly one wins per path", async () => {
      const path    = `/sandbox/sec-10-${Date.now()}.txt`;
      const runners = Array.from({ length: 10 }, () => makeRunId());
      const settled = await Promise.allSettled(
        runners.map(r => fileLockManager.acquire(path, r, r)),
      );
      const successes = settled.filter(r => r.status === "fulfilled" && r.value.success);
      expect(successes).toHaveLength(1);
      const winnerIdx = settled.findIndex(r => r.status === "fulfilled" && (r as any).value.success);
      const lockId    = (settled[winnerIdx] as PromiseFulfilledResult<any>).value.lockId;
      fileLockManager.release(lockId, runners[winnerIdx]);
    });
  });

  describe("PID registration", () => {
    it("registerPid / deregisterPid manage ownership", async () => {
      await provisionSandbox(runId, pid, BASE);
      registerPid(runId, 77001);
      const scope = getSandboxScope(runId);
      expect(scope?.ownedPids.has(77001)).toBe(true);
      deregisterPid(runId, 77001);
      expect(scope?.ownedPids.has(77001)).toBe(false);
      await teardownSandbox(runId);
    });
  });
});
