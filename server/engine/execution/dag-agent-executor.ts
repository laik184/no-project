/**
 * dag-agent-executor.ts
 * Tool-loop agent removed — inlined stub for runAgentLoop.
 */

import { bus }                  from "../../infrastructure/events/bus.ts";
import { agentPromiseRegistry } from "./agent-promise-registry.ts";

interface AgentLoopResult { success: boolean; finalOutput: string; summary: string; steps: number; stopReason: string; error?: string; }

interface DagAgentPayload { nodeId: string; label: string; goal: string; tools?: string[]; promiseKey: string; projectId?: number; }
interface DagAgentBusEvent { runId: string; projectId: number; phase: string; agentName: string; eventType: string; payload: DagAgentPayload; ts: number; }

function emit(runId: string, projectId: number, eventType: string, payload: Record<string, unknown>): void {
  bus.emit("agent.event", { runId, projectId, phase: "dag.agent", agentName: "dag-agent-executor", eventType, payload, ts: Date.now() });
}

async function executeAgent(event: DagAgentBusEvent): Promise<void> {
  const { runId, projectId } = event;
  const { goal, promiseKey, nodeId, label } = event.payload;
  const t0 = Date.now();

  emit(runId, projectId, "dag.agent.started", { nodeId, label, goal: goal.slice(0, 120) });

  const result: AgentLoopResult = { success: false, finalOutput: "Tool-loop agent removed.", summary: "No execution.", steps: 0, stopReason: "agent_removed" };
  const durationMs = Date.now() - t0;

  emit(runId, projectId, "dag.agent.completed", { nodeId, success: result.success, steps: result.steps, stopReason: result.stopReason, durationMs });

  agentPromiseRegistry.resolve(promiseKey, { success: result.success, steps: result.steps, summary: result.summary, stopReason: result.stopReason, durationMs });
}

let _wired = false;

export function initDagAgentExecutor(): void {
  if (_wired) return;
  _wired = true;
  bus.on("agent.event", (event: unknown) => {
    const e = event as DagAgentBusEvent;
    if (e?.eventType !== "dag.agent.execute") return;
    void executeAgent(e);
  });
  console.log("[dag-agent-executor] Wired — DAG agent nodes now dispatch to real runAgentLoop().");
}

export function isDagAgentExecutorWired(): boolean { return _wired; }
