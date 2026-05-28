/**
 * server/tools/telemetry/index.ts
 *
 * Cross-category observability hub.
 *
 * Provides a single query surface for metrics and audit data
 * that spans ALL tool categories. Previously each category had
 * isolated metric stores; this module aggregates them centrally.
 *
 * Category resolution uses the tool metadata catalogue (registered at boot)
 * rather than string-splitting on tool names. This gives correct categories
 * even for tools that don't follow the `category_name` naming convention.
 *
 * Data sources:
 *   - registry/tool-metrics.ts  → per-tool invocation metrics (wired to dispatcher)
 *   - registry/tool-security.ts → audit log (wired to dispatcher)
 *   - registry/tool-metadata.ts → category lookup (replaces tool.split('_')[0])
 */

import { getAllMetricsSnapshot, getMetrics, type ToolMetrics } from '../registry/tool-metrics.ts';
import { getAuditLog, auditStats, type AuditLogEntry }        from '../registry/tool-security.ts';
import { getMetadata }                                          from '../registry/tool-metadata.ts';
import type { ToolCategory }                                   from '../registry/tool-types.ts';

export type { ToolMetrics, AuditLogEntry };

// ── Aggregated stats ──────────────────────────────────────────────────────────

export interface GlobalToolStats {
  totalInvocations: number;
  totalFailures:    number;
  totalTimeouts:    number;
  successRate:      number;
  byCategory:       Record<ToolCategory | string, CategoryStats>;
  topFailures:      Array<{ tool: string; failures: number }>;
  auditSummary:     { total: number; failures: number; successes: number };
}

export interface CategoryStats {
  invocations:   number;
  failures:      number;
  avgDurationMs: number;
}

/**
 * Resolve a tool's category using the metadata catalogue.
 * Falls back to parsing the tool name prefix only if metadata is missing
 * (e.g. tools registered before the catalogue was populated in tests).
 */
function resolveCategory(toolName: string): string {
  const meta = getMetadata(toolName);
  if (meta?.category) return meta.category;
  // Fallback: first segment before '_' (best-effort for unknown tools)
  const prefix = toolName.split('_')[0];
  return prefix ?? 'unknown';
}

/**
 * Return a cross-category snapshot of all tool execution metrics.
 * This is the single query point for global observability.
 */
export function getGlobalStats(): GlobalToolStats {
  const snapshot = getAllMetricsSnapshot();
  const auditSum = auditStats();

  let totalInvocations = 0;
  let totalFailures    = 0;
  let totalTimeouts    = 0;

  const byCategory: Record<string, CategoryStats> = {};
  const toolFailures: Array<{ tool: string; failures: number }> = [];

  for (const [tool, m] of Object.entries(snapshot)) {
    totalInvocations += m.invocations;
    totalFailures    += m.failures;
    totalTimeouts    += m.timeouts;

    const cat       = resolveCategory(tool);
    const prev      = byCategory[cat] ?? { invocations: 0, failures: 0, avgDurationMs: 0 };
    const totalCatInv = prev.invocations + m.invocations;

    byCategory[cat] = {
      invocations:   totalCatInv,
      failures:      prev.failures + m.failures,
      avgDurationMs: totalCatInv > 0
        ? Math.round(
            (prev.avgDurationMs * prev.invocations + m.avgDurationMs * m.invocations) / totalCatInv,
          )
        : 0,
    };

    if (m.failures > 0) toolFailures.push({ tool, failures: m.failures });
  }

  toolFailures.sort((a, b) => b.failures - a.failures);

  return {
    totalInvocations,
    totalFailures,
    totalTimeouts,
    successRate: totalInvocations > 0
      ? Math.round(((totalInvocations - totalFailures) / totalInvocations) * 100)
      : 100,
    byCategory:  byCategory as Record<ToolCategory | string, CategoryStats>,
    topFailures: toolFailures.slice(0, 10),
    auditSummary: auditSum,
  };
}

/**
 * Get per-tool metrics for a specific tool name.
 */
export function getToolMetrics(name: string): ToolMetrics {
  return getMetrics(name);
}

/**
 * Get the recent audit log (up to `limit` entries).
 */
export function getRecentAudit(limit = 50): readonly AuditLogEntry[] {
  return getAuditLog(limit);
}

/**
 * Get the most active tools by invocation count.
 */
export function getTopTools(limit = 10): Array<{ tool: string; invocations: number }> {
  const snapshot = getAllMetricsSnapshot();
  return Object.entries(snapshot)
    .map(([tool, m]) => ({ tool, invocations: m.invocations }))
    .sort((a, b) => b.invocations - a.invocations)
    .slice(0, limit);
}
