/**
 * server/agents/executor/validation/tool-validator.ts
 *
 * Validates tool requests before they reach the dispatcher.
 * Catches invalid tool names, blocked tools, and malformed payloads.
 */

import type { RoutedStep } from '../types/executor.types.ts';

export class ToolValidationError extends Error {
  constructor(message: string) {
    super(`[tool-validator] ${message}`);
    this.name = 'ToolValidationError';
  }
}

export interface ToolValidationResult {
  ok:      boolean;
  reason?: string;
}

// ── Blocked tools — never allowed through the executor ────────────────────────
const BLOCKED_TOOLS = new Set([
  '__test_only__',
  'dangerous_exec',
]);

// ── Required input fields per tool category (prefix-based) ───────────────────
const REQUIRED_FIELDS: Record<string, string[]> = {
  process_start:    ['command'],
  process_stop:     ['pid'],
  npm_run_script:   ['script'],
  npm_install:      [],
  npm_build:        [],
  run_build:        [],
  run_tests:        [],
  validate_runtime: ['port'],
  check_server_health: ['url'],
  read_file:        ['path'],
  write_file:       ['path', 'content'],
  patch_file:       ['path', 'hunks'],
};

export function validateRoutedStep(routed: RoutedStep): ToolValidationResult {
  if (!routed.toolName?.trim()) {
    return { ok: false, reason: 'toolName must be a non-empty string.' };
  }
  if (BLOCKED_TOOLS.has(routed.toolName)) {
    return { ok: false, reason: `Tool "${routed.toolName}" is blocked.` };
  }
  if (!routed.toolInput || typeof routed.toolInput !== 'object') {
    return { ok: false, reason: `Tool "${routed.toolName}": toolInput must be an object.` };
  }

  // Check required fields for known tools
  const required = REQUIRED_FIELDS[routed.toolName];
  if (required) {
    for (const field of required) {
      if (routed.toolInput[field] === undefined || routed.toolInput[field] === null) {
        return { ok: false, reason: `Tool "${routed.toolName}": missing required field "${field}".` };
      }
    }
  }

  return { ok: true };
}

export function assertRoutedStep(routed: RoutedStep): void {
  const r = validateRoutedStep(routed);
  if (!r.ok) throw new ToolValidationError(r.reason!);
}

export function isToolBlocked(toolName: string): boolean {
  return BLOCKED_TOOLS.has(toolName);
}
