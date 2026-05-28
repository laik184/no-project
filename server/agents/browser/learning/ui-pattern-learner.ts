/**
 * server/agents/browser/learning/ui-pattern-learner.ts
 *
 * Browser-specific UI pattern intelligence.
 * Learns crash patterns, layout regressions, navigation failures per route/selector.
 * Advisory — results feed recovery recommendations, never mutate browser agent internals.
 */

import { learningStore }    from '../../executor/learning/learning-store.ts';
import { learningGovernor } from '../../executor/learning/learning-governor.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UiObservation {
  runId:       string;
  route:       string;
  selector?:   string;
  action:      'screenshot' | 'click' | 'fill' | 'navigate' | 'health' | 'wait';
  success:     boolean;
  errorText?:  string;
  durationMs:  number;
}

export interface UiPattern {
  route:          string;
  failureRate:    number;   // [0, 1]
  evidence:       number;
  crashLikely:    boolean;
  slowLikely:     boolean;
  missingSelectors: string[];
  recommendation: string;
}

export interface UiRegressionReport {
  regressionDetected: boolean;
  affectedRoutes:     string[];
  stabilityScore:     number;   // 0–100
  topIssues:          string[];
}

// ── Store keys ────────────────────────────────────────────────────────────────

function _routeKey(route: string): string {
  return `route::${route.replace(/[^a-zA-Z0-9/_-]/g, '_').slice(0, 80)}`;
}

function _selectorKey(route: string, selector: string): string {
  return `selector::${_routeKey(route)}::${selector.slice(0, 60)}`;
}

const _missingSelectors = new Map<string, Set<string>>();

// ── Module API ────────────────────────────────────────────────────────────────

export const uiPatternLearner = {
  /** Record a UI observation outcome. */
  recordObservation(obs: UiObservation): void {
    const routeKey  = _routeKey(obs.route);
    const current   = learningStore.getValue('browser-pattern', routeKey, 0.5);
    const evidence  = (learningStore.get('browser-pattern', routeKey)?.evidence ?? 0) + 1;

    // Reliability delta: success=up, failure=down, failure with crash=bigger down
    let delta = obs.success ? 0.04 : -0.05;
    if (!obs.success && obs.errorText) {
      if (/crash|timeout|unresponsive/i.test(obs.errorText)) delta = -0.09;
      else if (/not found|missing|no element/i.test(obs.errorText)) {
        delta = -0.06;
        if (obs.selector) {
          const selectorSet = _missingSelectors.get(obs.route) ?? new Set();
          selectorSet.add(obs.selector);
          _missingSelectors.set(obs.route, selectorSet);
        }
      }
    }
    if (!obs.success && obs.durationMs > 10_000) delta -= 0.03;  // slow failure

    const verdict = learningGovernor.permitUpdate(routeKey, current, delta, evidence);
    if (verdict.permitted) {
      learningStore.upsert('browser-pattern', routeKey, verdict.actualDelta, {
        route:       obs.route,
        lastAction:  obs.action,
        lastSuccess: String(obs.success),
      });
    }

    // Selector-level tracking
    if (obs.selector) {
      const skKey     = _selectorKey(obs.route, obs.selector);
      const skCurrent = learningStore.getValue('browser-pattern', skKey, 0.5);
      const skEv      = (learningStore.get('browser-pattern', skKey)?.evidence ?? 0) + 1;
      const skDelta   = obs.success ? 0.04 : -0.06;
      const skVerdict = learningGovernor.permitUpdate(skKey, skCurrent, skDelta, skEv);
      if (skVerdict.permitted) {
        learningStore.upsert('browser-pattern', skKey, skVerdict.actualDelta, {
          route: obs.route, selector: obs.selector, action: obs.action,
        });
      }
    }
  },

  /** Predict browser failure likelihood for a route. */
  predictBrowserFailure(route: string): { probability: number; reason: string } {
    const routeKey = _routeKey(route);
    const reliability = learningStore.getValue('browser-pattern', routeKey, 0.5);
    const probability = 1 - reliability;
    const entry       = learningStore.get('browser-pattern', routeKey);
    const reason = entry
      ? `Route "${route}" reliability=${(reliability * 100).toFixed(0)}% (${entry.evidence} obs)`
      : `No data for route "${route}" — baseline risk`;
    return { probability, reason };
  },

  /** Recommend browser recovery action for a route. */
  recommendBrowserRecovery(route: string): string {
    const reliability = learningStore.getValue('browser-pattern', _routeKey(route), 0.5);
    const missing     = _missingSelectors.get(route);
    if (reliability < 0.3) return `Route "${route}" critically unstable — use filesystem fallback`;
    if (reliability < 0.5) return `Route "${route}" unreliable — add wait_for_element + screenshot before action`;
    if (missing?.size)     return `Selectors ${[...missing].slice(0, 3).join(', ')} missing on "${route}" — validate DOM`;
    return 'Standard retry with screenshot validation';
  },

  /** Detect UI regression pattern across recorded observations. */
  detectUiRegressionPattern(): UiRegressionReport {
    const routeEntries = learningStore.byKind('browser-pattern')
      .filter(e => e.key.startsWith('route::'));

    const affectedRoutes = routeEntries
      .filter(e => e.value < 0.5 && e.evidence >= 2)
      .map(e => String(e.metadata?.route ?? e.key.replace('route::', '')));

    const avgReliability = routeEntries.length > 0
      ? routeEntries.reduce((s, e) => s + e.value, 0) / routeEntries.length
      : 0.7;

    const stabilityScore     = Math.round(avgReliability * 100);
    const regressionDetected = affectedRoutes.length > 0 || stabilityScore < 60;

    const topIssues: string[] = [];
    if (affectedRoutes.length > 0) {
      topIssues.push(`${affectedRoutes.length} unstable route(s): ${affectedRoutes.slice(0, 3).join(', ')}`);
    }
    for (const [route, selectors] of _missingSelectors.entries()) {
      if (selectors.size > 0) {
        topIssues.push(`Missing selectors on "${route}": ${[...selectors].slice(0, 2).join(', ')}`);
      }
    }

    return { regressionDetected, affectedRoutes, stabilityScore, topIssues };
  },

  /** Get UI pattern for a specific route. */
  getPattern(route: string): UiPattern {
    const routeKey    = _routeKey(route);
    const entry       = learningStore.get('browser-pattern', routeKey);
    const reliability = entry?.value ?? 0.7;
    const evidence    = entry?.evidence ?? 0;

    return {
      route,
      failureRate:       1 - reliability,
      evidence,
      crashLikely:       reliability < 0.35,
      slowLikely:        reliability < 0.5,
      missingSelectors:  [...(_missingSelectors.get(route) ?? [])],
      recommendation:    this.recommendBrowserRecovery(route),
    };
  },

  reset(): void {
    _missingSelectors.clear();
  },
};
