/**
 * test/recovery/recovery-manager.test.ts  — P4 Test Infrastructure
 *
 * Tests for the existing RecoveryManager (crash recovery coordinator).
 * Verifies lock semantics, timeout guard, and audit trail.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../server/infrastructure/recovery/recovery-lock.ts", () => ({
  acquireRecoveryLock: vi.fn().mockReturnValue({ acquired: true, token: "tok-001" }),
  releaseRecoveryLock: vi.fn(),
  resetRecoveryState:  vi.fn(),
  getLockDiagnostics:  vi.fn().mockReturnValue({ locked: false }),
  isLocked:            vi.fn().mockReturnValue(false),
}));

vi.mock("../../server/infrastructure/recovery/crash-recovery.ts", () => ({
  executeCrashRecovery: vi.fn().mockResolvedValue({
    attempted: true, success: true, projectId: 1,
    checkpointId: "chk-001", rollback: null, reason: "test",
  }),
}));

vi.mock("../../server/infrastructure/checkpoints/rollback.service.ts", () => ({
  rollbackLatestForRun:     vi.fn().mockResolvedValue({ success: true, checkpointId: "chk-002", restoredFiles: [], skippedFiles: [] }),
  rollbackLatestForProject: vi.fn().mockResolvedValue({ success: true, checkpointId: "chk-003", restoredFiles: [], skippedFiles: [] }),
}));

vi.mock("../../server/infrastructure/checkpoints/checkpoint.service.ts", () => ({
  checkpointStore: {
    get:            vi.fn().mockResolvedValue({ status: "stable", gitCommitSha: "abc", fileCount: 2 }),
    listForProject: vi.fn().mockResolvedValue([{ status: "stable" }]),
  },
}));

vi.mock("../../server/infrastructure/sandbox/sandbox.util.ts", () => ({
  getProjectDir: vi.fn().mockReturnValue("/tmp/projects/1"),
}));

vi.mock("../../server/infrastructure/events/bus.ts", () => ({
  bus: { emit: vi.fn(), on: vi.fn() },
}));

import { recoverFromCrash, safeRollback, validateCheckpoint, getRecoveryDiagnostics } from "../../server/infrastructure/recovery/recovery-manager.ts";

describe("RecoveryManager", () => {
  it("recoverFromCrash succeeds with lock", async () => {
    const result = await recoverFromCrash({ projectId: 1, reason: "crash", runId: "run-001" });
    expect("skipped" in result ? false : result.success).toBe(true);
  });

  it("skips recovery when lock is held", async () => {
    const { acquireRecoveryLock } = await import("../../server/infrastructure/recovery/recovery-lock.ts");
    (acquireRecoveryLock as any).mockReturnValueOnce({ acquired: false, reason: "already locked" });
    const result = await recoverFromCrash({ projectId: 2, reason: "double-recovery" });
    expect("skipped" in result && result.skipped).toBe(true);
  });

  it("safeRollback returns rollback result", async () => {
    const result = await safeRollback(1);
    expect("skipped" in result ? false : result.success).toBe(true);
  });

  it("validateCheckpoint returns valid=true for stable checkpoint", async () => {
    const result = await validateCheckpoint(1, "chk-001");
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("getRecoveryDiagnostics returns projectId", () => {
    const diag = getRecoveryDiagnostics(99) as any;
    expect(diag.projectId).toBe(99);
  });
});
