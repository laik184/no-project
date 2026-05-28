/**
 * server/agents/browser/learning/browser-reliability-engine.ts
 *
 * Browser session reliability intelligence.
 * Tracks crash frequency, navigation success rates, timeout patterns.
 * Produces crash predictions and recovery recommendations.
 */

import { learningStore }    from '../../executor/learning/learning-store.ts';
import { learningGovernor } from '../../executor/learning/learning-governor.ts';
import { browserMetrics }   from '../telemetry/browser-metrics.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SessionEvent {
  runId:      string;
  eventType:  'crash' | 'navigation-success' | 'navigation-failure' | 'timeout' | 'validation-pass' | 'validation-fail';
  route?:     string;
  durationMs: number;
  errorText?: string;
}

export interface BrowserReliabilitySnapshot {
  overallReliability:    number;   // [0, 1]
  crashRate:             number;   // crashes per 100 sessions
  navigationSuccessRate: number;   // [0, 1]
  timeoutRate:           number;   // [0, 1]
  validationPassRate:    number;   // [0, 1]
  sessionHealthGrade:    'healthy' | 'degraded' | 'critical';
  recommendation:        string;
}

export interface CrashPrediction {
  crashLikely:     boolean;
  probability:     number;   // [0, 1]
  topReasons:      string[];
  mitigation:      string;
}

// ── Store keys ────────────────────────────────────────────────────────────────

const CRASH_KEY      = 'browser::crash-rate';
const NAV_KEY        = 'browser::navigation-reliability';
const TIMEOUT_KEY    = 'browser::timeout-rate';
const VALIDATION_KEY = 'browser::validation-rate';
const OVERALL_KEY    = 'browser::overall-reliability';

// ── Internal sliding window ───────────────────────────────────────────────────

const _recentEvents: SessionEvent[] = [];
const MAX_RECENT = 100;

function _push(e: SessionEvent): void {
  if (_recentEvents.length >= MAX_RECENT) _recentEvents.shift();
  _recentEvents.push(e);
}

function _recentRate(type: SessionEvent['eventType']): number {
  const relevant = _recentEvents.slice(-30);
  if (relevant.length === 0) return 0;
  return relevant.filter(e => e.eventType === type).length / relevant.length;
}

// ── Module API ────────────────────────────────────────────────────────────────

