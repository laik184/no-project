/**
 * server/tools/registry/tool-registry.ts
 *
 * Singleton tool registry — CORE responsibility only (Fix #8 — SRP).
 *
 * Responsibilities:
 *   - register / unregister tools
 *   - prevent duplicate registration
 *   - expose immutable reads
 *   - singleton-safe (module-level store)
 *   - sealing after boot
 *
 * Metrics are in:     ./tool-metrics.ts
 * Audit / security:   ./tool-security.ts
 * Compat shim:        ./tool-registry-adapter.ts  (new)
 *
 * The unifiedRegistry export and recordMetric export are preserved here
 * as re-exports for backward-compatibility with existing consumers.
 */

import type { ToolDefinition, ToolCategory } from './tool-types.ts';
import { registerMetadata }                  from './tool-metadata.ts';
import { recordMetric, getMetrics, getAllMetricsSnapshot } from './tool-metrics.ts';

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

export function unregisterTool(name: string): boolean {
  if (_sealed) {
    throw new ToolRegistryError('Registry is sealed — cannot unregister after boot.');
  }
  return registry.delete(name);
}

export function getTool(name: string): ToolDefinition | undefined {
  return registry.get(name);
}

export function listTools(): readonly string[] {
  return Object.freeze([...registry.keys()]);
}

export function listToolsByCategory(category: ToolCategory): readonly ToolDefinition[] {
  return Object.freeze(
    [...registry.values()].filter(t => t.category === category),
  );
}

export function hasTool(name: string): boolean {
  return registry.has(name);
}

export function toolCount(): number {
  return registry.size;
}

/** Seal the registry. Call once at application startup, after all tools are registered. */
export function sealRegistry(): void {
  _sealed = true;
}

export function isSealed(): boolean {
  return _sealed;
}

/** ONLY for use in tests — resets internal state completely. */
export function _resetRegistryForTests(): void {
  registry.clear();
  _sealed = false;
}

// ── Backward-compat re-exports ────────────────────────────────────────────────
// Consumers that imported recordMetric from tool-registry.ts continue to work.

export { recordMetric } from './tool-metrics.ts';

// ── unifiedRegistry — compat shim for tools.routes.ts ────────────────────────
// Kept here for backward compat. The adapter logic is now also available
// from registry/tool-registry-adapter.ts with cleaner ownership.

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
  get totalCount(): number { return registry.size; },

  list(): UnifiedRegistryEntry[] {
    return [...registry.values()].map(toEntry);
  },

  getEntry(name: string): UnifiedRegistryEntry | undefined {
    const def = registry.get(name);
    return def ? toEntry(def) : undefined;
  },

  getByCategory(category: ToolCategory): UnifiedRegistryEntry[] {
    return [...registry.values()].filter(d => d.category === category).map(toEntry);
  },

  getMetrics(name: string) {
    return getMetrics(name);
  },

  getStats() {
    const byCategory: Record<string, number> = {};
    for (const def of registry.values()) {
      byCategory[def.category] = (byCategory[def.category] ?? 0) + 1;
    }
    return { total: registry.size, byCategory, metrics: getAllMetricsSnapshot() };
  },
} as const;
