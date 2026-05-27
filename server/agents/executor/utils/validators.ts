import { z } from 'zod';
import type { ExecutorInput } from '../types/executor.types.ts';

export const executorInputSchema = z.object({
  runId:     z.string().min(1, 'runId is required'),
  projectId: z.string().min(1, 'projectId is required'),
  goal:      z.string().min(3).max(10_000),
  plan:      z.object({
    planId:    z.string().min(1),
    runId:     z.string().min(1),
    appType:   z.string().min(1),
    complexity:z.string().min(1),
    tasks:     z.array(z.any()),
    phases:    z.array(z.any()),
  }).passthrough(),
  timeoutMs: z.number().int().min(5_000).max(300_000).default(120_000),
  metadata:  z.record(z.unknown()).default({}),
});

export function validateExecutorInput(
  raw: unknown,
): ExecutorInput {
  return executorInputSchema.parse(raw) as ExecutorInput;
}

export function safeValidateExecutorInput(
  raw: unknown,
): { ok: true; data: ExecutorInput } | { ok: false; error: string } {
  const result = executorInputSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data as ExecutorInput };
  return { ok: false, error: result.error.message };
}

export function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

export function isValidFilePath(val: unknown): val is string {
  if (typeof val !== 'string' || val.trim().length === 0) return false;
  return !val.includes('\0') && val.length < 500;
}

export function isValidCommandString(val: unknown): val is string {
  if (typeof val !== 'string' || val.trim().length === 0) return false;
  return val.length < 1000;
}
