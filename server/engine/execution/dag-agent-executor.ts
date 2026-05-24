/**
 * dag-agent-executor.ts
 *
 * CRITICAL FIX: Subscribes to "dag.agent.execute" bus events and runs the
 * REAL agent loop to fulfill the DAG promise handshake.
 *
 * Root cause of gap (pre-fix):
 *   node-executor.ts emits "dag.agent.execute" + registers a promise in
 *   agentPromiseRegistry.  Nothing subscribed to that event → every DAG
 *   "agent" node either timed-out (fake success) or hung for 5 minutes.
 *
 * Execution contract:
 *   1.  node-executor   →  bus.emit("agent.event", { eventType: "dag.agent.execute", … })
 *   2.  THIS MODULE     →  picks up the event, calls runAgentLoop()
 *   3.  THIS MODULE     →  agentPromiseRegistry.resolve(promiseKey, result)   (or .reject)
 *   4.  node-executor   →  awaiting promise settles → DAG proceeds
 *
 * Concurrency safety:
 *   - Fire-and-forget dispatch — bus handler returns immediately.
 *   - Concurrent runs are isolated: promiseKey = runId:nodeId (unique).
 *   - AbortController per dispatch — respects per-node cancellation.
 *
 * Single responsibility: translate "dag.agent.execute" bus event → real LLM call.
 */

import { bus }                   from "../../infrastructure/events/bus.ts";
import { agentPromiseRegistry }  from "./agent-promise-registry.ts";
import { runAgentLoop }          from "../../agents/core/tool-loop/tool-loop.agent.ts";
import type { AgentLoopResult }  from "../../agents/core/tool-loop/tool-loop.agent.ts";

// ── Event shape ───────────────────────────────────────────────────────────────

interface DagAgentPayload {
  nodeId:     string;
  label:      string;
  goal:       string;
  tools?:     string[];
  promiseKey: string;
  projectId?: number;   // echoed from bus context
}

interface DagAgentBusEvent {
  runId:     string;
  projectId: number;
  phase:     string;
  agentName: string;
  eventType: string;
  payload:   DagAgentPayload;
  ts:        number;
}

// ── Telemetry helper ──────────────────────────────────────────────────────────

function emit(
  runId:     string,
  projectId: number,
  eventType: string,
  payload:   Record<string, unknown>,
): void {
  bus.emit("agent.event", {
    runId, projectId,
    phase:     "dag.agent",
    agentName: "dag-agent-executor",
    eventType,
    payload,
    ts: Date.now(),
  });
}

// ── Core executor (async, fire-and-forget from subscriber) ────────────────────

async function executeAgent(event: DagAgentBusEvent): Promise<void> {
  const { runId, projectId } = event;
  const { goal, promiseKey, nodeId, label } = event.payload;

  const t0 = Date.now();
  const ac = new AbortController();

  emit(runId, projectId, "dag.agent.started", { nodeId, label, goal: goal.slice(0, 120) });

  try {
    const result: AgentLoopResult = await runAgentLoop({
      projectId,
      runId:    `${runId}:${nodeId}`,
      goal,
      signal:   ac.signal,
      maxSteps: 25,
    });

    const durationMs = Date.now() - t0;

    emit(runId, projectId, "dag.agent.completed", {
      nodeId,
      success:    result.success,
      steps:      result.steps,
      stopReason: result.stopReason,
      durationMs,
    });

    // Resolve the DAG node promise → allows graph-engine to proceed
    agentPromiseRegistry.resolve(promiseKey, {
      success:    result.success,
      steps:      result.steps,
      summary:    result.summary,
      stopReason: result.stopReason,
      durationMs,
    });

  } catch (err: unknown) {
    const error      = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - t0;

    emit(runId, projectId, "dag.agent.failed", { nodeId, error, durationMs });

    // Reject the promise → node-executor catches and marks node as failed
    agentPromiseRegistry.reject(
      promiseKey,
      err instanceof Error ? err : new Error(error),
    );
  }
}

// ── Bus subscriber ────────────────────────────────────────────────────────────

let _wired = false;

/**
 * Wire the DAG agent executor to the bus.
 * Idempotent — safe to call multiple times.
 * Must be called during server startup (initOrchestration).
 */
export function initDagAgentExecutor(): void {
  if (_wired) return;
  _wired = true;

  bus.on("agent.event", (event: unknown) => {
    const e = event as DagAgentBusEvent;
    if (e?.eventType !== "dag.agent.execute") return;

    // Fire and forget — DAG node awaits the promise, not this call
    void executeAgent(e);
  });

  console.log("[dag-agent-executor] Wired — DAG agent nodes now dispatch to real runAgentLoop().");
}

export function isDagAgentExecutorWired(): boolean {
  return _wired;
}
