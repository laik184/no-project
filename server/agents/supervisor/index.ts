/**
 * server/agents/supervisor/index.ts
 *
 * Public API for the multi-agent supervisor system.
 */

export { runSupervisor }                      from "./supervisor-agent.ts";
export { routeTask, ROLE_DESCRIPTIONS }       from "./agent-router.ts";
export { partitionContext, buildSystemPrompt } from "./context-partitioner.ts";
export {
  buildHallucinationReport,
  detectRepetition,
  detectUngroundedClaims,
}                                             from "./hallucination-detector.ts";
export {
  createProposal, castVote, resolveConsensus,
  awaitConsensus, autoApprove, clearProposal,
}                                             from "./consensus-engine.ts";
export {
  createAssignment, registerTask, startTask,
  completeTask, getTask, getRunTasks, summarizeRun,
}                                             from "./task-coordinator.ts";

export type {
  AgentRole, AgentStatus, AgentMessage,
  TaskAssignment, AgentResult, ContextPartition,
  ContextSection, ConsensusProposal, ConsensusVote,
  ConsensusResult, HallucinationReport,
  ROLE_TOKEN_BUDGETS, ROLE_ALLOWED_TOOLS,
}                                             from "./supervisor-types.ts";
export type { RouteDecision }                 from "./agent-router.ts";
export type { SupervisorOptions, SupervisorResult, AgentRunner } from "./supervisor-agent.ts";
