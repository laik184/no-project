/**
 * server/memory/bootstrap/hydration.types.ts
 *
 * Type contracts for the startup memory hydration system.
 * No runtime logic — pure type definitions.
 */

// ── Per-store hydration result ────────────────────────────────────────────────

export interface StoreHydrationResult {
  store:        string;
  restored:     number;
  skipped:      number;
  errors:       string[];
  durationMs:   number;
}

// ── Aggregate hydration result ────────────────────────────────────────────────

export interface HydrationResult {
  ok:             boolean;
  stores:         StoreHydrationResult[];
  totalRestored:  number;
  totalSkipped:   number;
  totalErrors:    number;
  durationMs:     number;
  alreadyHydrated: boolean;
}

// ── Hydration options ─────────────────────────────────────────────────────────

export interface HydrationOptions {
  /** Maximum entries to restore per in-process store. Defaults to 200. */
  maxPerStore?:   number;
  /** Skip hydration if in-process stores already have data. Default: true */
  idempotent?:    boolean;
  /** Timeout in ms for loading from platform. Default: 5000 */
  timeoutMs?:     number;
}
