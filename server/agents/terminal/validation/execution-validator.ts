/**
 * server/agents/terminal/validation/execution-validator.ts
 *
 * Validates execution requests entering the agent orchestration layer.
 * Also provides output validation used by the step-runner.
 * Pure logic — no tool calls, no direct execution.
 */

import type { ExecutionStep, ValidationResult } from '../types/terminal.types.ts';

// ── Request validation ────────────────────────────────────────────────────────

export function validateExecutionRequest(
  runId:       string,
  projectId:   string,
  sandboxRoot: string,
  steps:       readonly ExecutionStep[],
): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!runId?.trim())       errors.push('runId is required');
  if (!projectId?.trim())   errors.push('projectId is required');
  if (!sandboxRoot?.trim()) errors.push('sandboxRoot is required');

  if (!Array.isArray(steps)) {
    errors.push('steps must be an array');
    return { valid: false, errors, warnings };
  }

  if (steps.length === 0)  warnings.push('Execution requested with zero steps');
  if (steps.length > 200)  errors.push(`Too many steps: ${steps.length} (max 200)`);

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (!s?.id)        errors.push(`Step[${i}] missing id`);
    if (!s?.type)      errors.push(`Step[${i}] missing type`);
    if (!s?.taskId)    errors.push(`Step[${i}] missing taskId`);
    if (!s?.timeoutMs || s.timeoutMs <= 0) errors.push(`Step[${i}] invalid timeoutMs`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateSessionState(runId: string, sessionRunId: string): ValidationResult {
  const errors: string[] = [];
  if (runId !== sessionRunId)
    errors.push(`runId mismatch: expected ${sessionRunId}, got ${runId}`);
  return { valid: errors.length === 0, errors, warnings: [] };
}

export function validateMissingContext(
  sandboxRoot: string | undefined,
  projectId:   string | undefined,
): ValidationResult {
  const errors: string[] = [];
  if (!sandboxRoot) errors.push('Missing runtime context: sandboxRoot is undefined');
  if (!projectId)   errors.push('Missing runtime context: projectId is undefined');
  return { valid: errors.length === 0, errors, warnings: [] };
}

// ── Output validation ─────────────────────────────────────────────────────────

export interface OutputValidation {
  valid:  boolean;
  errors: string[];
}

export function validateGeneratedOutput(stepType: string, content: string): OutputValidation {
  const errors: string[] = [];
  if (!content || content.trim().length < 20) {
    errors.push(`Generated content for "${stepType}" is too short or empty`);
    return { valid: false, errors };
  }
  switch (stepType) {
    case 'generate_frontend':
    case 'generate_component':
      if (!/export\s+(default\s+function|function|const|class)/i.test(content))
        errors.push('Frontend/component file should export a default function or component');
      break;
    case 'generate_backend':
      if (!/(Router|router|export\s+default)/i.test(content))
        errors.push('Backend file should export a router or default export');
      break;
    case 'generate_database':
      if (!/pgTable|drizzle|schema/i.test(content))
        errors.push('Database file should contain a table definition');
      break;
    default: break;
  }
  return { valid: errors.length === 0, errors };
}

export function validateCommandOutput(exitCode: number, stdout: string, stderr: string): OutputValidation {
  const errors: string[] = [];
  if (exitCode !== 0) {
    const summary = (stderr || stdout).slice(0, 300).trim();
    errors.push(`Command exited with code ${exitCode}: ${summary || '(no output)'}`);
  }
  return { valid: errors.length === 0, errors };
}
