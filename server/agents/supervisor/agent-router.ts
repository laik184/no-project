/**
 * agent-router.ts
 *
 * Routes incoming tasks to the appropriate specialized agent role
 * based on task keywords, goal analysis, and current system state.
 */

import type { AgentRole } from "./supervisor-types.ts";

// ── Routing table ─────────────────────────────────────────────────────────────

interface RoutingRule {
  patterns:  RegExp[];
  role:      AgentRole;
  priority:  number;          // higher = more specific
}

const ROUTING_RULES: RoutingRule[] = [
  // Recovery — highest priority for crash/error signals
  {
    role:     "recovery",
    priority: 100,
    patterns: [
      /crash(ed)?/i, /error\s+loop/i, /fix\s+(the\s+)?bug/i,
      /repair/i, /restore/i, /rollback/i, /broken/i,
      /exception/i, /stack\s*trace/i, /ENOENT|ECONNREFUSED|ENOMEM/i,
    ],
  },
  // Verification
  {
    role:     "verification",
    priority: 90,
    patterns: [
      /verif/i, /test\s+the\s+app/i, /check\s+if\s+it\s+works/i,
      /screenshot/i, /dom\s+check/i, /e2e/i, /smoke\s+test/i,
      /confirm\s+it\s+runs/i,
    ],
  },
  // Runtime monitoring
  {
    role:     "runtime",
    priority: 80,
    patterns: [
      /runtime/i, /server\s+(is\s+)?(down|up|running)/i,
      /process/i, /memory\s+usage/i, /cpu/i, /health\s+check/i,
      /logs?\s+(show|say)/i, /monitor/i,
    ],
  },
  // Planning — complex multi-step goals
  {
    role:     "planner",
    priority: 70,
    patterns: [
      /build\s+(a\s+)?full/i, /create\s+(a\s+)?complete/i,
      /implement\s+(a\s+)?new/i, /add\s+(multiple|several)/i,
      /refactor\s+the\s+entire/i, /migrate/i,
      /step[s]?\s+by\s+step/i, /plan/i, /design/i,
    ],
  },
  // Builder — code generation
  {
    role:     "builder",
    priority: 60,
    patterns: [
      /write/i, /create\s+(a\s+)?file/i, /add\s+(a\s+)?component/i,
      /implement/i, /code/i, /function/i, /class/i, /api\s+endpoint/i,
      /install/i, /update\s+(the\s+)?(file|component|function)/i,
    ],
  },
  // Memory — semantic retrieval/storage
  {
    role:     "memory",
    priority: 50,
    patterns: [
      /remember/i, /recall/i, /what\s+(did|have)\s+we/i,
      /previous\s+(session|fix|solution)/i, /last\s+time/i,
      /pattern/i, /store\s+this/i,
    ],
  },
  // Review — code quality
  {
    role:     "review",
    priority: 40,
    patterns: [
      /review/i, /audit/i, /check\s+(the\s+)?code/i,
      /security/i, /quality/i, /best\s+practice/i,
      /lint/i, /smell/i, /technical\s+debt/i,
    ],
  },
];

// ── Router ────────────────────────────────────────────────────────────────────

export interface RouteDecision {
  primaryRole: AgentRole;
  secondaryRoles: AgentRole[];
  confidence:  number;
  reason:      string;
}

export function routeTask(goal: string, errorSignal?: string): RouteDecision {
  const text = `${goal} ${errorSignal ?? ""}`;
  const scores = new Map<AgentRole, number>();

  for (const rule of ROUTING_RULES) {
    const matches = rule.patterns.filter(p => p.test(text)).length;
    if (matches > 0) {
      const current = scores.get(rule.role) ?? 0;
      scores.set(rule.role, current + matches * rule.priority);
    }
  }

  if (scores.size === 0) {
    // Default: builder for simple tasks
    return {
      primaryRole:    "builder",
      secondaryRoles: [],
      confidence:     0.5,
      reason:         "No specific signals — defaulting to builder",
    };
  }

  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [primaryRole, topScore] = sorted[0];
  const secondaryRoles = sorted.slice(1, 3).map(([role]) => role);

  const maxPossible = ROUTING_RULES.find(r => r.role === primaryRole)!.priority * 3;
  const confidence  = Math.min(0.99, topScore / maxPossible);

  return {
    primaryRole,
    secondaryRoles,
    confidence,
    reason: `Matched ${primaryRole} with score ${topScore}`,
  };
}

/** Map of role → brief capability description for supervisor prompts. */
export const ROLE_DESCRIPTIONS: Record<AgentRole, string> = {
  planner:      "Decomposes complex goals into ordered subtasks with risk analysis",
  builder:      "Writes and modifies code files, installs packages, runs commands",
  runtime:      "Monitors server health, process state, and runtime metrics",
  verification: "Verifies the app renders correctly and interactions work",
  recovery:     "Diagnoses crashes, fixes errors, and applies targeted patches",
  memory:       "Retrieves relevant past patterns and stores new learnings",
  review:       "Reviews code for quality, security, and architectural issues",
};
