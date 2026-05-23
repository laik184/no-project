/**
 * test/unit/parallel-verification-engine.test.ts  — P4 Test Infrastructure
 *
 * Unit tests for ParallelVerificationEngine.
 * Tests wave structure, barrier semantics, and fail-closed behaviour.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../../server/infrastructure/events/bus.ts", () => ({
  bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

vi.mock("../../server/fail-closed/verifiers/static-verifier.ts", () => ({
  StaticVerifier: vi.fn().mockImplementation(() => ({
    verify: vi.fn().mockResolvedValue({ passed: true, evidence: ["no lint errors"], stage: "STATIC" }),
  })),
}));

vi.mock("../../server/fail-closed/verifiers/build-verifier.ts", () => ({
  BuildVerifier: vi.fn().mockImplementation(() => ({
    verify: vi.fn().mockResolvedValue({ passed: true, evidence: ["build ok"], stage: "BUILD" }),
  })),
}));

vi.mock("../../server/fail-closed/verifiers/runtime-verifier.ts", () => ({
  RuntimeVerifier: vi.fn().mockImplementation(() => ({
    verify: vi.fn().mockResolvedValue({ passed: true, evidence: ["port 3000 open"], stage: "RUNTIME" }),
  })),
}));

vi.mock("../../server/fail-closed/verifiers/preview-verifier.ts", () => ({
  PreviewVerifier: vi.fn().mockImplementation(() => ({
    verify: vi.fn().mockResolvedValue({ passed: true, evidence: ["preview 200 OK"], stage: "PREVIEW" }),
  })),
}));

vi.mock("../../server/fail-closed/verifiers/state-reconciler.ts", () => ({
  StateReconciler: vi.fn().mockImplementation(() => ({
    verify: vi.fn().mockReturnValue({ passed: true, evidence: ["state ok"], stage: "STATE_RECONCILIATION" }),
  })),
}));

import { ParallelVerificationEngine } from "../../server/fail-closed/parallel/parallel-verification-engine.ts";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseOpts = {
  runId: "test-run-001",
  projectId: 1,
  workspacePath: "/tmp/test-workspace",
  port: 3000,
  previewUrl: "http://localhost:3000",
};

const baseProposal = { completionSummary: "All done", filesSaved: [], testsRun: 0 };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ParallelVerificationEngine", () => {
  let engine: ParallelVerificationEngine;

  beforeEach(() => { engine = new ParallelVerificationEngine(); });

  it("returns ok=true when all waves pass", async () => {
    const result = await engine.run(baseOpts as any, baseProposal as any);
    expect(result.ok).toBe(true);
    expect(result.waveResults).toHaveLength(3);
    expect(result.waveResults.every(w => w.passed)).toBe(true);
  });

  it("runs Wave A stages in parallel (A has 2 stages)", async () => {
    const result = await engine.run(baseOpts as any, baseProposal as any);
    const waveA = result.waveResults.find(w => w.wave === "A");
    expect(waveA?.stages).toContain("STATIC");
    expect(waveA?.stages).toContain("BUILD");
  });

  it("runs Wave B stages in parallel (B has 2 stages)", async () => {
    const result = await engine.run(baseOpts as any, baseProposal as any);
    const waveB = result.waveResults.find(w => w.wave === "B");
    expect(waveB?.stages).toContain("RUNTIME");
    expect(waveB?.stages).toContain("PREVIEW");
  });

  it("Wave C is sequential state reconciliation", async () => {
    const result = await engine.run(baseOpts as any, baseProposal as any);
    const waveC = result.waveResults.find(w => w.wave === "C");
    expect(waveC?.stages).toContain("STATE_RECONCILIATION");
  });

  it("halts at Wave A if STATIC fails (fail-closed)", async () => {
    const { StaticVerifier } = await import("../../server/fail-closed/verifiers/static-verifier.ts");
    (StaticVerifier as any).mockImplementationOnce(() => ({
      verify: vi.fn().mockResolvedValue({ passed: false, evidence: ["lint error"], stage: "STATIC", failureReason: "lint" }),
    }));
    const result = await engine.run(baseOpts as any, baseProposal as any);
    expect(result.ok).toBe(false);
    expect(result.failedWave).toBe("A");
    expect(result.waveResults.find(w => w.wave === "B")).toBeUndefined();
    expect(result.waveResults.find(w => w.wave === "C")).toBeUndefined();
  });

  it("records durationMs for each wave", async () => {
    const result = await engine.run(baseOpts as any, baseProposal as any);
    for (const wave of result.waveResults) {
      expect(wave.durationMs).toBeGreaterThanOrEqual(0);
    }
  });
});
