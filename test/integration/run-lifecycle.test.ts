/**
 * test/integration/run-lifecycle.test.ts
 * Integration — full run lifecycle: envelope → orchestrator → memory → telemetry → teardown.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../server/infrastructure/events/bus.ts", () => ({
  bus: { emit: vi.fn(), on: vi.fn(), subscribe: vi.fn().mockReturnValue(() => {}) },
}));

vi.mock("../../server/runtime/network/port-allocation-authority.ts", () => ({
  allocatePort:    vi.fn().mockResolvedValue({ ok: true, port: 49500 }),
  releaseRunPorts: vi.fn(),
  releasePort:     vi.fn(),
  isPortReserved:  vi.fn().mockReturnValue(false),
  stopSweeper:     vi.fn(),
}));

import { createEnvelope, terminateEnvelope }         from "../../server/distributed/isolation/run-isolation-fabric.ts";
import { RunScopedOrchestrator }                      from "../../server/orchestration/distributed/run-scoped-orchestrator.ts";
import { RunTelemetryChannel }                        from "../../server/telemetry/run-scoped/run-telemetry-channel.ts";
import { writeLane, readLane, replayLane, destroyLane } from "../../server/quantum/memory/run-scoped-memory-lane.ts";
import { makeRunId, makeProjectId }                   from "../helpers/test-context.ts";
import { bus }                                        from "../../server/infrastructure/events/bus.ts";

describe("Run lifecycle integration", () => {
  let runId: string;
  let pid:   number;
  let tel:   RunTelemetryChannel | undefined;

  beforeEach(() => {
    runId = makeRunId("lifecycle");
    pid   = makeProjectId();
    tel   = undefined;
    (bus.emit as any).mockClear();
  });

  afterEach(() => {
    try { tel?.destroy(); } catch {}
  });

  it("full lifecycle: create → orchestrate → memory → telemetry → complete → teardown", async () => {
    const env  = createEnvelope(runId, pid);
    expect(env.status).toBe("active");

    const orch = new RunScopedOrchestrator(runId, pid);
    orch.transition("observe");
    orch.transition("plan");
    orch.transition("execute");

    tel = new RunTelemetryChannel(runId, pid);
    tel.emit("run.execute.started", "execute", { phase: "execute" });

    await writeLane(runId, pid, "goal",  "Build todo app");
    await writeLane(runId, pid, "model", "openai/gpt-4o");

    orch.transition("complete");
    tel.emit("run.completed", "complete", { score: 0.95 });

    tel.destroy();
    tel = undefined;
    terminateEnvelope(runId);
    destroyLane(runId);

    expect(env.status).toBe("terminated");
    expect(orch.phase).toBe("complete");

    const emittedTypes = (bus.emit as any).mock.calls
      .filter(([e]: [string]) => e === "agent.event")
      .map(([, p]: [string, any]) => p?.eventType);
    expect(emittedTypes).toContain("run.isolated");
    expect(emittedTypes).toContain("run.started");
    expect(emittedTypes).toContain("run.completed");
  });

  it("failure lifecycle: create → execute → crash → recover → fail", async () => {
    const env  = createEnvelope(runId, pid);
    const orch = new RunScopedOrchestrator(runId, pid);
    tel = new RunTelemetryChannel(runId, pid);

    orch.transition("execute");
    tel.emit("runtime.crashed", "execute", { reason: "OOM" });
    orch.recover("OOM");
    expect(orch.phase).toBe("recovering");

    orch.fail("unrecoverable");
    expect(orch.phase).toBe("failed");

    tel.destroy();
    tel = undefined;
    terminateEnvelope(runId);
    expect(env.status).toBe("terminated");
  });

  it("memory persists through orchestration phases", async () => {
    const orch = new RunScopedOrchestrator(runId, pid);
    orch.transition("observe");
    await writeLane(runId, pid, "observation", "dependencies-outdated");
    orch.transition("plan");
    await writeLane(runId, pid, "plan", "update-deps");
    orch.transition("execute");
    await writeLane(runId, pid, "result", "success");
    orch.transition("complete");

    const entries = replayLane(runId);
    expect(entries).toHaveLength(3);
    expect(entries.map(e => e.key)).toEqual(["observation","plan","result"]);
    destroyLane(runId);
  });

  it("two concurrent runs maintain isolation throughout lifecycle", async () => {
    const [rA, rB] = [makeRunId("iso-a"), makeRunId("iso-b")];
    const [pA, pB] = [makeProjectId(), makeProjectId()];

    const envA  = createEnvelope(rA, pA);
    const envB  = createEnvelope(rB, pB);
    const orchA = new RunScopedOrchestrator(rA, pA);
    const orchB = new RunScopedOrchestrator(rB, pB);

    orchA.transition("observe");
    orchB.transition("plan");

    await writeLane(rA, pA, "data", "from-A");
    await writeLane(rB, pB, "data", "from-B");

    expect(orchA.phase).toBe("observe");
    expect(orchB.phase).toBe("plan");
    expect(readLane(rA, "data")?.value).toBe("from-A");
    expect(readLane(rB, "data")?.value).toBe("from-B");

    orchA.transition("complete");
    orchB.fail("test-teardown");

    terminateEnvelope(rA);
    terminateEnvelope(rB);
    destroyLane(rA);
    destroyLane(rB);

    expect(envA.status).toBe("terminated");
    expect(envB.status).toBe("terminated");
  });
});
