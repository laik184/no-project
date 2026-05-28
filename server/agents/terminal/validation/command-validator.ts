/**
 * server/agents/terminal/validation/command-validator.ts
 *
 * Validates commands before they are dispatched to the tools layer.
 * Detects blocked commands, dangerous patterns, and malformed input.
 * Pure logic — no tool calls, no direct execution.
 */

import type { ValidationResult } from '../types/terminal.types.ts';

// ── Blocklists ────────────────────────────────────────────────────────────────

const BLOCKED_COMMANDS = new Set([
  'rm -rf /', 'rm -rf ~', 'dd if=', 'mkfs', ':(){:|:&};:',
  'chmod -R 777 /', 'chown -R', 'sudo rm', 'sudo mkfs',
]);

const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /rm\s+-rf\s+\/(?!\S)/,         reason: 'Recursive root delete' },
  { pattern: />\s*\/dev\/sd[a-z]/,          reason: 'Direct block device write' },
  { pattern: /curl[^|]*\|\s*bash/,          reason: 'Remote code execution via pipe' },
  { pattern: /wget[^|]*\|\s*bash/,          reason: 'Remote code execution via pipe' },
  { pattern: /nc\s+-[le]/,                  reason: 'Netcat listener/exec' },
  { pattern: /python\s*-c\s*["']import os/, reason: 'Python shell injection pattern' },
  { pattern: /base64\s*--decode[^|]*\|\s*(bash|sh)/, reason: 'Encoded shell execution' },
  { pattern: /eval\s*\$\(/,                 reason: 'Eval with subshell' },
];

const REQUIRED_FIELD_PATTERN = /^[a-zA-Z0-9 _\-./\\:=@"'`!()\[\]{},+*?%^&~|]+$/;

// ── Validator ─────────────────────────────────────────────────────────────────

export function validateCommand(command: string): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!command || typeof command !== 'string') {
    errors.push('Command must be a non-empty string');
    return { valid: false, errors, warnings };
  }

  const trimmed = command.trim();

  if (trimmed.length === 0) {
    errors.push('Command cannot be blank');
    return { valid: false, errors, warnings };
  }

  if (trimmed.length > 2048) {
    errors.push('Command exceeds maximum length of 2048 characters');
    return { valid: false, errors, warnings };
  }

  for (const blocked of BLOCKED_COMMANDS) {
    if (trimmed.includes(blocked)) {
      errors.push(`Blocked command pattern: "${blocked}"`);
    }
  }

  for (const { pattern, reason } of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      errors.push(`Dangerous pattern detected: ${reason}`);
    }
  }

  if (trimmed.includes('\0')) {
    errors.push('Command contains null byte');
  }

  if (/sudo/.test(trimmed)) {
    warnings.push('sudo usage detected — may fail in sandboxed environment');
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validatePackageNames(names: string[]): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(names)) {
    errors.push('Package list must be an array');
    return { valid: false, errors, warnings };
  }

  for (const name of names) {
    if (typeof name !== 'string' || !name.trim()) {
      errors.push(`Invalid package name: ${JSON.stringify(name)}`);
      continue;
    }
    if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*(@[\w.^~>=<|-]+)?$/i.test(name.trim())) {
      warnings.push(`Unusual package name format: "${name}"`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
