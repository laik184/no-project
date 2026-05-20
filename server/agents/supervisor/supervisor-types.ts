/**
 * supervisor-types.ts
 *
 * Canonical type contracts for the multi-agent supervisor system.
 */

export type AgentRole =
  | "planner"
  | "builder"
  | "runtime"
  | "verification"
  | "recovery"
  | "memory"
  | "review";

export type AgentStatus = "idle" | "busy" | "waiting" | "terminated" | "error";

export type MessageType =
  | "task.assign"
  | "task.complete"
  | "task.failed"
  | "context.request"
  | "context.response"
  | "consensus.request"
  | "consensus.vote"
  | "conflict.detected"
  | "loop.detected"
  | "halt.request"
  | "memory.store"
  | "memory.retrieve";

export interface AgentMessage {
  id:        string;
  from:      AgentRole | "supervisor";
  to:        AgentRole | "supervisor" | "broadcast";
  type:      MessageType;
  payload:   unknown;
  replyTo?:  string;          // message ID this responds to
  ttlMs:     number;          // drops after this many ms
  priority:  "critical" | "high" | "normal" | "low";
  ts:        number;
}

export interface TaskAssignment {
  taskId:      string;
  goal:        string;
  role:        AgentRole;
  context:     ContextPartition;
  maxSteps:    number;
  timeoutMs:   number;
  runId:       string;
  projectId:   number;
}

export interface AgentResult {
  taskId:    string;
  role:      AgentRole;
  success:   boolean;
  output:    string;
  steps:     number;
  evidence:  string[];         // facts the agent verified
  confidence:number;           // 0.0–1.0
  durationMs:number;
}

export interface ContextPartition {
  role:          AgentRole;
  goal:          string;
  projectId:     number;
  runId:         string;
  allowedTools:  string[];
  tokenBudget:   number;
  sections:      ContextSection[];
  expiresAt:     number;
}

export interface ContextSection {
  name:    string;
  content: string;
  tokens:  number;
}

export interface ConsensusProposal {
  id:          string;
  description: string;
  proposer:    AgentRole;
  payload:     unknown;
  requiredRoles: AgentRole[];
  threshold:   number;          // fraction [0.0–1.0] that must agree
}

export interface ConsensusVote {
  agentRole:  AgentRole;
  proposalId: string;
  agree:      boolean;
  reason:     string;
  confidence: number;
}

export interface ConsensusResult {
  proposalId:    string;
  reached:       boolean;
  agreementRate: number;
  votes:         ConsensusVote[];
  conflicts:     string[];
}

export interface HallucinationReport {
  agentRole:        AgentRole;
  isRepeating:      boolean;
  repeatCount:      number;
  ungroundedClaims: string[];
  confidence:       number;
  recommendation:   "continue" | "inject-warning" | "halt";
}

/** Token budget per agent role. */
export const ROLE_TOKEN_BUDGETS: Record<AgentRole, number> = {
  planner:      8_000,
  builder:      16_000,
  runtime:      4_000,
  verification: 4_000,
  recovery:     8_000,
  memory:       4_000,
  review:       6_000,
};

/** Tools each agent role is allowed to use. */
export const ROLE_ALLOWED_TOOLS: Record<AgentRole, string[]> = {
  planner:      ["task_complete", "memory_update"],
  builder:      ["write_file", "read_file", "list_dir", "shell_exec", "install_package", "task_complete"],
  runtime:      ["shell_exec", "read_file", "task_complete"],
  verification: ["shell_exec", "read_file", "task_complete"],
  recovery:     ["write_file", "read_file", "shell_exec", "install_package", "task_complete"],
  memory:       ["memory_update", "task_complete"],
  review:       ["read_file", "list_dir", "search_code", "task_complete"],
};
