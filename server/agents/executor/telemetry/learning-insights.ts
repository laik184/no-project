/**
 * server/agents/executor/telemetry/learning-insights.ts
 *
 * Explains WHY the system adapted — human-readable insight generation.
 * Reads from learning-store, pattern-learner, tool-selection-engine,
 * strategy-optimizer. Pure read layer — no writes, no side effects.
 */

import { learningStore }         from '../learning/learning-store.ts';
import { patternLearner }        from '../learning/pattern-learner.ts';
import { toolSelectionEngine }   from '../learning/tool-selection-engine.ts';
import { strategyOptimizer }     from '../learning/strategy-optimizer.ts';
import { failurePredictor }      from '../learning/failure-predictor.ts';
import { feedbackLoop }          from '../learning/feedback-loop.ts';
import { learningGovernor }      from '../learning/learning-governor.ts';

// ── Insight types ─────────────────────────────────────────────────────────────

export interface LearningInsight {
  category:    'tool-adaptation' | 'strategy-change' | 'risk-prediction' | 'workflow-optimization' | 'governance';
  severity:    'info' | 'warning' | 'critical';
  title:       string;
  explanation: string;
  dataPoints:  string[];
  timestamp:   number;
}

export interface LearningInsightReport {
  generatedAt:  number;
  totalInsights: number;
  insights:     LearningInsight[];
  storeSummary: ReturnType<typeof learningStore.summary>;
  governorStats: ReturnType<typeof learningGovernor.stats>;
  feedbackStats: ReturnType<typeof feedbackLoop.stats>;
}

// ── Insight generators ────────────────────────────────────────────────────────

function _toolInsights(): LearningInsight[] {
  const insights: LearningInsight[] = [];
  const unreliable = toolSelectionEngine.unreliableTools(0.4);

  for (const { toolName, confidence } of unreliable) {
    const pct = (confidence * 100).toFixed(0);
    insights.push({
      category:    'tool-adaptation',
      severity:    confidence < 0.25 ? 'critical' : 'warning',
      title:       `Tool "${toolName}" deprioritized`,
      explanation: `Tool selection adapted: "${toolName}" reliability dropped to ${pct}%. ` +
                   `System will prefer alternatives when available.`,
      dataPoints:  [
        `Current reliability: ${pct}%`,
        `Evidence: ${learningStore.get('tool-reliability', `tool::${toolName}`)?.evidence ?? 0} observations`,
      ],
      timestamp: Date.now(),
    });
  }

  // Highlight most reliable tools
  const top = toolSelectionEngine.snapshot();
  const topEntries = Object.entries(top)
    .filter(([, v]) => v > 0.8)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);
  for (const [toolName, confidence] of topEntries) {
    insights.push({
      category:    'tool-adaptation',
      severity:    'info',
      title:       `Tool "${toolName}" high confidence`,
      explanation: `"${toolName}" achieved ${(confidence * 100).toFixed(0)}% reliability — preferred for its kind.`,
      dataPoints:  [`Reliability: ${(confidence * 100).toFixed(0)}%`],
      timestamp:   Date.now(),
    });
  }

  return insights;
}

function _strategyInsights(): LearningInsight[] {
  const insights: LearningInsight[] = [];
  const kinds = ['terminal', 'filesystem', 'coding', 'verify', 'browser'] as const;

  for (const kind of kinds) {
    const rec = strategyOptimizer.optimizeStrategy(kind);
    if (rec.primary !== 'standard' && rec.confidence > 0.5) {
      insights.push({
        category:    'strategy-change',
        severity:    'info',
        title:       `Strategy adapted for "${kind}" tasks`,
        explanation: rec.rationale,
        dataPoints:  [
          `Primary strategy: ${rec.primary}`,
          `Confidence: ${(rec.confidence * 100).toFixed(0)}%`,
          `Fallback: ${rec.fallback}`,
        ],
        timestamp: Date.now(),
      });
    }
  }

  return insights;
}

