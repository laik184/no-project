/**
 * server/agents/swarm/agent-context-isolator.ts
 *
 * Creates isolated execution contexts for spawned agents.
 * Prevents cross-agent state leakage via scoped context objects.
 * Single responsibility: context isolation only.
 */

import type { SwarmAgentRole } from "../../engine/swarm/swarm-types.ts";
import { openLane, closeLane, write as writeToLane } from "../../engine/swarm/swarm-shared-memory.ts";

// ── Isolated context ──────────────────────────────────────────────────────────

export interface AgentExecutionContext {
  agentId:     string;
  role:        SwarmAgentRole;
  swarmId:     string;
  runId:       string;
  projectId:   number;
  taskId:      string;
  goal:        string;
  memoryLane:  string;
  tools:       string[];
  maxTokens:   number;
  startedAt:   number;
  // Context-scoped write — only this agent can write here
  writeMemory: (key: string, value: unknown) => void;
}

// ── Context registry ──────────────────────────────────────────────────────────

const _contexts = new Map<string, AgentExecutionContext>();

// ── Public API ────────────────────────────────────────────────────────────────

export function createContext(
  agentId:   string,
  role:      SwarmAgentRole,
  swarmId:   string,
  runId:     string,
  projectId: number,
  taskId:    string,
  goal:      string,
  tools:     string[],
  maxTokens: number,
): AgentExecutionContext {
  const memoryLane = `${swarmId}:${agentId}`;
  openLane(agentId, role, swarmId);

  const ctx: AgentExecutionContext = {
    agentId,
    role,
    swarmId,
    runId,
    projectId,
    taskId,
    goal,
    memoryLane,
    tools,
    maxTokens,
    startedAt:   Date.now(),
    writeMemory: (key, value) => {
      writeToLane(agentId, key, value);
    },
  };

  _contexts.set(agentId, ctx);
  return ctx;
}

export function getContext(agentId: string): AgentExecutionContext | undefined {
  return _contexts.get(agentId);
}

export function destroyContext(agentId: string): void {
  closeLane(agentId);
  _contexts.delete(agentId);
}

// ── Tool set per role ─────────────────────────────────────────────────────────

export const ROLE_TOOLS: Record<SwarmAgentRole, string[]> = {
  "planner":           ["plan", "decompose", "analyze"],
  "ui-agent":          ["write_file", "read_file", "create_component"],
  "backend-agent":     ["write_file", "read_file", "create_route", "create_service"],
  "database-agent":    ["write_file", "create_schema", "run_migration"],
  "runtime-agent":     ["exec_command", "read_file", "write_file"],
  "verification-agent":["run_build", "run_type_check", "run_lint"],
  "security-agent":    ["scan_code", "analyze_deps", "read_file"],
  "recovery-agent":    ["read_file", "write_file", "exec_command"],
  "browser-agent":     ["take_screenshot", "run_browser_check"],
  "reflection-agent":  ["analyze", "summarize"],
  "merge-agent":       ["read_file", "write_file", "merge_files"],
};

// ── Token budgets per role ────────────────────────────────────────────────────

export const ROLE_TOKEN_BUDGET: Record<SwarmAgentRole, number> = {
  "planner":           8_000,
  "ui-agent":          16_000,
  "backend-agent":     16_000,
  "database-agent":    8_000,
  "runtime-agent":     4_000,
  "verification-agent":4_000,
  "security-agent":    6_000,
  "recovery-agent":    8_000,
  "browser-agent":     4_000,
  "reflection-agent":  6_000,
  "merge-agent":       12_000,
};
