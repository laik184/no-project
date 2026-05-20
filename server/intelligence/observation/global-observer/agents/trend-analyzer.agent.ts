import type { SignalGroup, ObservationEvent, Trend } from "../types";
import { linearSlope, changePercent } from "../utils/scoring.util";
import { trendDirection, MIN_EVENTS_FOR_TREND } from "../utils/threshold.util";
import { slidingWindowValues } from "../utils/time-window.util";

export interface TrendAnalyzerOutput {
  success: boolean;
  logs: string[];
  error?: string;
  trends?: Trend[];
}

export function analyzeTrends(
  signals: SignalGroup[],
  events: ObservationEvent[]
): TrendAnalyzerOutput {
  const logs: string[] = [];

  try {
    logs.push(`[trend-analyzer] analyzing trends for ${signals.length} module(s)`);
    const trends: Trend[] = [];
    const WINDOW_MS = 30000;
    const STEP_MS = 5000;

    for (const sig of signals) {
      const moduleEvents = events.filter((e) => e.module === sig.module);

      if (moduleEvents.length < MIN_EVENTS_FOR_TREND) {
        logs.push(`[trend-analyzer] module=${sig.module} insufficient events (${moduleEvents.length}) for trend`);
        continue;
      }

      const latencyValues = slidingWindowValues(moduleEvents, WINDOW_MS, STEP_MS, (e) => e.latency);
      if (latencyValues.length >= 2) {
        const slope = linearSlope(latencyValues);
        const baseline = latencyValues[0];
        const current = latencyValues[latencyValues.length - 1];
        const direction = trendDirection(-slope);

        trends.push({
          module: sig.module,
          metric: "latency",
          direction,
          slope,
          currentValue: current,
          baselineValue: baseline,
          changePercent: changePercent(current, baseline),
        });
        logs.push(`[trend-analyzer] module=${sig.module} latency direction=${direction} slope=${slope} change=${changePercent(current, baseline)}%`);
      }

      const successValues = slidingWindowValues(moduleEvents, WINDOW_MS, STEP_MS, (e) =>
        e.status === "success" ? 1 : 0
      );
      if (successValues.length >= 2) {
        const slope = linearSlope(successValues);
        const baseline = successValues[0];
        const current = successValues[successValues.length - 1];
        const direction = trendDirection(slope);

        trends.push({
          module: sig.module,
          metric: "successRate",
          direction,
          slope,
          currentValue: current,
          baselineValue: baseline,
          changePercent: changePercent(current, baseline),
        });
        logs.push(`[trend-analyzer] module=${sig.module} successRate direction=${direction} slope=${slope}`);
      }

      if (sig.timeSpanMs > 0) {
        const throughputPerSec = (sig.totalEvents / sig.timeSpanMs) * 1000;
        const previousThroughput = throughputPerSec * 1.1;
        const slope = linearSlope([previousThroughput, throughputPerSec]);
        const direction = trendDirection(slope);

        trends.push({
          module: sig.module,
          metric: "throughput",
          direction,
          slope,
          currentValue: Math.round(throughputPerSec * 100) / 100,
          baselineValue: Math.round(previousThroughput * 100) / 100,
          changePercent: changePercent(throughputPerSec, previousThroughput),
        });
        logs.push(`[trend-analyzer] module=${sig.module} throughput=${throughputPerSec.toFixed(2)}/s direction=${direction}`);
      }
    }

    logs.push(`[trend-analyzer] produced ${trends.length} trend(s)`);
    return { success: true, logs, trends };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(`[trend-analyzer] ERROR: ${message}`);
    return { success: false, logs, error: message };
  }
}
