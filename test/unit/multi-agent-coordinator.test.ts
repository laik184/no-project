/**
 * test/unit/multi-agent-coordinator.test.ts  — P4 Test Infrastructure
 *
 * Unit tests for MultiAgentCoordinator — parallel/sequential dispatch + barrier.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../server/infrastructure/events/bus.ts", () => ({
  bus: { emit: vi.fn() },
}));

vi.mock("../../server/distributed/workers/central-worker-pool.ts", () => ({
  centralWorkerPool: {
    submit: vi.fn().mockImplementation(async (task: any) => {
      const output = await task.fn();
      return { success: true, output };
    }),
  },
}));

import { MultiAgentCoordinator, type AgentTask } from "../../server/agents/coordination/multi-agent-coordinator.ts";

const makeTask = (id: string, fn: () => Promise<unknown>): AgentTask => ({
  agentId: id, agentName: `agent-${id}`, fn: async () => fn(),
  input: null,
});

describe("MultiAgentCoordinator", () => {
  let coordinator: MultiAgentCoordinator;

  beforeEach(() => { coordinator = new MultiAgentCoordinator(); });

  it("parallel dispatch — all succeed → ok=true, successRate=1", async () => {
    const tasks = [
      makeTask("a", async () => "result-a"),
      makeTask("b", async () => "result-b"),
    ];
    const result = await coordinator.dispatch(tasks, "run-001", 1, { mode: "parallel" });
    expect(result.ok).toBe(true);
    expect(result.successRate).toBe(1);
    expect(result.succeeded).toHaveLength(2);
    expect(result.failed).toHaveLength(0);
  });

  it("captures failed tasks without throwing", async () => {
    const tasks = [
      makeTask("ok",   async () => "fine"),
      makeTask("fail", async () => { throw new Error("agent exploded"); }),
    ];
    const { centralWorkerPool } = await import("../../server/distributed/workers/central-worker-pool.ts");
    (centralWorkerPool.submit as any).mockImplementationOnce(async (task: any) => {
      const output = await task.fn(); return { success: true, output };
    }).mockImplementationOnce(async (task: any) => {
      try { await task.fn(); } catch {}
      return { success: false, error: "agent exploded" };
    });

    const result = await coordinator.dispatch(tasks, "run-002", 1, { mode: "parallel" });
    expect(result.ok).toBe(false);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].agentId).toBe("fail");
  });

  it("sequential dispatch preserves order", async () => {
    const order: string[] = [];
    const tasks = ["x", "y", "z"].map(id =>
      makeTask(id, async () => { order.push(id); return id; }),
    );
    await coordinator.dispatch(tasks, "run-003", 1, { mode: "sequential" });
    expect(order).toEqual(["x", "y", "z"]);
  });

  it("barrier returns ok=true when all promises resolve true", async () => {
    const result = await coordinator.barrier(
      [Promise.resolve(true), Promise.resolve(true)],
      5_000,
    );
    expect(result.ok).toBe(true);
    expect(result.timedOut).toBe(false);
  });
});
