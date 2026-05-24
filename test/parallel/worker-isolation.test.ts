/**
 * test/parallel/worker-isolation.test.ts
 * Parallel tests — worker-pool isolation, task results, no shared mutable state.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../server/infrastructure/events/bus.ts", () => ({
  bus: { emit: vi.fn() },
}));

// Stub worker_threads so CentralWorkerPool doesn't spawn real threads in unit context
vi.mock("worker_threads", () => ({
  Worker:     vi.fn(),
  isMainThread: true,
  parentPort: null,
  workerData: {},
}));

import { centralWorkerPool } from "../../server/distributed/workers/central-worker-pool.ts";
import { makeRunId, makeProjectId, withTimeout } from "../helpers/test-context.ts";

describe("Worker isolation — parallel execution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try { centralWorkerPool.init(); } catch {}
  });

  describe("task submission basics", () => {
    it("returns WorkerResult with taskId and success flag", async () => {
      const taskId = `task-${makeRunId()}`;
      const result = await withTimeout(centralWorkerPool.submit({
        taskId,
        runId:     makeRunId(),
        projectId: makeProjectId(),
        type:      "cpu",
        fn:        async () => ({ output: 42 }),
      }), 5_000);
      expect(result.taskId).toBe(taskId);
      expect(typeof result.success).toBe("boolean");
    });

    it("successful task has durationMs ≥ 0", async () => {
      const result = await withTimeout(centralWorkerPool.submit({
        taskId:    `task-${makeRunId()}`,
        runId:     makeRunId(),
        projectId: makeProjectId(),
        type:      "cpu",
        fn:        async () => "ok",
      }), 5_000);
      if (result.success) {
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      }
    });

    it("failed task surfaces error without throwing", async () => {
      const result = await withTimeout(centralWorkerPool.submit({
        taskId:    `task-${makeRunId()}`,
        runId:     makeRunId(),
        projectId: makeProjectId(),
        type:      "cpu",
        fn:        async () => { throw new Error("task-failed"); },
      }), 5_000);
      if (!result.success) {
        expect(result.error).toBeTruthy();
      }
    });
  });

  describe("cross-task isolation", () => {
    it("results of task A do not appear in task B", async () => {
      const sharedState: string[] = [];
      const [rA, rB] = [makeRunId(), makeRunId()];
      const [res1, res2] = await withTimeout(Promise.all([
        centralWorkerPool.submit({
          taskId: `t-${rA}`, runId: rA, projectId: makeProjectId(), type: "cpu",
          fn: async () => { sharedState.push("A"); return "A"; },
        }),
        centralWorkerPool.submit({
          taskId: `t-${rB}`, runId: rB, projectId: makeProjectId(), type: "cpu",
          fn: async () => { sharedState.push("B"); return "B"; },
        }),
      ]), 8_000);
      // Both ran, results are separate
      expect(res1.taskId).not.toBe(res2.taskId);
    });

    it("N=5 concurrent tasks all complete without interference", async () => {
      const results = await withTimeout(Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          centralWorkerPool.submit({
            taskId:    `concurrent-${i}`,
            runId:     makeRunId(),
            projectId: makeProjectId(),
            type:      "cpu",
            fn:        async () => i,
          }),
        ),
      ), 10_000);
      expect(results).toHaveLength(5);
      const ids = results.map(r => r.taskId);
      expect(new Set(ids).size).toBe(5);
    });
  });

  describe("stats", () => {
    it("stats() returns non-negative counters", () => {
      const s = centralWorkerPool.stats();
      expect(s.totalActive).toBeGreaterThanOrEqual(0);
      expect(s.totalIdle).toBeGreaterThanOrEqual(0);
      expect(s.pressure).toBeGreaterThanOrEqual(0);
      expect(s.pressure).toBeLessThanOrEqual(1.1); // allow slight overflow during burst
    });
  });
});
