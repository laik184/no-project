import type { SignalGroup, ObservationEvent, DetectedPattern } from "../types";
import { groupByAgent } from "../utils/time-window.util";
import { SUCCESS_STREAK_MIN } from "../utils/threshold.util";

export interface PatternDetectorOutput {
  success: boolean;
  logs: string[];
  error?: string;
  patterns?: DetectedPattern[];
}

export function detectPatterns(
  signals: SignalGroup[],
  events: ObservationEvent[]
): PatternDetectorOutput {
  const logs: string[] = [];

  try {
    logs.push(`[pattern-detector] scanning ${signals.length} signal group(s) for patterns`);
    const patterns: DetectedPattern[] = [];

    for (const sig of signals) {
      if (sig.failCount >= 3 && sig.successRate < 0.5) {
        patterns.push({
          type: "repeated-failure",
          module: sig.module,
          description: `Module '${sig.module}' has ${sig.failCount} failures with success rate ${(sig.successRate * 100).toFixed(1)}%`,
          occurrences: sig.failCount,
          confidence: Math.min(1, sig.failCount / 10),
        });
        logs.push(`[pattern-detector] repeated-failure in module=${sig.module} failCount=${sig.failCount}`);
      }

      if (sig.maxLatency > sig.avgLatency * 3 && sig.maxLatency > 1000) {
        patterns.push({
          type: "latency-spike",
          module: sig.module,
          description: `Module '${sig.module}' max latency ${sig.maxLatency}ms is ${(sig.maxLatency / sig.avgLatency).toFixed(1)}x above average`,
          occurrences: 1,
          confidence: Math.min(1, sig.maxLatency / 5000),
        });
        logs.push(`[pattern-detector] latency-spike in module=${sig.module} max=${sig.maxLatency}ms avg=${sig.avgLatency}ms`);
      }

      if (sig.timeSpanMs > 0) {
        const eventsPerSec = (sig.totalEvents / sig.timeSpanMs) * 1000;
        if (eventsPerSec > 10) {
          patterns.push({
            type: "burst-activity",
            module: sig.module,
            description: `Module '${sig.module}' showing burst: ${eventsPerSec.toFixed(1)} events/sec`,
            occurrences: sig.totalEvents,
            confidence: Math.min(1, eventsPerSec / 50),
          });
          logs.push(`[pattern-detector] burst-activity in module=${sig.module} rate=${eventsPerSec.toFixed(1)}/s`);
        }
      }

      if (sig.totalEvents < 3 && sig.timeSpanMs > 60000) {
        patterns.push({
          type: "low-throughput",
          module: sig.module,
          description: `Module '${sig.module}' very low throughput: ${sig.totalEvents} events over ${(sig.timeSpanMs / 1000).toFixed(0)}s`,
          occurrences: sig.totalEvents,
          confidence: 0.7,
        });
        logs.push(`[pattern-detector] low-throughput in module=${sig.module}`);
      }
    }

    const byAgent = groupByAgent(events);
    for (const [key, agentEvents] of byAgent.entries()) {
      const successes = agentEvents.filter((e) => e.status === "success").length;
      if (successes >= SUCCESS_STREAK_MIN && successes === agentEvents.length) {
        const [module, agent] = key.split("::");
        patterns.push({
          type: "high-success-streak",
          module,
          agent,
          description: `Agent '${agent}' in '${module}' has ${successes} consecutive successes`,
          occurrences: successes,
          confidence: Math.min(1, successes / 20),
        });
        logs.push(`[pattern-detector] high-success-streak module=${module} agent=${agent} count=${successes}`);
      }
    }

    logs.push(`[pattern-detector] detected ${patterns.length} pattern(s)`);
    return { success: true, logs, patterns };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(`[pattern-detector] ERROR: ${message}`);
    return { success: false, logs, error: message };
  }
}
