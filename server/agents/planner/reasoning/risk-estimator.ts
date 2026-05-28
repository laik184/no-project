/**
 * server/agents/planner/reasoning/risk-estimator.ts
 *
 * Estimates risk for workflows, patches, and tool usage.
 * Produces a structured risk report so the executor can decide:
 *   - whether to create a checkpoint before execution
 *   - whether to run in dry-run mode first
 *   - whether to require human approval before proceeding
 *
 * No tool imports. No execution. Pure static analysis.
 */

import type { PlannedTask } from '../types/planner.types.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskFactor {
  id:          string;
  description: string;
  level:       RiskLevel;
  mitigation:  string;
}

export interface RiskEstimate {
  overall:          RiskLevel;
  score:            number;        // 0–100
  factors:          RiskFactor[];
  requiresCheckpoint: boolean;
  requiresApproval:   boolean;
  rollbackProbability: number;     // 0–1
  recommendations:  string[];
}

// ── Risk scoring ──────────────────────────────────────────────────────────────

const RISK_WEIGHTS: Record<RiskLevel, number> = {
  low: 5, medium: 20, high: 50, critical: 100,
};

function _level(score: number): RiskLevel {
  if (score >= 70) return 'critical';
  if (score >= 40) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

// ── Goal risk patterns ────────────────────────────────────────────────────────

const GOAL_RISK_PATTERNS: Array<{
  re: RegExp; level: RiskLevel; id: string; description: string; mitigation: string;
}> = [
  {
    re: /\b(delete|drop|truncate|purge|wipe|destroy|remove all)\b/i,
    level: 'critical', id: 'DESTRUCTIVE_OP',
    description: 'Destructive operation detected',
    mitigation: 'Require explicit user confirmation and backup',
  },
  {
    re: /\bproduction|prod\b/i,
    level: 'high', id: 'PROD_TARGET',
    description: 'Production environment targeted',
    mitigation: 'Dry-run first, then staged rollout',
  },
  {
    re: /\b(migrate|alter.*schema|drop.*table|add.*column)\b/i,
    level: 'high', id: 'SCHEMA_CHANGE',
    description: 'Database schema modification',
    mitigation: 'Create database backup before executing migration',
  },
  {
    re: /\b(auth|password|secret|token|api.?key|credentials)\b/i,
    level: 'medium', id: 'CREDENTIAL_OP',
    description: 'Credential-sensitive operation',
    mitigation: 'Audit output to ensure no secrets are logged or exposed',
  },
  {
    re: /\b(install|npm install|yarn add|pip install)\b/i,
    level: 'medium', id: 'DEPENDENCY_CHANGE',
    description: 'Package dependency change',
    mitigation: 'Pin versions and verify package integrity hashes',
  },
  {
    re: /\b(refactor|rewrite|restructure|reorganize)\b/i,
    level: 'medium', id: 'REFACTOR',
    description: 'Large refactor increases breakage risk',
    mitigation: 'Create checkpoint before refactoring, run full type-check after',
  },
];

// ── Task complexity risk ──────────────────────────────────────────────────────

function _taskComplexityRisk(tasks: PlannedTask[]): RiskFactor[] {
  const factors: RiskFactor[] = [];
  if (tasks.length >= 10) {
    factors.push({
      id: 'HIGH_TASK_COUNT', description: `Large plan: ${tasks.length} tasks`,
      level: 'medium', mitigation: 'Use checkpoints between phases',
    });
  }
  const criticalTasks = tasks.filter((t) => t.priority === 'critical');
  if (criticalTasks.length >= 3) {
    factors.push({
      id: 'MANY_CRITICAL_TASKS', description: `${criticalTasks.length} critical tasks`,
      level: 'high', mitigation: 'Verify each critical task immediately after execution',
    });
  }
  const browserTasks = tasks.filter((t) => t.toolName.includes('browser') || t.toolName.includes('navigate'));
  if (browserTasks.length > 0) {
    factors.push({
      id: 'BROWSER_DEPENDENCY', description: 'Plan involves browser automation',
      level: 'medium', mitigation: 'Prepare browser restart recovery path',
    });
  }
  return factors;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function estimateRisk(goal: string, tasks: PlannedTask[] = []): RiskEstimate {
  const factors: RiskFactor[] = [];

  // Goal-level pattern matching
  for (const pattern of GOAL_RISK_PATTERNS) {
    if (pattern.re.test(goal)) {
      factors.push({
        id:          pattern.id,
        description: pattern.description,
        level:       pattern.level,
        mitigation:  pattern.mitigation,
      });
    }
  }

  // Task complexity analysis
  factors.push(..._taskComplexityRisk(tasks));

  // Score
  const rawScore = factors.reduce((s, f) => s + RISK_WEIGHTS[f.level], 0);
  const score    = Math.min(100, rawScore);
  const overall  = _level(score);

  const rollbackProbability = Math.min(0.95, score / 100 * 0.7);

  const recommendations: string[] = [];
  if (overall === 'critical' || overall === 'high') {
    recommendations.push('Create a file checkpoint before execution');
    recommendations.push('Run in dry-run / preview mode if available');
  }
  if (factors.some((f) => f.id === 'SCHEMA_CHANGE')) {
    recommendations.push('Back up the database before running migrations');
  }
  if (factors.some((f) => f.id === 'BROWSER_DEPENDENCY')) {
    recommendations.push('Pre-warm browser session and configure restart on crash');
  }
  if (tasks.length > 0 && rollbackProbability > 0.4) {
    recommendations.push('Pre-stage rollback checkpoints between task phases');
  }

  return {
    overall,
    score,
    factors,
    requiresCheckpoint: overall === 'high' || overall === 'critical',
    requiresApproval:   overall === 'critical',
    rollbackProbability,
    recommendations,
  };
}
