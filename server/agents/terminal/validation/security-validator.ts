/**
 * server/agents/terminal/validation/security-validator.ts
 *
 * Enforces sandbox boundaries, permission scopes, and execution policy.
 * Pure logic — no tool calls, no direct execution.
 */

import { resolve, normalize } from 'path';
import type { ValidationResult } from '../types/terminal.types.ts';

// ── Sandbox boundary ──────────────────────────────────────────────────────────

export function validateSandboxPath(
  requestedPath: string,
  sandboxRoot:   string,
): ValidationResult {
  const errors: string[] = [];

  if (!requestedPath || typeof requestedPath !== 'string') {
    errors.push('Path must be a non-empty string');
    return { valid: false, errors, warnings: [] };
  }

  const resolved = resolve(sandboxRoot, normalize(requestedPath));

  if (!resolved.startsWith(normalize(sandboxRoot))) {
    errors.push(`Path traversal detected: "${requestedPath}" escapes sandbox root "${sandboxRoot}"`);
    return { valid: false, errors, warnings: [] };
  }

  const FORBIDDEN_SEGMENTS = ['/etc/passwd', '/etc/shadow', '/.ssh/', '/proc/', '/sys/', '/dev/'];
  for (const seg of FORBIDDEN_SEGMENTS) {
    if (resolved.includes(seg)) {
      errors.push(`Access to system path denied: ${seg}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}

// ── Permission scope ──────────────────────────────────────────────────────────

export type Permission = 'read' | 'write' | 'execute' | 'network' | 'spawn';

const ALLOWED_PERMISSIONS: ReadonlySet<Permission> = new Set(['read', 'write', 'execute']);
const RESTRICTED_PERMISSIONS: ReadonlySet<Permission> = new Set(['network', 'spawn']);

export function validatePermission(permission: Permission): ValidationResult {
  if (ALLOWED_PERMISSIONS.has(permission)) {
    return { valid: true, errors: [], warnings: [] };
  }
  if (RESTRICTED_PERMISSIONS.has(permission)) {
    return {
      valid:    false,
      errors:   [`Permission "${permission}" is restricted in this execution environment`],
      warnings: [],
    };
  }
  return {
    valid:    false,
    errors:   [`Unknown permission: "${permission}"`],
    warnings: [],
  };
}

// ── Execution policy ──────────────────────────────────────────────────────────

const BLOCKED_EXECUTABLES = new Set([
  'bash', 'sh', 'zsh', 'fish', 'csh', 'tcsh',
  'python', 'python3', 'ruby', 'perl', 'php',
]);

export function validateExecutionPolicy(
  executable: string,
  sandboxRoot: string,
): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  const exe = executable.split(/\s+/)[0]?.replace(/^.*\//, '');
  if (!exe) {
    errors.push('No executable found in command');
    return { valid: false, errors, warnings };
  }

  if (BLOCKED_EXECUTABLES.has(exe)) {
    warnings.push(`Executing raw shell "${exe}" — consider using a higher-level tool call`);
  }

  const pathCheck = validateSandboxPath(executable.split(/\s+/)[0] ?? '.', sandboxRoot);
  if (!pathCheck.valid && executable.startsWith('/')) {
    errors.push(...pathCheck.errors);
  }

  return { valid: errors.length === 0, errors, warnings };
}
