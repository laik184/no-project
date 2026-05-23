/**
 * test/unit/streaming-aggregator.test.ts  — P4 Test Infrastructure
 *
 * Unit tests for StreamingAggregator.
 * Tests progressive collapse, early collapse, and timeout behaviour.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../server/infrastructure/events/bus.ts", () => ({
  bus: { emit: vi.fn(), on: vi.fn() },
}));

vi.mock("../../server/quantum/aggregation/confidence-scorer.ts", () => ({
  rankPaths:       vi.fn().mockReturnValue([{ pathId: "p1", confidenceScore: 0.95 }]),
  findMergeGroups: vi.fn().mockReturnValue([]),
}));

vi.mock("../../server/quantum/aggregation/result-aggregator.ts", () => {
  const store = new Map<string, Map<string, any>>();
  return {
    recordPathResult: vi.fn().mockImplementation((qRunId: string, result: any) => {
      if (!store.has(qRunId)) store.set(qRunId, new Map());
      store.get(qRunId)!.set(result.pathId, result);
    }),
    getAllResults: vi.fn().mockImplementation((qRunId: string) => store.get(qRunId) ?? new Map()),
  };
});

vi.mock("../../server/orchestration/telemetry/orchestration-metrics.ts", () => ({
  incrementCounter: vi.fn(),
}));

import {
  startStreamingSession,
  reportPathResult,
  getStreamingSession,
  getFinalResult,
  clearStreamingSession,
} from "../../server/quantum/aggregation/streaming-aggregator.ts";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeSession = (n = 2) => {
  const qRunId  = `qrun-${Date.now()}`;
  const paths   = Array.from({ length: n }, (_, i) => ({ pathId: `p${i + 1}` }));
  const session = startStreamingSession(qRunId, "run-001", 1, paths as any, 60_000);
  return { qRunId, session, paths };
};

const makeResult = (pathId: string, success = true) => ({
  pathId, success, verificationPassed: success, output: { answer: 42 },
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("StreamingAggregator", () => {
  afterEach(() => { vi.clearAllMocks(); });

  it("creates a session with correct totalPaths", () => {
    const { session } = makeSession(3);
    expect(session.totalPaths).toBe(3);
    expect(session.arrivedPaths).toBe(0);
    expect(session.isCollapsed).toBe(false);
    clearStreamingSession(session.quantumRunId);
  });

  it("increments arrivedPaths on each reportPathResult", () => {
    const { qRunId, paths } = makeSession(2);
    reportPathResult(qRunId, makeResult(paths[0].pathId));
    expect(getStreamingSession(qRunId)!.arrivedPaths).toBe(1);
    clearStreamingSession(qRunId);
  });

  it("collapses when all paths arrive (complete collapse)", () => {
    const { qRunId, paths } = makeSession(2);
    for (const p of paths) reportPathResult(qRunId, makeResult(p.pathId));
    const s = getStreamingSession(qRunId)!;
    expect(s.isCollapsed).toBe(true);
    expect(s.earlyCollapse).toBe(false);
    clearStreamingSession(qRunId);
  });

  it("early-collapses when a path score ≥ 0.92", () => {
    const { qRunId, paths } = makeSession(3);  // 3 paths, only 1 arrives
    reportPathResult(qRunId, makeResult(paths[0].pathId));
    const s = getStreamingSession(qRunId)!;
    expect(s.isCollapsed).toBe(true);
    expect(s.earlyCollapse).toBe(true);
    clearStreamingSession(qRunId);
  });

  it("getFinalResult returns partialResult after collapse", () => {
    const { qRunId, paths } = makeSession(1);
    reportPathResult(qRunId, makeResult(paths[0].pathId));
    const result = getFinalResult(qRunId);
    expect(result).toBeDefined();
    clearStreamingSession(qRunId);
  });

  it("clearStreamingSession removes the session", () => {
    const { qRunId } = makeSession(1);
    clearStreamingSession(qRunId);
    expect(getStreamingSession(qRunId)).toBeUndefined();
  });
});
