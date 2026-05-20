import type { SignalGroup, ObservationEvent, Anomaly } from "../types";
import {
  isSeverityCritical,
  isSeverityHigh,
  isLatencySpike,
  isFailureBurst,
} from "../utils/threshold.util";
import { groupByAgent } from "../utils/time-window.util";

export interface AnomalyDetectorOutput {
  success: boolean;
  logs: string[];
  error?: string;
  anomalies?: Anomaly[];
}

let anomalyCounter = 0;
function makeAnomalyId(): string {
  anomalyCounter = (anomalyCounter + 1) % 100000;
  return `anomaly-${Date.now()}-${anomalyCounter}`;
}

export function detectAnomalies(
  signals: SignalGroup[],
  events: ObservationEvent[]
): AnomalyDetectorOutput {
  const logs: string[] = [];

  try {
    logs.push(`[anomaly-detector] scanning ${signals.length} module(s) for anomalies`);
    const anomalies: Anomaly[] = [];

    for (const sig of signals) {
      const errorRate = sig.failCount / sig.totalEvents;

      if (isSeverityCritical(errorRate)) {
        anomalies.push({
          id: makeAnomalyId(),
          type: "error-rate-surge",
          module: sig.module,
          severity: "critical",
          description: `Critical error surge in '${sig.module}': ${(errorRate * 100).toFixed(1)}% failure rate`,
          detectedAt: Date.now(),
          metric: "errorRate",
          currentValue: errorRate,
          thresholdValue: 0.5,
        });
        logs.push(`[anomaly-detector] error-rate-surge CRITICAL module=${sig.module} rate=${(errorRate * 100).toFixed(1)}%`);
      } else if (isSeverityHigh(errorRate)) {
        anomalies.push({
          id: makeAnomalyId(),
          type: "error-rate-surge",
          module: sig.module,
          severity: "high",
          description: `High error rate in '${sig.module}': ${(errorRate * 100).toFixed(1)}%`,
          detectedAt: Date.now(),
          metric: "errorRate",
          currentValue: errorRate,
          thresholdValue: 0.2,
        });
        logs.push(`[anomaly-detector] error-rate-surge HIGH module=${sig.module} rate=${(errorRate * 100).toFixed(1)}%`);
      }

      if (isLatencySpike(sig.maxLatency, sig.avgLatency)) {
        const severity = sig.maxLatency > 4000 ? "critical" : sig.maxLatency > 2500 ? "high" : "medium";
        anomalies.push({
          id: makeAnomalyId(),
          type: "latency-spike",
          module: sig.module,
          severity,
          description: `Latency spike in '${sig.module}': peak ${sig.maxLatency}ms vs avg ${sig.avgLatency}ms`,
          detectedAt: Date.now(),
          metric: "maxLatency",
          currentValue: sig.maxLatency,
          thresholdValue: sig.avgLatency * 2.5,
        });
        logs.push(`[anomaly-detector] latency-spike ${severity} module=${sig.module} peak=${sig.maxLatency}ms`);
      }

      if (isFailureBurst(sig.failCount, sig.totalEvents)) {
        anomalies.push({
          id: makeAnomalyId(),
          type: "failure-burst",
          module: sig.module,
          severity: sig.failCount >= 5 ? "high" : "medium",
          description: `Failure burst in '${sig.module}': ${sig.failCount} failures in ${sig.totalEvents} events`,
          detectedAt: Date.now(),
          metric: "failCount",
          currentValue: sig.failCount,
          thresholdValue: 3,
        });
        logs.push(`[anomaly-detector] failure-burst module=${sig.module} failCount=${sig.failCount}`);
      }
    }

    const byAgent = groupByAgent(events);
    for (const [key, agentEvents] of byAgent.entries()) {
      const hasRecent = agentEvents.some((e) => Date.now() - e.timestamp < 60000);
      const allFailed = agentEvents.length >= 3 && agentEvents.every((e) => e.status === "fail");
      if (allFailed && hasRecent) {
        const [module, agent] = key.split("::");
        anomalies.push({
          id: makeAnomalyId(),
          type: "dead-agent",
          module,
          agent,
          severity: "critical",
          description: `Agent '${agent}' in '${module}' has ${agentEvents.length} consecutive failures`,
          detectedAt: Date.now(),
          metric: "failRate",
          currentValue: 1.0,
          thresholdValue: 0.5,
        });
        logs.push(`[anomaly-detector] dead-agent CRITICAL module=${module} agent=${agent}`);
      }
    }

    anomalies.sort((a, b) => {
      const ORDER: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };
      return (ORDER[b.severity] ?? 0) - (ORDER[a.severity] ?? 0);
    });

    logs.push(`[anomaly-detector] detected ${anomalies.length} anomaly(ies)`);
    return { success: true, logs, anomalies };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(`[anomaly-detector] ERROR: ${message}`);
    return { success: false, logs, error: message };
  }
}
