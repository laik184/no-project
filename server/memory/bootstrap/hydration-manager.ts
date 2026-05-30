/**
 * server/memory/bootstrap/hydration-manager.ts
 *
 * Phase 1 — Hydration Manager.
 *
 * Orchestrates the full startup hydration sequence:
 *   1. Load persisted data from the memory platform (parallel)
 *   2. Inject into in-process executor stores
 *   3. Return aggregated HydrationResult for validation
 *
 * Called once during server startup, after bootstrapMemory().
 * Idempotent: calling multiple times is safe.
 * Never blocks startup on failure — errors are captured in result.
 */

import type { HydrationResult, HydrationOptions } from './hydration.types.ts';
import {
  loadExecutionHistory,
  loadFailurePatterns,
  loadLearningEntries,
} from './memory-loader.ts';
import {
  hydrateExecutionHistory,
  hydrateFailureMemory,
  hydrateLearningStore,
} from './memory-hydrator.ts';

// ── State ─────────────────────────────────────────────────────────────────────

let _hydrated = false;
let _lastResult: HydrationResult | null = null;

// ── Main hydration sequence ───────────────────────────────────────────────────

export async function runStartupHydration(
  options: HydrationOptions = {},
): Promise<HydrationResult> {
  const start     = Date.now();
  const idempotent = options.idempotent !== false; // default true

  // ── Idempotency guard ──────────────────────────────────────────────────────
  if (idempotent && _hydrated && _lastResult) {
    return { ..._lastResult, alreadyHydrated: true };
  }

  const maxPerStore = options.maxPerStore ?? 200;

  console.log('[hydration-manager] Starting startup memory hydration…');

  try {
    // ── Phase A: Load persisted data in parallel ───────────────────────────
    const [histEntries, failPatterns, learnEntries] = await Promise.all([
      loadExecutionHistory(maxPerStore),
      loadFailurePatterns(),
      loadLearningEntries(),
    ]);

    // ── Phase B: Inject into in-process stores ─────────────────────────────
    const storeResults = [
      hydrateExecutionHistory(histEntries),
      hydrateFailureMemory(failPatterns),
      hydrateLearningStore(learnEntries),
    ];

    // ── Phase C: Aggregate result ──────────────────────────────────────────
    const totalRestored = storeResults.reduce((s, r) => s + r.restored, 0);
    const totalSkipped  = storeResults.reduce((s, r) => s + r.skipped,  0);
    const totalErrors   = storeResults.reduce((s, r) => s + r.errors.length, 0);
    const durationMs    = Date.now() - start;
    const ok            = totalErrors === 0;

    const result: HydrationResult = {
      ok,
      stores:          storeResults,
      totalRestored,
      totalSkipped,
      totalErrors,
      durationMs,
      alreadyHydrated: false,
    };

    _hydrated   = true;
    _lastResult = result;

    if (totalRestored > 0) {
      console.log(
        `[hydration-manager] Hydration complete — restored=${totalRestored} skipped=${totalSkipped} errors=${totalErrors} (${durationMs}ms)`,
      );
      for (const sr of storeResults) {
        if (sr.restored > 0) {
          console.log(`  [hydration-manager]  ${sr.store}: +${sr.restored} entries`);
        }
      }
    } else {
      console.log(`[hydration-manager] Hydration complete — no prior data (cold start) (${durationMs}ms)`);
    }

    return result;

  } catch (err) {
    const error      = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - start;
    console.error('[hydration-manager] Hydration failed:', error);

    const result: HydrationResult = {
      ok:             false,
      stores:         [],
      totalRestored:  0,
      totalSkipped:   0,
      totalErrors:    1,
      durationMs,
      alreadyHydrated: false,
    };

    _hydrated   = true;   // prevent retry storms on every request
    _lastResult = result;
    return result;
  }
}

/** Returns the last hydration result, or null if not yet run. */
export function getHydrationStatus(): HydrationResult | null {
  return _lastResult;
}

/** True once hydration has been attempted (regardless of outcome). */
export function isHydrated(): boolean {
  return _hydrated;
}
