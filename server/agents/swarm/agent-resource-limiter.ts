/**
 * server/agents/swarm/agent-resource-limiter.ts
 *
 * Enforces per-agent resource budgets: tokens, tools, duration.
 * Prevents runaway agents from consuming disproportionate resources.
 * Single responsibility: resource accounting and enforcement only.
 */

import type { SwarmAgentRole, ResourceBudget } from "../../engine/swarm/swarm-types.ts";

// ── Usage record ──────────────────────────────────────────────────────────────

interface UsageRecord {
  agentId:      string;
  role:         SwarmAgentRole;
  budget:       ResourceBudget;
  tokensUsed:   number;
  toolsUsed:    number;
  startedAt:    number;
  limitViolated?: string;
}

const _usage = new Map<string, UsageRecord>();

// ── Default budgets per role ──────────────────────────────────────────────────

const DEFAULT_BUDGETS: Record<SwarmAgentRole, ResourceBudget> = {
  "planner":           { maxTokens: 8_000,  maxTools: 10, maxDurationMs: 60_000  },
  "ui-agent":          { maxTokens: 16_000, maxTools: 30, maxDurationMs: 120_000 },
  "backend-agent":     { maxTokens: 16_000, maxTools: 30, maxDurationMs: 120_000 },
  "database-agent":    { maxTokens: 8_000,  maxTools: 15, maxDurationMs: 90_000  },
  "runtime-agent":     { maxTokens: 4_000,  maxTools: 10, maxDurationMs: 60_000  },
  "verification-agent":{ maxTokens: 4_000,  maxTools: 8,  maxDurationMs: 90_000  },
  "security-agent":    { maxTokens: 6_000,  maxTools: 12, maxDurationMs: 45_000  },
  "recovery-agent":    { maxTokens: 8_000,  maxTools: 15, maxDurationMs: 60_000  },
  "browser-agent":     { maxTokens: 4_000,  maxTools: 8,  maxDurationMs: 60_000  },
  "reflection-agent":  { maxTokens: 6_000,  maxTools: 5,  maxDurationMs: 45_000  },
  "merge-agent":       { maxTokens: 12_000, maxTools: 20, maxDurationMs: 60_000  },
};

// ── Public API ────────────────────────────────────────────────────────────────

export function registerAgent(
  agentId: string,
  role:    SwarmAgentRole,
  budget?: Partial<ResourceBudget>,
): void {
  const defaults = DEFAULT_BUDGETS[role];
  _usage.set(agentId, {
    agentId,
    role,
    budget: { ...defaults, ...budget },
    tokensUsed: 0,
    toolsUsed:  0,
    startedAt:  Date.now(),
  });
}

export function trackTokens(agentId: string, tokens: number): { allowed: boolean; reason?: string } {
  const r = _usage.get(agentId);
  if (!r) return { allowed: true };

  r.tokensUsed += tokens;
  if (r.tokensUsed > r.budget.maxTokens) {
    r.limitViolated = `Token budget exceeded: ${r.tokensUsed}/${r.budget.maxTokens}`;
    return { allowed: false, reason: r.limitViolated };
  }
  return { allowed: true };
}

export function trackTool(agentId: string): { allowed: boolean; reason?: string } {
  const r = _usage.get(agentId);
  if (!r) return { allowed: true };

  r.toolsUsed++;
  if (r.toolsUsed > r.budget.maxTools) {
    r.limitViolated = `Tool budget exceeded: ${r.toolsUsed}/${r.budget.maxTools}`;
    return { allowed: false, reason: r.limitViolated };
  }
  return { allowed: true };
}

export function checkDuration(agentId: string): { allowed: boolean; reason?: string } {
  const r = _usage.get(agentId);
  if (!r) return { allowed: true };

  const elapsed = Date.now() - r.startedAt;
  if (elapsed > r.budget.maxDurationMs) {
    r.limitViolated = `Duration budget exceeded: ${elapsed}ms/${r.budget.maxDurationMs}ms`;
    return { allowed: false, reason: r.limitViolated };
  }
  return { allowed: true };
}

export function getUsage(agentId: string): UsageRecord | undefined {
  return _usage.get(agentId);
}

export function getBudget(role: SwarmAgentRole): ResourceBudget {
  return DEFAULT_BUDGETS[role];
}

export function hasViolated(agentId: string): boolean {
  return !!_usage.get(agentId)?.limitViolated;
}

export function deregisterAgent(agentId: string): void {
  _usage.delete(agentId);
}

export function deregisterAll(swarmId: string, agentIds: string[]): void {
  for (const id of agentIds) _usage.delete(id);
}
