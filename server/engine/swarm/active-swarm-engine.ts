/**
 * server/engine/swarm/active-swarm-engine.ts
 *
 * Top-level Active Agent Swarm Engine.
 * Wires all 10 swarm modules: spawner → task graph → dispatcher →
 * barrier → aggregator → conflict router → verification → recovery → lifecycle.
 *
 * Single responsibility: swarm orchestration wiring only.
 */

import type { SwarmFinalResult, SwarmWaveIndex } from "./swarm-types.ts";
import { buildSwarmTaskGraph, getWaveTasks, serializeGraph } from "./swarm-task-graph.ts";
function spawnWaveAgents(_swarmId: string, _runId: string, _projectId: number, _goal: string, tasks: unknown[]): unknown[] { return tasks; }
import { dispatchWave }                from "./swarm-dispatcher.ts";
import { detectConflicts, resolveAll, getUnresolved } from "./swarm-conflict-router.ts";
import { finalCollapse }               from "./swarm-result-aggregator.ts";
import { handleAgentFailure }          from "./swarm-recovery-coordinator.ts";
import { runSwarmVerification }        from "./swarm-verification-engine.ts";
import {
  openSwarm,
  transitionPhase,
  closeSwarmSuccess,
  closeSwarmFailed,
} from "./swarm-lifecycle-manager.ts";
import {
  requireSession,
  getSession,
  tasksByWave,
  agentsByWave,
  updateTaskStatus,
} from "./swarm-state-store.ts";
import { bus } from "../../infrastructure/events/bus.ts";

let _swarmSeq = 0;
function newSwarmId(): string { return `swarm-${++_swarmSeq}-${Date.now()}`; }

// ── SwarmEngine ───────────────────────────────────────────────────────────────

export class ActiveSwarmEngine {

  /**
   * Run a full autonomous agent swarm for a goal.
   * Executes 4 waves: planning → generation → verification → merge.
   */
  async run(
    runId:     string,
    projectId: number,
    goal:      string,
  ): Promise<SwarmFinalResult> {
    const swarmId = newSwarmId();

    // 1. Open session + lifecycle
    const session = openSwarm(swarmId, runId, projectId, goal);
    transitionPhase(session, runId, projectId, "spawning");

    try {
      // 2. Build task graph for all 4 waves
      const allTasks = buildSwarmTaskGraph(swarmId, goal);
      for (const t of allTasks) {
        const { registerTask } = await import("./swarm-state-store.ts");
        registerTask(swarmId, t);
      }

      // 3. Execute waves 1 → 4 sequentially (agents within each wave run in parallel)
      const allResults = new Map<string, import("./swarm-types.ts").SwarmTaskResult>();

      for (const waveIndex of [1, 2, 3, 4] as SwarmWaveIndex[]) {
        transitionPhase(session, runId, projectId, `wave-${waveIndex}` as import("./swarm-types.ts").SwarmPhase);

        const waveTasks = getWaveTasks(allTasks, waveIndex);
        if (waveTasks.length === 0) continue;

        // Spawn wave agents
        const waveAgents = spawnWaveAgents(swarmId, runId, projectId, goal, waveTasks);

        // Dispatch wave (parallel execution + barrier wait)
        const waveResult = await dispatchWave(
          session, runId, projectId, waveTasks, waveAgents, waveIndex,
        );

        // Collect results
        for (const r of [...waveResult.succeeded, ...waveResult.failed]) {
          allResults.set(r.taskId, r);
        }

        // Detect + resolve cross-agent conflicts within this wave
        const succeededPairs = waveResult.succeeded;
        for (let i = 0; i < succeededPairs.length; i++) {
          for (let j = i + 1; j < succeededPairs.length; j++) {
            const conflicts = detectConflicts(runId, projectId, swarmId, succeededPairs[i], succeededPairs[j]);
            if (conflicts.length > 0) {
              resolveAll(runId, projectId, swarmId, allResults);
            }
          }
        }

        // Handle failed agents in this wave
        for (const failed of waveResult.failed) {
          const task  = waveTasks.find(t => t.taskId === failed.taskId);
          const agent = waveAgents.find(a => a.taskId === failed.taskId);
          if (task && agent) {
            const decision = handleAgentFailure(session, task, agent, failed.error ?? "unknown");
            if (!decision.canProceed && task.priority === "critical") {
              throw new Error(`Critical agent failure in wave ${waveIndex}: ${decision.reason}`);
            }
          }
        }

        // Publish live graph update to SSE
        this._publishGraphUpdate(runId, projectId, swarmId, allTasks);
      }

      // 4. Final merge + verification
      transitionPhase(session, runId, projectId, "merging");
      const unresolved = getUnresolved(swarmId);
      if (unresolved.length > 0) {
        resolveAll(runId, projectId, swarmId, allResults);
      }

      const finalResult = finalCollapse(session, runId, projectId);

      // 5. Run parallel verification (Wave A → B → C)
      const verif = await runSwarmVerification(session, runId, projectId, finalResult);
      if (!verif.passed) {
        throw new Error(`Swarm verification failed: ${verif.blockedReason ?? "unknown"}`);
      }

      // 6. Close swarm
      closeSwarmSuccess(session, runId, projectId, finalResult);
      return finalResult;

    } catch (err) {
      closeSwarmFailed(session, runId, projectId, String(err));
      throw err;
    }
  }

  /** Get live swarm state for a running session. */
  getState(swarmId: string) {
    const session = getSession(swarmId);
    if (!session) return null;
    const allTasks = Array.from(session.tasks.values());
    return {
      swarmId:    session.swarmId,
      phase:      session.phase,
      agents:     Array.from(session.agents.values()),
      taskGraph:  serializeGraph(allTasks),
      startedAt:  session.startedAt,
    };
  }

  private _publishGraphUpdate(
    runId:     string,
    projectId: number,
    swarmId:   string,
    tasks:     import("./swarm-types.ts").SwarmTaskNode[],
  ): void {
    bus.emit("agent.event", {
      runId, projectId,
      phase:     "swarm",
      agentName: "active-swarm-engine",
      eventType: "swarm.graph.update",
      payload:   { swarmId, graph: serializeGraph(tasks) },
      ts:        Date.now(),
    });
  }
}

export const activeSwarmEngine = new ActiveSwarmEngine();
