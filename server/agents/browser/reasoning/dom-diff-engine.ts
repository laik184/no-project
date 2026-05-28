/**
 * server/agents/browser/reasoning/dom-diff-engine.ts
 *
 * Compares before/after DOM state descriptions to detect:
 *   - regressions (content/elements present before but missing after)
 *   - layout corruption
 *   - unexpected new errors introduced
 *
 * Takes serialized DOM summaries (element lists, selector maps, text content)
 * as plain objects/strings. No direct Playwright or browser dependencies.
 * No tool imports. Pure structural diff analysis.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DomSnapshot {
  url:        string;
  title?:     string;
  selectors:  string[];      // CSS selectors present in snapshot
  textTokens: string[];      // visible text tokens (words/phrases)
  errorTexts: string[];      // console errors / error messages
  attributes: Record<string, string[]>;   // selector → attribute list
}

export type DiffKind =
  | 'regression'     // previously present, now missing
  | 'new-error'      // error appeared that wasn't there before
  | 'new-element'    // new element appeared (may be positive)
  | 'title-change'   // page title changed
  | 'url-changed'    // URL changed unexpectedly
  | 'attribute-lost' // attribute removed from element
  | 'text-lost';     // visible text disappeared

export interface DomDiffEntry {
  kind:        DiffKind;
  description: string;
  before:      string;
  after:       string;
  severity:    'critical' | 'high' | 'medium' | 'info';
}

export interface DomDiffResult {
  regressions:       DomDiffEntry[];
  improvements:      DomDiffEntry[];
  unchanged:         number;   // count of shared selectors
  hasRegressions:    boolean;
  hasCritical:       boolean;
  score:             number;   // 0 (broken) – 100 (identical/improved)
  summary:           string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function _setDiff<T>(a: T[], b: T[]): { onlyInA: T[]; onlyInB: T[]; inBoth: T[] } {
  const setA   = new Set(a);
  const setB   = new Set(b);
  return {
    onlyInA: a.filter((x) => !setB.has(x)),
    onlyInB: b.filter((x) => !setA.has(x)),
    inBoth:  a.filter((x) => setB.has(x)),
  };
}

const CRITICAL_SELECTORS = /^(body|main|#root|#app|\[data-testid=|nav|header|footer)/i;
const ERROR_PATTERNS     = /error|exception|failed|crash|undefined|null.*reference/i;

// ── Main export ────────────────────────────────────────────────────────────────

export function diffDom(before: DomSnapshot, after: DomSnapshot): DomDiffResult {
  const regressions:  DomDiffEntry[] = [];
  const improvements: DomDiffEntry[] = [];

  // ── URL change ────────────────────────────────────────────────────────────
  if (before.url !== after.url) {
    regressions.push({
      kind: 'url-changed',
      description: 'Page URL changed unexpectedly',
      before: before.url, after: after.url,
      severity: 'high',
    });
  }

  // ── Title change ──────────────────────────────────────────────────────────
  if (before.title && after.title && before.title !== after.title) {
    improvements.push({
      kind: 'title-change',
      description: 'Page title changed',
      before: before.title, after: after.title,
      severity: 'info',
    });
  }

  // ── Selector diff ─────────────────────────────────────────────────────────
  const selDiff = _setDiff(before.selectors, after.selectors);
  for (const sel of selDiff.onlyInA) {
    regressions.push({
      kind: 'regression',
      description: `Selector "${sel}" present before but missing after`,
      before: sel, after: '(absent)',
      severity: CRITICAL_SELECTORS.test(sel) ? 'critical' : 'high',
    });
  }
  for (const sel of selDiff.onlyInB) {
    improvements.push({
      kind: 'new-element',
      description: `New selector "${sel}" appeared after change`,
      before: '(absent)', after: sel,
      severity: 'info',
    });
  }

  // ── Text regression ───────────────────────────────────────────────────────
  const textDiff = _setDiff(before.textTokens, after.textTokens);
  const importantLost = textDiff.onlyInA.filter((t) => t.length > 4 && !/^\d+$/.test(t));
  for (const token of importantLost.slice(0, 10)) {
    regressions.push({
      kind: 'text-lost',
      description: `Visible text "${token}" disappeared after change`,
      before: token, after: '(absent)',
      severity: 'medium',
    });
  }

  // ── New errors ────────────────────────────────────────────────────────────
  const newErrors = after.errorTexts.filter((e) => !before.errorTexts.includes(e));
  for (const err of newErrors) {
    regressions.push({
      kind: 'new-error',
      description: `New error appeared: ${err.slice(0, 80)}`,
      before: '(no error)', after: err,
      severity: ERROR_PATTERNS.test(err) ? 'critical' : 'high',
    });
  }

  // ── Attribute losses ──────────────────────────────────────────────────────
  for (const sel of selDiff.inBoth) {
    const bAttrs = before.attributes[sel] ?? [];
    const aAttrs = after.attributes[sel]  ?? [];
    const lostAttrs = bAttrs.filter((a) => !aAttrs.includes(a));
    for (const attr of lostAttrs) {
      regressions.push({
        kind: 'attribute-lost',
        description: `Attribute "${attr}" removed from "${sel}"`,
        before: attr, after: '(absent)',
        severity: /aria-|role=|data-testid/i.test(attr) ? 'medium' : 'info',
      });
    }
  }

  const criticals    = regressions.filter((r) => r.severity === 'critical');
  const hasReg       = regressions.length > 0;
  const unchanged    = selDiff.inBoth.length;
  const totalBefore  = before.selectors.length;
  const retainPct    = totalBefore === 0 ? 100 : (unchanged / totalBefore) * 100;
  const score        = Math.max(0, Math.round(retainPct - criticals.length * 20 - (regressions.length - criticals.length) * 5));

  const summary = criticals.length > 0
    ? `${criticals.length} critical regression(s) detected`
    : regressions.length > 0
      ? `${regressions.length} regression(s) detected (score: ${score}/100)`
      : `No regressions — DOM stable (score: ${score}/100)`;

  return {
    regressions, improvements, unchanged,
    hasRegressions: hasReg,
    hasCritical:    criticals.length > 0,
    score, summary,
  };
}
