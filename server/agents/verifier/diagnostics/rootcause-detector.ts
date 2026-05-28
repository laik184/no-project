/**
 * diagnostics/rootcause-detector.ts
 * Root cause detection — sync heuristic version used by the tools layer,
 * plus async orchestration version used by agent workflows.
 */

import type { ToolExecutionContext } from '../../../tools/registry/tool-types.ts';
import type { RootCause, FailureCategory, ParsedError } from '../types/diagnostics.types.ts';
import { detectRootCause } from '../coordination/tool-coordinator.ts';
import { classifyCategory } from './error-classifier.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';

const FIX_SUGGESTIONS: Partial<Record<FailureCategory, string>> = {
  typecheck:  'Run tsc --noEmit. Fix type errors and missing imports.',
  build:      'Check vite.config.ts and tsconfig.json. Ensure all deps are installed.',
  runtime:    'Verify env vars are set. Check module resolution and node_modules.',
  test:       'Inspect failing assertions. Ensure test fixtures and mocks are initialized.',
  network:    'Verify server port. Check CORS and firewall settings.',
  config:     'Ensure .env file exists with all required environment variables.',
  dependency: 'Run npm install. Check package.json for version conflicts.',
  unknown:    'Enable verbose logging. Inspect the full output for the root error.',
};

// ── Sync heuristic version ────────────────────────────────────────────────────
// Called directly by the tools layer (server/tools/verifier/diagnostics/rootcause-detector.ts).

export function detectRootCauses(errors: ParsedError[]): RootCause[] {
  if (!errors.length) return [];
  return buildHeuristicRootCauses(errors.map((e) => e.message));
}

/** Return the single most-likely root cause for a set of ParsedErrors. */
export function primaryRootCause(errors: ParsedError[]): RootCause | undefined {
  return detectRootCauses(errors)[0];
}

export function buildHeuristicRootCauses(errorMessages: string[]): RootCause[] {
  const groups: Partial<Record<FailureCategory, string[]>> = {};
  for (const msg of errorMessages) {
    const category = classifyCategory(msg);
    if (!groups[category]) groups[category] = [];
    groups[category]!.push(msg);
  }

  return (Object.entries(groups) as [FailureCategory, string[]][]).map(([category, msgs]) => ({
    category,
    description:   `${msgs.length} ${category} error(s) detected`,
    primaryError:  msgs[0],
    relatedErrors: msgs.slice(1, 5),
    suggestedFix:  FIX_SUGGESTIONS[category],
  }));
}

// ── Async orchestration version ───────────────────────────────────────────────
// Called by agent workflows via tool-coordinator.

export async function detectRootCausesAsync(
  context: ToolExecutionContext,
  errors:  string[],
): Promise<RootCause[]> {
  if (!errors.length) return [];

  const toolResult = await detectRootCause(context, errors);
  if (toolResult.ok) {
    const data = (toolResult as { ok: true; data: unknown; durationMs: number }).data;
    if (Array.isArray(data)) return data as RootCause[];
  }

  verifierLogger.warn(context.runId, 'Root cause tool failed — using heuristic fallback');
  return buildHeuristicRootCauses(errors);
}
