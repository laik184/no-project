/**
 * server/agents/contracts/index.ts
 * Public API for inter-agent typed message contracts.
 */

export type {
  AgentRole,
  AgentMessageType,
  AgentMessage,
  PlanRequest,
  PlanResponse,
  TaskAssignment,
  TaskResult,
  DebugRequest,
  DebugResponse,
  SecurityScanRequest,
  SecurityScanResponse,
} from "./types.ts";
