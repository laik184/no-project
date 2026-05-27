/**
 * server/tools/registry/tool-registry.ts
 *
 * Singleton tool registry.
 * Responsibilities:
 *   - register / unregister tools
 *   - prevent duplicate registration
 *   - expose immutable reads
 *   - singleton-safe (module-level store)
 */

import type { ToolDefinition, ToolHandler, ToolCategory } from './tool-types.ts';
import { registerMetadata } from './tool-metadata.ts';
import type { RegisteredToolEntry } from '../core/execute-tool.ts';

// ── Internal store ─────────────────────────────────────────────────────────────

const registry = new Map<string, ToolDefinition>();
let   _sealed  = false;

// ── Registration errors ───────────────────────────────────────────────────────

export class ToolRegistryError extends Error {
  constructor(message: string) {
    super(`[ToolRegistry] ${message}`);
    this.name = 'ToolRegistryError';
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Register a tool.
 * Throws if the name is already taken (unless `force` is set for hot-reload).
 */
export function registerTool(
  definition: ToolDefinition,
  opts: { force?: boolean } = {},
): void {
  if (_sealed) {
    throw new ToolRegistryError('Registry is sealed — no new registrations allowed after boot.');
  }

  if (!definition.name || !definition.name.trim()) {
    throw new ToolRegistryError('Tool name must be a non-empty string.');
  }

  if (!definition.handler || typeof definition.handler !== 'function') {
    throw new ToolRegistryError(`Tool "${definition.name}" must provide a handler function.`);
  }

  if (registry.has(definition.name) && !opts.force) {
    throw new ToolRegistryError(
      `Duplicate tool registration: "${definition.name}". Use { force: true } to override.`,
    );
  }

  const frozen = Object.freeze({ ...definition });
  registry.set(definition.name, frozen);

  registerMetadata({
    name:        frozen.name,
    category:    frozen.category,
    description: frozen.description,
    inputSchema: frozen.inputSchema,
    permissions: frozen.permissions,
    timeoutMs:   frozen.timeoutMs,
    retry:       frozen.retry,
    version:     '1.0.0',
    tags:        [],
  });
}

/**
 * Remove a tool from the registry.
 * Only allowed before sealing.
 */
export function unregisterTool(name: string): boolean {
  if (_sealed) {
    throw new ToolRegistryError('Registry is sealed — cannot unregister after boot.');
  }
  return registry.delete(name);
}

/**
 * Retrieve a single tool definition (immutable).
 */
export function getTool(name: string): ToolDefinition | undefined {
  return registry.get(name);
}

/**
 * List all registered tool names.
 */
export function listTools(): readonly string[] {
  return Object.freeze([...registry.keys()]);
}

/**
 * List all tool definitions for a category.
 */
export function listToolsByCategory(category: ToolCategory): readonly ToolDefinition[] {
  return Object.freeze(
    [...registry.values()].filter(t => t.category === category),
  );
}

/**
 * Check if a tool is registered.
 */
export function hasTool(name: string): boolean {
  return registry.has(name);
}

/**
 * Total number of registered tools.
 */
export function toolCount(): number {
  return registry.size;
}

/**
 * Seal the registry after boot — prevents any further registrations.
 * Call once at application startup, after all tools are registered.
 */
export function sealRegistry(): void {
  _sealed = true;
}

/**
 * Whether the registry has been sealed.
 */
export function isSealed(): boolean {
  return _sealed;
}

/**
 * ONLY for use in tests — resets internal state completely.
 */
export function _resetRegistryForTests(): void {
  registry.clear();
  _sealed = false;
}

// ── Metrics store ─────────────────────────────────────────────────────────────

interface ToolMetrics {
  invocations: number;
  failures:    number;
  avgDurationMs: number;
}

const metricsStore = new Map<string, ToolMetrics>();

export function recordMetric(name: string, ok: boolean, durationMs: number): void {
  const prev = metricsStore.get(name) ?? { invocations: 0, failures: 0, avgDurationMs: 0 };
  const invocations = prev.invocations + 1;
  const failures    = prev.failures + (ok ? 0 : 1);
  const avgDurationMs = Math.round(
    (prev.avgDurationMs * prev.invocations + durationMs) / invocations,
  );
  metricsStore.set(name, { invocations, failures, avgDurationMs });
}

// ── unifiedRegistry — compat shim for tools.routes.ts + node-executor.ts ──────

export interface UnifiedRegistryEntry {
  tool: {
    name:        string;
    description: string;
    parameters?: Record<string, unknown>;
  };
  category:    ToolCategory;
  terminal:    boolean;
  permissions: readonly string[];
  handler:     ToolDefinition['handler'];
  timeoutMs:   number;
}

function toEntry(def: ToolDefinition): UnifiedRegistryEntry {
  return {
    tool:        { name: def.name, description: def.description, parameters: def.inputSchema as unknown as Record<string, unknown> },
    category:    def.category,
    terminal:    false,
    permissions: def.permissions,
    handler:     def.handler,
    timeoutMs:   def.timeoutMs,
  };
}

export const unifiedRegistry = {
  get totalCount(): number {
    return registry.size;
  },

  list(): UnifiedRegistryEntry[] {
    return [...registry.values()].map(toEntry);
  },

  getEntry(name: string): UnifiedRegistryEntry | undefined {
    const def = registry.get(name);
    return def ? toEntry(def) : undefined;
  },

  getByCategory(category: ToolCategory): UnifiedRegistryEntry[] {
    return [...registry.values()]
      .filter(d => d.category === category)
      .map(toEntry);
  },

  getMetrics(name: string): ToolMetrics {
    return metricsStore.get(name) ?? { invocations: 0, failures: 0, avgDurationMs: 0 };
  },

  getStats(): {
    total:      number;
    byCategory: Record<string, number>;
    metrics:    Record<string, ToolMetrics>;
  } {
    const byCategory: Record<string, number> = {};
    for (const def of registry.values()) {
      byCategory[def.category] = (byCategory[def.category] ?? 0) + 1;
    }
    return {
      total:      registry.size,
      byCategory,
      metrics:    Object.fromEntries(metricsStore.entries()),
    };
  },
} as const;
