/**
 * server/tools/registry/tool-metadata.ts
 *
 * Central metadata catalogue for all registered tools.
 * Metadata is pure data — no handler logic lives here.
 * Agents import this to discover available tools.
 */

import type {
  ToolCategory,
  ToolPermission,
  RetryPolicy,
  ToolInputSchema,
} from './tool-types.ts';

// ── Metadata shape ────────────────────────────────────────────────────────────

export interface ToolMetadata {
  readonly name:        string;
  readonly category:    ToolCategory;
  readonly description: string;
  readonly inputSchema: ToolInputSchema;
  readonly permissions: readonly ToolPermission[];
  readonly timeoutMs:   number;
  readonly retry:       RetryPolicy;
  readonly version:     string;
  readonly tags:        readonly string[];
}

// ── Shared retry policies ─────────────────────────────────────────────────────

export const RETRY_NONE: RetryPolicy      = { maxAttempts: 1, delayMs: 0,    backoff: 'none'        };
export const RETRY_ONCE: RetryPolicy      = { maxAttempts: 2, delayMs: 500,  backoff: 'linear'      };
export const RETRY_AGGRESSIVE: RetryPolicy = { maxAttempts: 3, delayMs: 1000, backoff: 'exponential' };

// ── Shared timeout constants (ms) ─────────────────────────────────────────────

export const TIMEOUT = {
  FAST:    5_000,
  DEFAULT: 30_000,
  LONG:    120_000,
  BROWSER: 60_000,
  SHELL:   60_000,
  NPM:     180_000,
} as const;

// ── In-memory metadata catalogue ──────────────────────────────────────────────

const catalogue = new Map<string, ToolMetadata>();

export function registerMetadata(meta: ToolMetadata): void {
  if (catalogue.has(meta.name)) return;
  catalogue.set(meta.name, Object.freeze(meta));
}

export function getMetadata(name: string): ToolMetadata | undefined {
  return catalogue.get(name);
}

export function getAllMetadata(): readonly ToolMetadata[] {
  return Object.freeze([...catalogue.values()]);
}

export function getMetadataByCategory(category: ToolCategory): readonly ToolMetadata[] {
  return Object.freeze([...catalogue.values()].filter(m => m.category === category));
}

export function hasMetadata(name: string): boolean {
  return catalogue.has(name);
}

export function metadataCatalogueSize(): number {
  return catalogue.size;
}
