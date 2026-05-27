import { z } from 'zod';
import type { ExecutionMode, GoalCategory } from '../types/supervisor.types.ts';

export const supervisorInputSchema = z.object({
  runId:     z.string().min(1, 'runId required'),
  projectId: z.string().min(1, 'projectId required'),
  goal:      z.string().min(1, 'goal required').max(10_000),
  timeoutMs: z.number().int().min(5_000).max(600_000).default(120_000),
  metadata:  z.record(z.unknown()).default({}),
});

export const executionModeSchema = z.enum(['simple', 'standard', 'complex']);

export const goalCategorySchema = z.enum([
  'crud', 'saas_dashboard', 'ai_app', 'auth_system', 'backend_api', 'database_ops', 'unknown',
]);

export const complexityScoreSchema = z.number().min(0).max(100);

export const retryConfigSchema = z.object({
  maxAttempts:  z.number().int().min(1).max(10).default(3),
  baseDelayMs:  z.number().int().min(100).max(30_000).default(1_000),
  maxDelayMs:   z.number().int().min(1_000).max(120_000).default(30_000),
  jitter:       z.boolean().default(true),
});

export type SupervisorInput = z.infer<typeof supervisorInputSchema>;
export type RetryConfig     = z.infer<typeof retryConfigSchema>;

export function validateSupervisorInput(raw: unknown): SupervisorInput {
  return supervisorInputSchema.parse(raw);
}

export function validateExecutionMode(raw: unknown): ExecutionMode {
  return executionModeSchema.parse(raw);
}

export function validateGoalCategory(raw: unknown): GoalCategory {
  return goalCategorySchema.parse(raw);
}

export function safeValidateSupervisorInput(raw: unknown):
  | { ok: true; data: SupervisorInput }
  | { ok: false; error: string } {
  const r = supervisorInputSchema.safeParse(raw);
  return r.success ? { ok: true, data: r.data } : { ok: false, error: r.error.message };
}

export function isValidSessionId(val: unknown): val is string {
  return typeof val === 'string' && /^sv_\d+_[a-f0-9]+$/.test(val);
}

export function isValidScore(val: unknown): val is number {
  return typeof val === 'number' && val >= 0 && val <= 100;
}