export const browserReliabilityEngine = {
  /** Record a browser session event. */
  recordEvent(event: SessionEvent): void {
    _push(event);

    const mappings: Array<{ type: SessionEvent['eventType']; key: string; goodEvents: SessionEvent['eventType'][] }> = [
      { type: 'crash',              key: CRASH_KEY,      goodEvents: [] },
      { type: 'navigation-success', key: NAV_KEY,        goodEvents: ['navigation-success'] },
      { type: 'navigation-failure', key: NAV_KEY,        goodEvents: [] },
      { type: 'timeout',            key: TIMEOUT_KEY,    goodEvents: [] },
      { type: 'validation-pass',    key: VALIDATION_KEY, goodEvents: ['validation-pass'] },
      { type: 'validation-fail',    key: VALIDATION_KEY, goodEvents: [] },
    ];

    for (const m of mappings) {
      if (event.eventType !== m.type) continue;
      const isGood    = m.goodEvents.includes(event.eventType);
      const delta     = isGood ? 0.04 : -0.06;
      const current   = learningStore.getValue('browser-pattern', m.key, 0.7);
      const evidence  = (learningStore.get('browser-pattern', m.key)?.evidence ?? 0) + 1;
      const verdict   = learningGovernor.permitUpdate(m.key, current, delta, evidence);
      if (verdict.permitted) {
        learningStore.upsert('browser-pattern', m.key, verdict.actualDelta, { eventType: event.eventType });
      }
    }

    // Recompute overall reliability
    const navRel    = learningStore.getValue('browser-pattern', NAV_KEY,        0.7);
    const crashRate = 1 - learningStore.getValue('browser-pattern', CRASH_KEY,  0.95);
    const valRate   = learningStore.getValue('browser-pattern', VALIDATION_KEY, 0.7);
    const overall   = navRel * 0.5 + (1 - crashRate) * 0.3 + valRate * 0.2;

    const ovCurrent  = learningStore.getValue('browser-pattern', OVERALL_KEY, 0.7);
    const ovEvidence = (learningStore.get('browser-pattern', OVERALL_KEY)?.evidence ?? 0) + 1;
    const ovDelta    = overall - ovCurrent;
    if (Math.abs(ovDelta) > 0.01) {
      const ovVerdict = learningGovernor.permitUpdate(OVERALL_KEY, ovCurrent, ovDelta, ovEvidence);
      if (ovVerdict.permitted) {
        learningStore.upsert('browser-pattern', OVERALL_KEY, ovVerdict.actualDelta, { computed: 'overall' });
      }
    }
  },

  /** Predict whether this browser session is likely to crash. */
  predictCrash(runId?: string): CrashPrediction {
    const crashRate = 1 - learningStore.getValue('browser-pattern', CRASH_KEY, 0.95);
    const navRate   = learningStore.getValue('browser-pattern', NAV_KEY, 0.7);
    const timeoutRate = 1 - learningStore.getValue('browser-pattern', TIMEOUT_KEY, 0.9);

    const topReasons: string[] = [];
    if (crashRate > 0.2)    topReasons.push(`crash rate ${(crashRate * 100).toFixed(0)}% above threshold`);
    if (navRate < 0.5)      topReasons.push(`navigation success only ${(navRate * 100).toFixed(0)}%`);
    if (timeoutRate > 0.15) topReasons.push(`timeout rate ${(timeoutRate * 100).toFixed(0)}%`);

    const recentCrashRate = _recentRate('crash');
    if (recentCrashRate > 0.1) topReasons.push(`${(recentCrashRate * 100).toFixed(0)}% crash rate in last 30 events`);

    const probability  = Math.min(0.95, crashRate * 0.5 + (1 - navRate) * 0.3 + recentCrashRate * 0.3);
    const crashLikely  = probability > 0.35;

    let mitigation = 'Standard browser execution';
    if (probability > 0.6)      mitigation = 'Use filesystem fallback — browser critically unstable';
    else if (probability > 0.4) mitigation = 'Add screenshot + health check before each step';
    else if (probability > 0.25) mitigation = 'Increase wait times + retry budget';

    return { crashLikely, probability, topReasons, mitigation };
  },

  /** Get a full browser reliability snapshot. */
  snapshot(): BrowserReliabilitySnapshot {
    const overall     = learningStore.getValue('browser-pattern', OVERALL_KEY,      0.7);
    const navSuccess  = learningStore.getValue('browser-pattern', NAV_KEY,          0.7);
    const crashRaw    = 1 - learningStore.getValue('browser-pattern', CRASH_KEY,    0.95);
    const timeoutRaw  = 1 - learningStore.getValue('browser-pattern', TIMEOUT_KEY,  0.9);
    const valPass     = learningStore.getValue('browser-pattern', VALIDATION_KEY,   0.7);

    let grade: BrowserReliabilitySnapshot['sessionHealthGrade'] = 'healthy';
    if (overall < 0.4)      grade = 'critical';
    else if (overall < 0.65) grade = 'degraded';

    let recommendation = 'Browser stable — standard execution';
    if (grade === 'critical')  recommendation = 'Browser critically unreliable — prefer filesystem/terminal fallback';
    else if (grade === 'degraded') recommendation = 'Browser degraded — add checkpoints and screenshot validation';

    return {
      overallReliability:    overall,
      crashRate:             Math.round(crashRaw * 100),
      navigationSuccessRate: navSuccess,
      timeoutRate:           timeoutRaw,
      validationPassRate:    valPass,
      sessionHealthGrade:    grade,
      recommendation,
    };
  },

  /** Feed metrics from browser-metrics into this engine (batch sync). */
  syncFromMetrics(runId: string): void {
    const m = browserMetrics.get(runId);
    if (m.crashes > 0) {
      for (let i = 0; i < m.crashes; i++) {
        this.recordEvent({ runId, eventType: 'crash', durationMs: 0 });
      }
    }
    const failedNavs = m.navigations - m.flowsOk;
    if (failedNavs > 0) {
      for (let i = 0; i < failedNavs; i++) {
        this.recordEvent({ runId, eventType: 'navigation-failure', durationMs: 0 });
      }
    }
    if (m.flowsOk > 0) {
      for (let i = 0; i < m.flowsOk; i++) {
        this.recordEvent({ runId, eventType: 'navigation-success', durationMs: 0 });
      }
    }
  },

  reset(): void {
    _recentEvents.length = 0;
  },
};
