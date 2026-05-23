/**
 * Responsibility: Phase 9 — Wires ALL distributed systems into the orchestration,
 *                 quantum, and agent layers. Single entry point called at startup
 *                 to connect distributed infrastructure to execution pipelines.
 * Dependencies: all distributed subsystems, orchestration, quantum
 * Failure: individual wiring failures are logged; execution degrades gracefully.
 * Telemetry: emits wiring completion events via bus.
 */

import { centralWorkerPool }      from "../workers/central-worker-pool.ts";
import { distributedQueue }       from "../queue/distributed-queue.ts";
import { distributedLockManager } from "../locks/distributed-lock-manager.ts";
import { distributedEventBus }    from "../events/distributed-event-bus.ts";
import { distributedMemoryQueue } from "../memory/distributed-memory-queue.ts";
import { distributedTelemetry }   from "../telemetry/distributed-telemetry.ts";
import { distributedValidator }   from "../validation/distributed-validator.ts";
import { isRedisAvailable }       from "../redis/index.ts";
import { bus }                    from "../../infrastructure/events/bus.ts";

export interface WiringReport {
  timestamp:    number;
  backend:      "redis" | "in-process";
  wired:        string[];
  failed:       string[];
  readinessPct: number;
}

class DistributedOrchestrationWiring {
  private report: WiringReport | null = null;

  /**
   * Wire all distributed systems into the orchestration layer.
   * Called once from initOrchestration() after all subsystems are initialized.
   */
  async wire(): Promise<WiringReport> {
    const wired:  string[] = [];
    const failed: string[] = [];
    const backend = isRedisAvailable() ? "redis" : "in-process";

    // 1. Wire orchestration → distributed queue
    await this.safeWire("orchestration→distributed-queue", async () => {
      const stats = await distributedQueue.stats();
      console.log(`[wiring] Distributed queue ready — waiting=${stats.waiting}`);
    }, wired, failed);

    // 2. Wire quantum engine → central worker pool
    await this.safeWire("quantum→central-worker-pool", async () => {
      centralWorkerPool.init();
      const stats = centralWorkerPool.stats();
      console.log(`[wiring] CentralWorkerPool ready — pressure=${stats.pressure}%`);
    }, wired, failed);

    // 3. Wire agents → distributed locks
    await this.safeWire("agents→distributed-locks", async () => {
      distributedLockManager.init();
      const health = distributedLockManager.health();
      console.log(`[wiring] DistributedLockManager ready — backend=${health.backend}`);
    }, wired, failed);

    // 4. Wire runtime → distributed event bus
    await this.safeWire("runtime→distributed-event-bus", async () => {
      const busStats = distributedEventBus.stats();
      console.log(`[wiring] DistributedEventBus ready — started=${busStats.started}`);
    }, wired, failed);

    // 5. Wire memory writes → distributed memory queue
    await this.safeWire("memory→distributed-memory-queue", async () => {
      const memStats = distributedMemoryQueue.stats();
      console.log(`[wiring] DistributedMemoryQueue ready — lanes=${memStats.activeLanes}`);
    }, wired, failed);

    // 6. Wire telemetry correlation
    await this.safeWire("telemetry→correlation-ids", async () => {
      const snap = distributedTelemetry.snapshot();
      console.log(`[wiring] DistributedTelemetry ready — activeSpans=${snap.activeSpans}`);
    }, wired, failed);

    // 7. Wire validation gates
    await this.safeWire("validation→fail-closed-gates", async () => {
      const testResult = await distributedValidator.validateExecution("wiring-check", 0);
      if (!testResult.passed) {
        const criticalErrors = testResult.errors.filter(e => !e.includes("capacity"));
        if (criticalErrors.length > 0) throw new Error(criticalErrors.join("; "));
      }
      console.log(`[wiring] DistributedValidator ready — gates active`);
    }, wired, failed);

    const readinessPct = Math.round((wired.length / (wired.length + failed.length)) * 100);

    this.report = { timestamp: Date.now(), backend, wired, failed, readinessPct };

    bus.emit("agent.event", {
      runId: "system", projectId: 0,
      phase: "distributed.wiring",
      agentName: "orchestration-wiring",
      eventType: failed.length === 0 ? "agent.completed" : "agent.failed",
      payload: { wired, failed, readinessPct, backend },
      ts: Date.now(),
    });

    console.log(`[distributed-wiring] ✓ ${wired.length} systems wired (${readinessPct}% readiness) — backend=${backend}`);
    if (failed.length > 0) console.warn(`[distributed-wiring] ⚠ Failed: ${failed.join(", ")}`);

    return this.report;
  }

  getReport(): WiringReport | null { return this.report; }

  private async safeWire(
    name:   string,
    fn:     () => Promise<void>,
    wired:  string[],
    failed: string[],
  ): Promise<void> {
    try { await fn(); wired.push(name); }
    catch (err) { failed.push(name); console.error(`[wiring] Failed "${name}":`, (err as Error).message); }
  }
}

export const distributedOrchestrationWiring = new DistributedOrchestrationWiring();
