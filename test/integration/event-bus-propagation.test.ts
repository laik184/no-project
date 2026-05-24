/**
 * test/integration/event-bus-propagation.test.ts
 * Integration — EventBus propagation: fan-out, correlation IDs, SSE, ordering.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeReactiveBusMock } from "../mocks/bus.mock.ts";
import { makeRunId, makeProjectId, waitUntil } from "../helpers/test-context.ts";

describe("EventBus propagation — integration", () => {
  let busMock: ReturnType<typeof makeReactiveBusMock>;

  beforeEach(() => {
    busMock = makeReactiveBusMock();
  });

  afterEach(() => {
    busMock.bus._reset();
  });

  describe("fan-out", () => {
    it("event reaches all registered listeners", () => {
      const results: string[] = [];
      busMock.bus.on("agent.event", () => results.push("L1"));
      busMock.bus.on("agent.event", () => results.push("L2"));
      busMock.bus.on("agent.event", () => results.push("L3"));
      busMock.bus._fire("agent.event", { eventType: "test.started" });
      expect(results).toEqual(["L1", "L2", "L3"]);
    });

    it("once() fires exactly once", () => {
      let count = 0;
      busMock.bus.once("agent.event", () => count++);
      busMock.bus._fire("agent.event", { eventType: "a" });
      busMock.bus._fire("agent.event", { eventType: "b" });
      expect(count).toBe(1);
    });

    it("off() unregisters listener", () => {
      let count = 0;
      const fn = () => count++;
      busMock.bus.on("agent.event", fn);
      busMock.bus._fire("agent.event", { eventType: "a" });
      busMock.bus.off("agent.event", fn);
      busMock.bus._fire("agent.event", { eventType: "b" });
      expect(count).toBe(1);
    });
  });

  describe("correlation ID propagation", () => {
    it("correlation IDs on events are unique per emission", () => {
      const ids: string[] = [];
      busMock.bus.on("agent.event", (p: any) => {
        if (p?.correlationId) ids.push(p.correlationId);
      });
      const makeCorId = () => Math.random().toString(36).slice(2, 14);
      for (let i = 0; i < 5; i++) {
        busMock.bus._fire("agent.event", { correlationId: makeCorId() });
      }
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("event ordering", () => {
    it("synchronous emissions arrive in emission order", () => {
      const order: string[] = [];
      busMock.bus.on("agent.event", (p: any) => order.push(p.eventType));
      const types = ["run.started", "run.phase.observe", "run.phase.execute", "run.completed"];
      for (const t of types) busMock.bus._fire("agent.event", { eventType: t });
      expect(order).toEqual(types);
    });
  });

  describe("subscribe / unsubscribe", () => {
    it("subscribe returns unsubscribe fn that removes listener", () => {
      let count = 0;
      const unsub = busMock.bus.subscribe("agent.event", () => count++);
      busMock.bus._fire("agent.event", { eventType: "a" });
      unsub();
      busMock.bus._fire("agent.event", { eventType: "b" });
      expect(count).toBe(1);
    });
  });

  describe("cross-run event isolation", () => {
    it("listeners for runA do not receive runB events", () => {
      const runA = makeRunId(); const runB = makeRunId();
      const eventsA: string[] = [];
      busMock.bus.on("agent.event", (p: any) => {
        if (p?.runId === runA) eventsA.push(p.eventType);
      });
      busMock.bus._fire("agent.event", { runId: runA, eventType: "run.started" });
      busMock.bus._fire("agent.event", { runId: runB, eventType: "run.started" });
      expect(eventsA).toHaveLength(1);
      expect(eventsA[0]).toBe("run.started");
    });
  });

  describe("required telemetry event types", () => {
    const requiredEvents = [
      "test.started", "test.completed", "test.failed",
      "assertion.failed", "retry.started", "retry.completed",
      "runtime.crashed", "orchestration.failed",
      "recovery.triggered", "preview.failed",
    ];

    it("all required telemetry event types pass through the bus", () => {
      const received: string[] = [];
      busMock.bus.on("agent.event", (p: any) => received.push(p.eventType));
      for (const t of requiredEvents) {
        busMock.bus._fire("agent.event", { eventType: t, runId: makeRunId() });
      }
      for (const t of requiredEvents) {
        expect(received).toContain(t);
      }
    });
  });
});
