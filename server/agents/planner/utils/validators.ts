import { z } from 'zod';
import type { PlannerInput } from '../types/planner.types.ts';

export const plannerInputSchema = z.object({
  runId:     z.string().min(1, 'runId is required'),
  projectId: z.string().min(1, 'projectId is required'),
  goal:      z.string().min(3, 'goal must be at least 3 characters').max(10_000),
  timeoutMs: z.number().int().min(5_000).max(300_000).default(60_000),
  metadata:  z.record(z.unknown()).default({}),
});

export function validatePlannerInput(raw: unknown): PlannerInput {
  return plannerInputSchema.parse(raw) as PlannerInput;
}

export function safeValidatePlannerInput(
  raw: unknown,
): { ok: true; data: PlannerInput } | { ok: false; error: string } {
  const result = plannerInputSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data as PlannerInput };
  return { ok: false, error: result.error.message };
}

export function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

export function isValidTaskId(val: unknown): val is string {
  return typeof val === 'string' && val.startsWith('task_');
}

export function isValidPhaseId(val: unknown): val is string {
  return typeof val === 'string' && val.startsWith('phase_');
}

export function isValidPlanId(val: unknown): val is string {
  return typeof val === 'string' && val.startsWith('plan_');
}
