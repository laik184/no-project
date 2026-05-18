/**
 * server/tools/registry/tool-permissions.ts
 *
 * Permission definitions and enforcement for the unified tool registry.
 * Maps each tool category to a permission profile and provides
 * a centralised check() function used during execution.
 */

import type { ToolCategory, ToolPermissions, PermissionLevel } from "./tool-types.ts";

// ── Default permission profiles per category ──────────────────────────────────

export const CATEGORY_PERMISSIONS: Record<ToolCategory, ToolPermissions> = {
  file: {
    level: "restricted",
    requiresSandbox: true,
    allowsNetworkAccess: false,
    allowsProcessSpawn: false,
    allowsFileWrite: true,
  },
  shell: {
    level: "dangerous",
    requiresSandbox: true,
    allowsNetworkAccess: false,
    allowsProcessSpawn: true,
    allowsFileWrite: true,
  },
  package: {
    level: "dangerous",
    requiresSandbox: true,
    allowsNetworkAccess: true,
    allowsProcessSpawn: true,
    allowsFileWrite: true,
  },
  server: {
    level: "dangerous",
    requiresSandbox: true,
    allowsNetworkAccess: true,
    allowsProcessSpawn: true,
    allowsFileWrite: false,
  },
  preview: {
    level: "safe",
    requiresSandbox: false,
    allowsNetworkAccess: true,
    allowsProcessSpawn: false,
    allowsFileWrite: false,
  },
  env: {
    level: "restricted",
    requiresSandbox: true,
    allowsNetworkAccess: false,
    allowsProcessSpawn: false,
    allowsFileWrite: true,
  },
  git: {
    level: "dangerous",
    requiresSandbox: true,
    allowsNetworkAccess: true,
    allowsProcessSpawn: true,
    allowsFileWrite: true,
  },
  db: {
    level: "dangerous",
    requiresSandbox: true,
    allowsNetworkAccess: true,
    allowsProcessSpawn: true,
    allowsFileWrite: false,
  },
  deploy: {
    level: "dangerous",
    requiresSandbox: true,
    allowsNetworkAccess: true,
    allowsProcessSpawn: true,
    allowsFileWrite: false,
  },
  testing: {
    level: "restricted",
    requiresSandbox: true,
    allowsNetworkAccess: false,
    allowsProcessSpawn: true,
    allowsFileWrite: false,
  },
  browser: {
    level: "restricted",
    requiresSandbox: false,
    allowsNetworkAccess: true,
    allowsProcessSpawn: true,
    allowsFileWrite: false,
  },
  network: {
    level: "restricted",
    requiresSandbox: false,
    allowsNetworkAccess: true,
    allowsProcessSpawn: false,
    allowsFileWrite: false,
  },
  auth: {
    level: "restricted",
    requiresSandbox: true,
    allowsNetworkAccess: false,
    allowsProcessSpawn: false,
    allowsFileWrite: true,
  },
  "agent-control": {
    level: "safe",
    requiresSandbox: false,
    allowsNetworkAccess: false,
    allowsProcessSpawn: false,
    allowsFileWrite: false,
  },
  memory: {
    level: "restricted",
    requiresSandbox: true,
    allowsNetworkAccess: false,
    allowsProcessSpawn: false,
    allowsFileWrite: true,   // writes to .nura/ inside the sandbox
  },
};

// ── Permission gate ───────────────────────────────────────────────────────────

export interface PermissionCheckResult {
  granted: boolean;
  reason?: string;
}

/**
 * Check whether execution is permitted for the given tool category.
 * Called before every tool execution inside the registry.
 */
export function checkPermissions(
  category: ToolCategory,
  overrides?: Partial<ToolPermissions>,
): PermissionCheckResult {
  const perms = { ...CATEGORY_PERMISSIONS[category], ...overrides };

  if (perms.level === "dangerous" && process.env.TOOL_DISABLE_DANGEROUS === "true") {
    return {
      granted: false,
      reason: `Tool category "${category}" is level=dangerous and dangerous tools are disabled via TOOL_DISABLE_DANGEROUS.`,
    };
  }

  return { granted: true };
}

export function permissionsForCategory(category: ToolCategory): ToolPermissions {
  return CATEGORY_PERMISSIONS[category];
}
