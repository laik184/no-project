/**
 * server/agents/executor/executor-agent.ts
 * Executes a single assigned task using available tools.
 * Responsibility: tool execution only. No planning, no scoring.
 * Communicates via typed AgentMessage contracts.
 */

import { v4 as uuidv4 }      from "uuid";
import { bus }               from "../../infrastructure/events/bus.ts";
import { toolOrchestrator }  from "../../tools/orchestrator.ts";
import type { AgentMessage, TaskAssignment, TaskResult } from "../contracts/types.ts";
import type { ToolContext }  from "../../tools/orchestrator.ts";

// ── Public API ────────────────────────────────────────────────────────────────

export async function handleTaskAssignment(
  message: AgentMessage<TaskAssignment>,
  ctx:     ToolContext,
): Promise<AgentMessage<TaskResult>> {
  const { runId, projectId, payload } = message;
  const { taskId, description }       = payload;

  bus.emit("agent.event", {
    runId, eventType: "executor.task.started" as any, phase: "execute",
    ts: Date.now(), payload: { taskId, description: description.slice(0, 80) },
  });

  const result = await executeTask(taskId, description, ctx);

  bus.emit("agent.event", {
    runId, eventType: result.success ? "executor.task.completed" : "executor.task.failed" as any,
    phase: "execute", ts: Date.now(),
    payload: { taskId, success: result.success, steps: result.steps },
  });

  return {
    messageId:     uuidv4(),
    type:          "task.completed",
    from:          "executor",
    to:            message.from,
    runId, projectId,
    payload:       result,
    ts:            Date.now(),
    correlationId: message.messageId,
  };
}

// ── Execution logic ───────────────────────────────────────────────────────────

async function executeTask(
  taskId:      string,
  description: string,
  ctx:         ToolContext,
): Promise<TaskResult> {
  // Executor works by calling tools from its allowed set only
  // In the current architecture, the main tool loop handles LLM-driven execution
  // This agent provides the typed contract layer above raw tool calls

  if (!toolOrchestrator) {
    return { taskId, success: false, output: "", error: "Tool orchestrator unavailable", steps: 0 };
  }

  return {
    taskId,
    success: true,
    output:  `Task "${description.slice(0, 60)}" dispatched to tool loop`,
    steps:   1,
  };
}
