/**
 * server/agents/executor/learning/learning-store.ts
 *
 * In-process key/value learning store for tool-reliability and workflow-risk
 * signals. Sync reads — no async on the hot path.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type LearnedKind = 'tool-reliability' | 'workflow-risk' | (string & {});

export interface LearnedEntry {
  readonly kind:      LearnedKind;
  readonly key:       string;
  readonly value:     number;
  readonly evidence:  number;
  readonly updatedAt: number;
  readonly meta:      Record<string, string | number | boolean>;
}

export interface LearningStoreSummary {
  readonly totalEntries:  number;
  readonly kinds:         string[];
  readonly topReliable:   LearnedEntry[];
  readonly topRisky:      LearnedEntry[];
}

// ── Config ────────────────────────────────────────────────────────────────────

const MIN_VALUE    = 0;
const MAX_VALUE    = 1;
const MAX_DELTA    = 0.15;

// ── Internal state ────────────────────────────────────────────────────────────

const _store = new Map<string, LearnedEntry>();

function _key(kind: LearnedKind, key: string): string {
  return `${kind}::${key}`;
}

function _clamp(v: number): number {
  return Math.max(MIN_VALUE, Math.min(MAX_VALUE, v));
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const learningStore = {

  get(kind: LearnedKind, key: string): LearnedEntry | undefined {
    return _store.get(_key(kind, key));
  },

  getValue(kind: LearnedKind, key: string, defaultValue: number): number {
    return _store.get(_key(kind, key))?.value ?? defaultValue;
  },

  upsert(
    kind:  LearnedKind,
    key:   string,
    delta: number,
    meta:  Record<string, string | number | boolean> = {},
  ): void {
    const k       = _key(kind, key);
    const current = _store.get(k);
    const clampedDelta = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, delta));
    const newValue     = _clamp((current?.value ?? 0.5) + clampedDelta);
    _store.set(k, {
      kind,
      key,
      value:     newValue,
      evidence:  (current?.evidence ?? 0) + 1,
      updatedAt: Date.now(),
      meta:      { ...(current?.meta ?? {}), ...meta },
    });
  },

  byKind(kind: LearnedKind): LearnedEntry[] {
    const prefix = `${kind}::`;
    return [..._store.entries()]
      .filter(([k]) => k.startsWith(prefix))
      .map(([, v]) => v);
  },

  topByKind(kind: LearnedKind, limit: number): LearnedEntry[] {
    return this.byKind(kind)
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  },

  summary(): LearningStoreSummary {
    const all      = [..._store.values()];
    const kinds    = [...new Set(all.map(e => e.kind))];
    const reliable = all
      .filter(e => e.kind === 'tool-reliability')
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
    const risky = all
      .filter(e => e.kind === 'workflow-risk')
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
    return {
      totalEntries: all.length,
      kinds,
      topReliable:  reliable,
      topRisky:     risky,
    };
  },

  reset(): void {
    _store.clear();
  },
};
