/**
 * server/agents/planner/planner-agent.ts
 * Decomposes a high-level goal into an ordered task graph.
 * Single responsibility: goal → TaskGraph. No tool execution.
 * Communicates only via typed AgentMessage contracts.
 */

import { v4 as uuidv4 }     from "uuid";
import { bus }              from "../../infrastructure/events/bus.ts";
import type { AgentMessage, PlanRequest, PlanResponse } from "../contracts/types.ts";

export interface TaskNode {
  id:          string;
  description: string;
  dependsOn:   string[];
  priority:    "high" | "medium" | "low";
  estimated:   number;   // estimated steps
}

export interface TaskGraph {
  planId:    string;
  goal:      string;
  tasks:     TaskNode[];
  summary:   string;
  createdAt: number;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function handlePlanRequest(
  message: AgentMessage<PlanRequest>,
): Promise<AgentMessage<PlanResponse>> {
  const { runId, projectId, payload } = message;
  const { goal, maxTasks = 8 }       = payload;

  const tasks = decomposeGoal(goal, maxTasks);

  bus.emit("agent.event", {
    runId, eventType: "planner.completed" as any, phase: "plan",
    ts: Date.now(), payload: { taskCount: tasks.length },
  });

  return {
    messageId:     uuidv4(),
    type:          "plan.response",
    from:          "planner",
    to:            message.from,
    runId, projectId,
    payload:       { tasks, summary: `Decomposed into ${tasks.length} tasks` },
    ts:            Date.now(),
    correlationId: message.messageId,
  };
}

export function buildTaskGraph(goal: string, maxTasks = 8): TaskGraph {
  return {
    planId:    uuidv4(),
    goal,
    tasks:     decomposeGoal(goal, maxTasks),
    summary:   `Task graph for: ${goal.slice(0, 80)}`,
    createdAt: Date.now(),
  };
}

// ── Goal decomposition ────────────────────────────────────────────────────────

function decomposeGoal(goal: string, maxTasks: number): TaskNode[] {
  // Rule-based decomposition: classify goal type and generate standard subtasks
  const lower = goal.toLowerCase();
  const tasks: Omit<TaskNode, "id">[] = [];

  // Phase 1: Always — understand codebase
  tasks.push({ description: "Read existing codebase and understand architecture", dependsOn: [], priority: "high", estimated: 2 });

  if (/fix|bug|error|broken|crash/i.test(lower)) {
    tasks.push({ description: "Reproduce and isolate the failure", dependsOn: ["t0"], priority: "high", estimated: 3 });
    tasks.push({ description: "Apply fix and verify it compiles", dependsOn: ["t1"], priority: "high", estimated: 3 });
    tasks.push({ description: "Run verification — build + runtime + preview", dependsOn: ["t2"], priority: "high", estimated: 2 });
  } else if (/add|create|build|implement/i.test(lower)) {
    tasks.push({ description: "Design the data model and typed interfaces", dependsOn: ["t0"], priority: "high", estimated: 2 });
    tasks.push({ description: "Implement backend logic and API endpoints", dependsOn: ["t1"], priority: "high", estimated: 4 });
    tasks.push({ description: "Implement frontend UI and connect to API", dependsOn: ["t2"], priority: "medium", estimated: 4 });
    tasks.push({ description: "Run full verification — build + preview + browser", dependsOn: ["t3"], priority: "high", estimated: 2 });
  } else if (/refactor|rename|move|restructure/i.test(lower)) {
    tasks.push({ description: "Analyze impact of refactor using AST analysis", dependsOn: ["t0"], priority: "high", estimated: 2 });
    tasks.push({ description: "Apply refactor changes preserving all imports", dependsOn: ["t1"], priority: "high", estimated: 4 });
    tasks.push({ description: "Verify no broken imports or TypeScript errors", dependsOn: ["t2"], priority: "high", estimated: 2 });
  } else {
    tasks.push({ description: "Implement the requested change", dependsOn: ["t0"], priority: "high", estimated: 5 });
    tasks.push({ description: "Verify implementation is working correctly", dependsOn: ["t1"], priority: "high", estimated: 2 });
  }

  return tasks.slice(0, maxTasks).map((t, i) => ({
    ...t,
    id: `t${i}`,
    dependsOn: t.dependsOn.filter(d => d !== `t${i}`),
  }));
}
