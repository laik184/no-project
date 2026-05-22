/**
 * server/agents/coordination/index.ts
 * Public API surface for the CoordinationAgent.
 */

export {
  initRun,
  requestGate,
  syncAgentStatus,
  getRunState,
  finalizeRun,
} from "./coordination-agent.ts";

export {
  initCoordinationState,
  evaluateGate,
  markNodeComplete,
  markNodeFailed,
  clearCoordinationState,
  getCoordinationState,
} from "./execution-gate.ts";

export type {
  GateRequest,
  GateResult,
  GateDecision,
  GateReason,
  CoordinationSyncRequest,
  CoordinationState,
} from "./types.ts";
