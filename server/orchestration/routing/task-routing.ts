/**
 * server/orchestration/routing/task-routing.ts
 *
 * Routes task ownership: maps task descriptions to responsible agent types.
 * Pure routing logic — no dispatch, no tool execution, no filesystem access.
 */

import type { AgentType } from '../types/orchestration.types.ts';

// ── Task ownership record ─────────────────────────────────────────────────────

export interface TaskRoute {
  taskDescription: string;
  owner:           AgentType;
  priority:        'high' | 'medium' | 'low';
  exclusive:       boolean;
}

// ── Routing rules ─────────────────────────────────────────────────────────────

interface RoutingRule {
  keywords: string[];
  owner:    AgentType;
  priority: 'high' | 'medium' | 'low';
  exclusive: boolean;
}

const ROUTING_RULES: RoutingRule[] = [
  { keywords: ['plan', 'design', 'architect', 'structure', 'outline'], owner: 'planner',    priority: 'high',   exclusive: false },
  { keywords: ['write', 'generate', 'create', 'implement', 'code'],    owner: 'executor',   priority: 'high',   exclusive: false },
  { keywords: ['fix', 'bug', 'repair', 'patch', 'correct'],            owner: 'executor',   priority: 'high',   exclusive: false },
  { keywords: ['test', 'verify', 'validate', 'check', 'assert'],       owner: 'verifier',   priority: 'medium', exclusive: false },
  { keywords: ['browse', 'screenshot', 'visual', 'ui', 'render'],      owner: 'browser',    priority: 'medium', exclusive: true  },
  { keywords: ['file', 'read', 'write file', 'copy', 'delete file'],   owner: 'filesystem', priority: 'medium', exclusive: true  },
  { keywords: ['run', 'execute', 'shell', 'command', 'terminal'],      owner: 'terminal',   priority: 'medium', exclusive: true  },
  { keywords: ['supervise', 'monitor', 'coordinate', 'orchestrate'],   owner: 'supervisor', priority: 'low',    exclusive: false },
];

// ── Routing resolver ──────────────────────────────────────────────────────────

export function routeTask(taskDescription: string): TaskRoute {
  const lower = taskDescription.toLowerCase();

  for (const rule of ROUTING_RULES) {
    if (rule.keywords.some(k => lower.includes(k))) {
      return {
        taskDescription,
        owner:     rule.owner,
        priority:  rule.priority,
        exclusive: rule.exclusive,
      };
    }
  }

  // Default fallback
  return {
    taskDescription,
    owner:     'executor',
    priority:  'medium',
    exclusive: false,
  };
}

export function routeTasks(descriptions: string[]): TaskRoute[] {
  return descriptions.map(routeTask);
}

export function filterByOwner(routes: TaskRoute[], owner: AgentType): TaskRoute[] {
  return routes.filter(r => r.owner === owner);
}

export function groupByOwner(routes: TaskRoute[]): Map<AgentType, TaskRoute[]> {
  const groups = new Map<AgentType, TaskRoute[]>();
  for (const route of routes) {
    const existing = groups.get(route.owner) ?? [];
    existing.push(route);
    groups.set(route.owner, existing);
  }
  return groups;
}
