/**
 * tool-loop.agent.ts — STUB
 * Original tool-loop agent was removed.
 * Exports the types and function signatures required by dependent modules.
 */

export interface AgentLoopResult {
  success:     boolean;
  finalOutput: string;
  summary:     string;
  steps:       number;
  stopReason:  string;
  error?:      string;
  messages?:   unknown[];
}

export async function runAgentLoop(opts: {
  projectId:    number;
  runId:        string;
  goal:         string;
  systemPrompt?: string;
  maxSteps?:    number;
  signal?:      AbortSignal;
  memoryContext?: string;
}): Promise<AgentLoopResult> {
  console.warn("[tool-loop] runAgentLoop called but agent was removed — returning stub result");
  return {
    success:     false,
    finalOutput: "Agent tool-loop was removed from this system.",
    summary:     "No execution — tool-loop agent removed.",
    steps:       0,
    stopReason:  "agent_removed",
    messages:    [],
  };
}
