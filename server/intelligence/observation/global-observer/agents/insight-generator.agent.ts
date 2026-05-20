import type { Anomaly, Trend, DetectedPattern, SignalGroup, Insight } from "../types";

export interface InsightGeneratorOutput {
  success: boolean;
  logs: string[];
  error?: string;
  insights?: Insight[];
}

let insightCounter = 0;
function makeInsightId(): string {
  insightCounter = (insightCounter + 1) % 100000;
  return `insight-${Date.now()}-${insightCounter}`;
}

function priorityFromSeverity(severity: string): Insight["priority"] {
  const map: Record<string, Insight["priority"]> = {
    critical: "critical",
    high: "high",
    medium: "medium",
    low: "low",
  };
  return map[severity] ?? "low";
}

export function generateInsights(
  anomalies: Anomaly[],
  trends: Trend[],
  patterns: DetectedPattern[],
  signals: SignalGroup[],
  healthScore: number
): InsightGeneratorOutput {
  const logs: string[] = [];

  try {
    logs.push(`[insight-generator] generating insights — anomalies=${anomalies.length} trends=${trends.length} patterns=${patterns.length} health=${healthScore}`);
    const insights: Insight[] = [];

    for (const a of anomalies) {
      const actionMap: Record<string, string> = {
        "error-rate-surge": `Investigate and reduce failure rate in '${a.module}' — check logs, increase retry tolerance, add circuit breaker`,
        "latency-spike": `Profile '${a.module}' for slow I/O paths — consider caching or parallelizing hotspots`,
        "failure-burst": `Add exponential backoff and health checks to '${a.module}' to prevent cascading failures`,
        "dead-agent": `Restart or redeploy agent '${a.agent ?? "unknown"}' in '${a.module}' — it has stopped responding`,
        "throughput-drop": `Review queue depth and concurrency settings in '${a.module}' to restore throughput`,
      };

      insights.push({
        id: makeInsightId(),
        priority: priorityFromSeverity(a.severity),
        module: a.module,
        title: `${a.type.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} in ${a.module}`,
        description: a.description,
        recommendedAction: actionMap[a.type] ?? `Investigate anomaly in '${a.module}'`,
        relatedAnomalies: [a.id],
      });
      logs.push(`[insight-generator] anomaly insight for module=${a.module} type=${a.type} priority=${priorityFromSeverity(a.severity)}`);
    }

    for (const t of trends) {
      if (t.direction === "degrading" && Math.abs(t.changePercent) > 10) {
        const metricLabel = t.metric === "latency" ? "latency increasing" : t.metric === "successRate" ? "success rate dropping" : "throughput falling";
        insights.push({
          id: makeInsightId(),
          priority: Math.abs(t.changePercent) > 30 ? "high" : "medium",
          module: t.module,
          title: `Degrading ${t.metric} trend in ${t.module}`,
          description: `${t.module} shows ${metricLabel}: ${t.changePercent.toFixed(1)}% change from baseline ${t.baselineValue} → ${t.currentValue}`,
          recommendedAction: t.metric === "latency"
            ? `Optimize or cache frequent operations in '${t.module}'`
            : t.metric === "successRate"
            ? `Add defensive error handling and retry logic in '${t.module}'`
            : `Review concurrency limits and queue configuration in '${t.module}'`,
          relatedAnomalies: [],
        });
        logs.push(`[insight-generator] trend insight for module=${t.module} metric=${t.metric} change=${t.changePercent}%`);
      }
    }

    for (const p of patterns) {
      if (p.type === "repeated-failure" && p.confidence > 0.5) {
        insights.push({
          id: makeInsightId(),
          priority: p.confidence > 0.8 ? "high" : "medium",
          module: p.module,
          title: `Repeated failure pattern in ${p.module}`,
          description: p.description,
          recommendedAction: `Audit error handling in '${p.module}' — add recovery agent integration and structured retry policy`,
          relatedAnomalies: [],
        });
        logs.push(`[insight-generator] pattern insight module=${p.module} type=${p.type}`);
      }
    }

    if (healthScore < 40) {
      const worstModule = signals.reduce((worst, sig) =>
        sig.successRate < (signals.find((s) => s.module === worst.module)?.successRate ?? 1) ? sig : worst
      , signals[0]);

      insights.push({
        id: makeInsightId(),
        priority: "critical",
        module: worstModule?.module ?? "system",
        title: "System health critically low",
        description: `Overall health score ${healthScore}/100 — immediate investigation required`,
        recommendedAction: "Trigger global-governor to pause non-critical operations and run recovery engine on all failing modules",
        relatedAnomalies: anomalies.map((a) => a.id),
      });
      logs.push(`[insight-generator] critical system health insight score=${healthScore}`);
    } else if (healthScore < 60) {
      insights.push({
        id: makeInsightId(),
        priority: "high",
        module: "system",
        title: "System health below acceptable threshold",
        description: `Overall health score ${healthScore}/100 — performance degrading`,
        recommendedAction: "Review highest-severity anomalies and apply self-improvement recommendations",
        relatedAnomalies: anomalies.filter((a) => a.severity === "high" || a.severity === "critical").map((a) => a.id),
      });
      logs.push(`[insight-generator] degraded system health insight score=${healthScore}`);
    }

    insights.sort((a, b) => {
      const ORDER: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };
      return (ORDER[b.priority] ?? 0) - (ORDER[a.priority] ?? 0);
    });

    logs.push(`[insight-generator] generated ${insights.length} insight(s)`);
    return { success: true, logs, insights };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(`[insight-generator] ERROR: ${message}`);
    return { success: false, logs, error: message };
  }
}
