/**
 * server/agents/core/tool-loop/index.ts — STUB
 * Public surface for the tool-loop subsystem.
 */

export { runAgentLoop, type AgentLoopResult } from "./tool-loop.agent.ts";

export async function runAgentLoopWithContinuation(
  opts: {
    projectId:    number;
    runId:        string;
    goal:         string;
    systemPrompt?: string;
    maxSteps?:    number;
    memoryContext?: string;
  },
  _continuationOpts?: { maxContinuations?: number },
): Promise<{
  success:     boolean;
  finalOutput: string;
  summary:     string;
  steps:       number;
  stopReason:  string;
  error?:      string;
  messages?:   unknown[];
}> {
  const { runAgentLoop } = await import("./tool-loop.agent.ts");
  return runAgentLoop(opts);
}
