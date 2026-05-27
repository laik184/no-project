import { randomUUID } from 'crypto';
import { z }          from 'zod';
import type { ExecutorInput } from './types.ts';

// ── ID generators ──────────────────────────────────────────────────────────

export function generateExecutionId(): string {
  return `exec_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

export function generateStepId(type: string): string {
  return `step_${type}_${Date.now()}_${randomUUID().slice(0, 8)}`;
}

export function generateCheckpointId(): string {
  return `ckpt_${Date.now()}_${randomUUID().slice(0, 8)}`;
}

export function generateSessionId(): string {
  return `esess_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

// ── Timing ─────────────────────────────────────────────────────────────────

export function elapsedMs(since: Date): number {
  return Date.now() - since.getTime();
}

// ── Step helpers ───────────────────────────────────────────────────────────

export function formatStepLabel(type: string, name?: string): string {
  const base = type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return name ? `${base}: ${name}` : base;
}

export function stepTimeout(type: string): number {
  const timeouts: Record<string, number> = {
    generate_frontend:  15_000,
    generate_backend:   15_000,
    generate_api:       10_000,
    generate_database:  10_000,
    generate_auth:      10_000,
    generate_component: 10_000,
    write_file:          5_000,
    read_file:           5_000,
    edit_file:           5_000,
    patch_file:          5_000,
    delete_file:         3_000,
    list_directory:      5_000,
    search_files:       10_000,
    npm_install:        90_000,
    npm_run:            60_000,
    run_command:        30_000,
    run_tests:          60_000,
    validate_output:    10_000,
    checkpoint:          5_000,
  };
  return timeouts[type] ?? 15_000;
}

export function categoryToStepType(category: string): string {
  const map: Record<string, string> = {
    setup:  'run_command',
    schema: 'generate_database',
    api:    'generate_api',
    auth:   'generate_auth',
    ui:     'generate_frontend',
    test:   'run_tests',
    deploy: 'npm_run',
  };
  return map[category] ?? 'write_file';
}

// ── Validators ─────────────────────────────────────────────────────────────

export const executorInputSchema = z.object({
  runId:     z.string().min(1, 'runId is required'),
  projectId: z.string().min(1, 'projectId is required'),
  goal:      z.string().min(3).max(10_000),
  plan:      z.object({
    planId:     z.string().min(1),
    runId:      z.string().min(1),
    appType:    z.string().min(1),
    complexity: z.string().min(1),
    tasks:      z.array(z.any()),
    phases:     z.array(z.any()),
  }).passthrough(),
  timeoutMs: z.number().int().min(5_000).max(300_000).default(120_000),
  metadata:  z.record(z.unknown()).default({}),
});

export function validateExecutorInput(raw: unknown): ExecutorInput {
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
