/**
 * server/tools/registry/tool-types.ts
 *
 * Canonical type definitions for the unified tool registry.
 * Single source of truth — no re-exports from other layers.
 */

// ── Primitive tool types ──────────────────────────────────────────────────────

export interface ToolContext {
  projectId: number;
  runId: string;
  signal?: AbortSignal;
}

export interface ToolResult {
  ok: boolean;
  result?: unknown;
  error?: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  run(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

export type ToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
};

// ── Categories ────────────────────────────────────────────────────────────────

export type ToolCategory =
  | "file"
  | "shell"
  | "package"
  | "server"
  | "preview"
  | "env"
  | "git"
  | "db"
  | "deploy"
  | "testing"
  | "browser"
  | "network"
  | "auth"
  | "agent-control"
  | "memory";

// ── Permission levels ─────────────────────────────────────────────────────────

export type PermissionLevel = "safe" | "restricted" | "dangerous";

export interface ToolPermissions {
  level: PermissionLevel;
  requiresSandbox: boolean;
  allowsNetworkAccess: boolean;
  allowsProcessSpawn: boolean;
  allowsFileWrite: boolean;
}

// ── Registry entry ────────────────────────────────────────────────────────────

export interface RegisteredTool {
  tool: Tool;
  category: ToolCategory;
  terminal: boolean;
  defaultTimeoutMs: number;
  permissions: ToolPermissions;
}

// ── Execution options ─────────────────────────────────────────────────────────

export interface ExecuteOptions {
  timeoutMs?: number;
  emitEvents?: boolean;
  skipSecurity?: boolean;
}

// ── Metrics ───────────────────────────────────────────────────────────────────

export interface ToolMetrics {
  name: string;
  category: ToolCategory;
  calls: number;
  successes: number;
  failures: number;
  totalDurationMs: number;
  avgDurationMs: number;
  lastCalledAt: number | null;
}

// ── Registry stats ────────────────────────────────────────────────────────────

export interface RegistryStats {
  totalTools: number;
  totalCalls: number;
  totalSuccesses: number;
  totalFailures: number;
  activeConcurrentCalls: number;
  categoryCounts: Record<ToolCategory, number>;
  perTool: ToolMetrics[];
}
