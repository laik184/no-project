/**
 * server/tools/registry/tool-resolver.ts
 *
 * Resolves a tool by name and validates it can be executed
 * for a given context (existence, permissions).
 *
 * Keeps resolution concerns separate from execution (dispatcher).
 */

import type { ToolDefinition, ToolExecutionContext, ToolPermission } from './tool-types.ts';
import { getTool, hasTool } from './tool-registry.ts';

// ── Resolution errors ─────────────────────────────────────────────────────────

export class ToolNotFoundError extends Error {
  constructor(name: string) {
    super(`[ToolResolver] Tool not found: "${name}"`);
    this.name = 'ToolNotFoundError';
  }
}

export class ToolPermissionError extends Error {
  constructor(name: string, missing: ToolPermission[]) {
    super(
      `[ToolResolver] Permission denied for "${name}". ` +
      `Missing: ${missing.join(', ')}`,
    );
    this.name = 'ToolPermissionError';
  }
}

// ── Resolution result ─────────────────────────────────────────────────────────

export interface ResolvedTool {
  definition:  ToolDefinition;
  resolvedAt:  number;
}

// ── Context permission grants ─────────────────────────────────────────────────

/**
 * Default granted permissions for all tool executions.
 * Extend via context.meta.grantedPermissions for privileged calls.
 */
const DEFAULT_GRANTED: readonly ToolPermission[] = ['read', 'write', 'execute'];

function getGrantedPermissions(ctx: ToolExecutionContext): Set<ToolPermission> {
  const extra = (ctx.meta.grantedPermissions ?? []) as ToolPermission[];
  return new Set([...DEFAULT_GRANTED, ...extra]);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve a tool by name.
 * Throws ToolNotFoundError if not registered.
 */
export function resolveTool(name: string): ToolDefinition {
  const tool = getTool(name);
  if (!tool) throw new ToolNotFoundError(name);
  return tool;
}

/**
 * Resolve a tool and validate the caller has the required permissions.
 * Throws ToolNotFoundError or ToolPermissionError on failure.
 */
export function resolveToolWithPermissions(
  name:    string,
  context: ToolExecutionContext,
): ResolvedTool {
  const definition = resolveTool(name);
  const granted    = getGrantedPermissions(context);

  const missing = definition.permissions.filter(p => !granted.has(p));
  if (missing.length > 0) {
    throw new ToolPermissionError(name, missing);
  }

  return { definition, resolvedAt: Date.now() };
}

/**
 * Check if a tool exists (non-throwing).
 */
export function toolExists(name: string): boolean {
  return hasTool(name);
}

/**
 * Validate a tool name is resolvable without throwing.
 * Returns an error message string, or null if valid.
 */
export function validateToolName(name: string): string | null {
  if (!name || !name.trim()) return 'Tool name must be non-empty.';
  if (!hasTool(name)) return `Tool "${name}" is not registered.`;
  return null;
}
