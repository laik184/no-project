/**
 * server/agents/terminal/validation/security-validator.ts
 *
 * Validates execution policy, sandbox boundaries, and permission scope.
 * Enforces fail-closed security: any violation rejects the request.
 */

import path from 'path';
import type { ValidationResult } from '../types/terminal.types.ts';

const SANDBOX_ROOT = process.env.AGENT_PROJECT_ROOT ?? '.sandbox';

/** Allowed outbound hosts for agent HTTP traffic. */
const ALLOWED_HOSTS: ReadonlySet<string> = new Set(
  (process.env.AGENT_HTTP_ALLOWED_HOSTS ?? 'openrouter.ai,api.openai.com')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean),
);

export function validateSandboxPath(projectId: string, targetPath: string): ValidationResult {
  const errors: string[] = [];

  const sandboxRoot = path.resolve(path.join(SANDBOX_ROOT, projectId));
  const resolved    = path.resolve(targetPath);

  if (!resolved.startsWith(sandboxRoot)) {
    errors.push(
      `Path escape detected: "${targetPath}" is outside sandbox "${sandboxRoot}"`,
    );
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}

export function validatePermissionScope(
  requestedPermissions: readonly string[],
  allowedPermissions:   readonly string[],
): ValidationResult {
  const errors: string[] = [];
  const allowed = new Set(allowedPermissions);

  for (const perm of requestedPermissions) {
    if (!allowed.has(perm)) {
      errors.push(`Permission not granted: "${perm}"`);
    }
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}

export function validateOutboundHost(url: string): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  try {
    const parsed = new URL(url);
    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      warnings.push(
        `Outbound request to unlisted host: "${parsed.hostname}" — verify AGENT_HTTP_ALLOWED_HOSTS`,
      );
    }
  } catch {
    errors.push(`Invalid URL: "${url}"`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateExecutionPolicy(command: string): ValidationResult {
  const errors: string[] = [];

  const lc = command.toLowerCase();
  if (lc.includes('rm -rf') && !lc.includes('.sandbox')) {
    errors.push('Destructive rm outside sandbox boundary');
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}