function _riskInsights(): LearningInsight[] {
  const insights: LearningInsight[] = [];
  const highRisk = failurePredictor.highRiskTools();

  for (const { toolName, reliability, riskScore } of highRisk.slice(0, 3)) {
    insights.push({
      category:    'risk-prediction',
      severity:    riskScore > 70 ? 'critical' : 'warning',
      title:       `High failure risk: "${toolName}"`,
      explanation: `Failure predictor flags "${toolName}" with ${riskScore}% risk score. ` +
                   `Reliability at ${(reliability * 100).toFixed(0)}% — checkpoint recommended.`,
      dataPoints:  [
        `Risk score: ${riskScore}/100`,
        `Reliability: ${(reliability * 100).toFixed(0)}%`,
      ],
      timestamp: Date.now(),
    });
  }

  return insights;
}

function _governanceInsights(): LearningInsight[] {
  const insights: LearningInsight[] = [];
  const stats = learningGovernor.stats();

  if (stats.totalBlocked > stats.totalPermitted * 0.3) {
    insights.push({
      category:    'governance',
      severity:    'warning',
      title:       'High adaptation block rate',
      explanation: `${stats.totalBlocked} updates blocked vs ${stats.totalPermitted} permitted. ` +
                   `Governor is throttling learning — system may be under stress.`,
      dataPoints:  [
        `Blocked: ${stats.totalBlocked}`,
        `Permitted: ${stats.totalPermitted}`,
        `Recent updates: ${stats.recentUpdates}/${stats.windowCapacity}`,
      ],
      timestamp: Date.now(),
    });
  }

  if (stats.recentUpdates >= stats.windowCapacity * 0.8) {
    insights.push({
      category: 'governance',
      severity: 'warning',
      title:    'Approaching adaptation rate limit',
      explanation: `${stats.recentUpdates}/${stats.windowCapacity} update slots used in current window.`,
      dataPoints: [`Capacity: ${Math.round((stats.recentUpdates / stats.windowCapacity) * 100)}%`],
      timestamp: Date.now(),
    });
  }

  return insights;
}

// ── Public API ────────────────────────────────────────────────────────────────

export const learningInsights = {
  /** Generate a full insight report across all learning dimensions. */
  generateReport(): LearningInsightReport {
    const insights: LearningInsight[] = [
      ..._toolInsights(),
      ..._strategyInsights(),
      ..._riskInsights(),
      ..._governanceInsights(),
    ];

    return {
      generatedAt:   Date.now(),
      totalInsights: insights.length,
      insights,
      storeSummary:  learningStore.summary(),
      governorStats: learningGovernor.stats(),
      feedbackStats: feedbackLoop.stats(),
    };
  },

  /** Human-readable explanation of why tool selection changed. */
  explainToolAdaptation(toolName: string): string {
    const conf  = toolSelectionEngine.getToolConfidence(toolName);
    const entry = learningStore.get('tool-reliability', `tool::${toolName}`);
    if (!entry) return `No learned data for "${toolName}" yet — using static routing.`;

    const pct  = (conf * 100).toFixed(0);
    const obs  = entry.evidence;
    const last = String(entry.metadata?.lastOutcome ?? 'unknown');
    return `Tool "${toolName}" selection confidence: ${pct}% after ${obs} observation(s). ` +
           `Last outcome: ${last}. ${conf < 0.4 ? 'Currently deprioritized.' : 'Currently trusted.'}`;
  },

  /** Summary text for observability UI. */
  summaryText(): string {
    const s     = learningStore.summary();
    const gStats = learningGovernor.stats();
    const fStats = feedbackLoop.stats();
    return [
      `Learning store: ${s.totalEntries} entries (v${s.version})`,
      `Governor: ${gStats.totalPermitted} permitted / ${gStats.totalBlocked} blocked`,
      `Feedback cycles: ${fStats.cyclesThisHour}/${fStats.maxCyclesHour} this hour`,
      `Unreliable tools: ${toolSelectionEngine.unreliableTools().length}`,
    ].join(' | ');
  },
};
