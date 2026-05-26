import type { TaskPayload, TaskPriority } from '../events/event-types.ts';

export const PRIORITY_SCORES: Record<TaskPriority, number> = {
  critical: 100,
  high: 75,
  normal: 50,
  low: 25,
};

export interface PriorityRule {
  type: string;
  priority: TaskPriority;
}

const DEFAULT_RULES: PriorityRule[] = [
  { type: 'fix', priority: 'critical' },
  { type: 'crash', priority: 'critical' },
  { type: 'verify', priority: 'high' },
  { type: 'build', priority: 'high' },
  { type: 'execute', priority: 'normal' },
  { type: 'plan', priority: 'normal' },
  { type: 'analyze', priority: 'normal' },
  { type: 'browser', priority: 'low' },
  { type: 'telemetry', priority: 'low' },
];

export const priorityManager = {
  rules: [...DEFAULT_RULES] as PriorityRule[],

  resolve(task: Partial<TaskPayload> & { type: string }): TaskPriority {
    const rule = this.rules.find((r) => task.type.toLowerCase().includes(r.type));
    return rule?.priority ?? 'normal';
  },

  score(priority: TaskPriority): number {
    return PRIORITY_SCORES[priority] ?? 50;
  },

  scoreTask(task: TaskPayload): number {
    const base = PRIORITY_SCORES[task.priority] ?? 50;
    const agePenalty = Math.min(30, Math.floor((Date.now() - task.createdAt.getTime()) / 10_000));
    return base + agePenalty;
  },

  rank(tasks: TaskPayload[]): TaskPayload[] {
    return [...tasks].sort((a, b) => this.scoreTask(b) - this.scoreTask(a));
  },

  addRule(rule: PriorityRule): void {
    const existing = this.rules.findIndex((r) => r.type === rule.type);
    if (existing >= 0) this.rules[existing] = rule;
    else this.rules.unshift(rule);
  },

  removeRule(type: string): void {
    this.rules = this.rules.filter((r) => r.type !== type);
  },

  override(task: TaskPayload, priority: TaskPriority): TaskPayload {
    return { ...task, priority };
  },

  validate(priority: unknown): priority is TaskPriority {
    return ['critical', 'high', 'normal', 'low'].includes(priority as string);
  },

  getHighestPriority(tasks: TaskPayload[]): TaskPayload | undefined {
    return this.rank(tasks)[0];
  },
};
