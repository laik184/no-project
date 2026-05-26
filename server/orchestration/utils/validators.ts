import { z } from 'zod';
import type { TaskPayload, OrchestrationContext } from '../events/event-types.ts';

export const orchestrationContextSchema = z.object({
  runId: z.string().min(1),
  projectId: z.string().min(1),
  goal: z.string().min(1).max(10000),
  startedAt: z.date(),
  timeoutMs: z.number().int().min(1000).max(600_000),
  metadata: z.record(z.unknown()).default({}),
});

export const taskPayloadSchema = z.object({
  taskId: z.string().min(1),
  runId: z.string().min(1),
  type: z.string().min(1),
  priority: z.enum(['critical', 'high', 'normal', 'low']),
  input: z.record(z.unknown()).default({}),
  retryCount: z.number().int().min(0).default(0),
  createdAt: z.date(),
});

export const startRunSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
  goal: z.string().min(1, 'goal is required').max(10000),
  timeoutMs: z.number().int().min(1000).max(600_000).default(120_000),
  metadata: z.record(z.unknown()).default({}),
});

export const phaseResultSchema = z.object({
  phase: z.enum(['analyze', 'planning', 'execution', 'verification', 'browser', 'complete', 'failed']),
  success: z.boolean(),
  durationMs: z.number().min(0),
  output: z.record(z.unknown()),
  error: z.string().optional(),
});

export const retryConfigSchema = z.object({
  maxAttempts: z.number().int().min(1).max(10),
  baseDelayMs: z.number().int().min(100).max(30_000),
  maxDelayMs: z.number().int().min(1000).max(120_000),
  jitter: z.boolean().default(true),
});

export function validateContext(raw: unknown): OrchestrationContext {
  return orchestrationContextSchema.parse(raw) as OrchestrationContext;
}

export function validateTask(raw: unknown): TaskPayload {
  return taskPayloadSchema.parse(raw) as TaskPayload;
}

export function validateStartRun(raw: unknown): z.infer<typeof startRunSchema> {
  return startRunSchema.parse(raw);
}

export function safeValidateContext(raw: unknown): { ok: true; data: OrchestrationContext } | { ok: false; error: string } {
  const result = orchestrationContextSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data as OrchestrationContext };
  return { ok: false, error: result.error.message };
}

export function safeValidateTask(raw: unknown): { ok: true; data: TaskPayload } | { ok: false; error: string } {
  const result = taskPayloadSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data as TaskPayload };
  return { ok: false, error: result.error.message };
}

export function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

export function isValidRunId(val: unknown): val is string {
  return isNonEmptyString(val) && /^[a-zA-Z0-9_-]+$/.test(val as string);
}
