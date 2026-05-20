import type { ObservationEvent, SignalGroup } from "../types";
import { groupByModule } from "../utils/time-window.util";

export interface SignalAggregatorOutput {
  success: boolean;
  logs: string[];
  error?: string;
  signals?: SignalGroup[];
}

export function aggregateSignals(events: ObservationEvent[]): SignalAggregatorOutput {
  const logs: string[] = [];

  try {
    logs.push(`[signal-aggregator] aggregating ${events.length} event(s) across modules`);

    const grouped = groupByModule(events);
    const signals: SignalGroup[] = [];

    for (const [module, moduleEvents] of grouped.entries()) {
      const successCount = moduleEvents.filter((e) => e.status === "success").length;
      const failCount = moduleEvents.filter((e) => e.status === "fail").length;
      const total = moduleEvents.length;
      const latencies = moduleEvents.map((e) => e.latency);
      const avgLatency = latencies.reduce((s, v) => s + v, 0) / latencies.length;
      const timestamps = moduleEvents.map((e) => e.timestamp);
      const timeSpanMs = timestamps.length > 1
        ? Math.max(...timestamps) - Math.min(...timestamps)
        : 0;
      const uniqueAgents = [...new Set(moduleEvents.map((e) => e.agent))];

      const signal: SignalGroup = {
        module,
        totalEvents: total,
        successCount,
        failCount,
        successRate: Math.round((successCount / total) * 1000) / 1000,
        avgLatency: Math.round(avgLatency * 10) / 10,
        maxLatency: Math.max(...latencies),
        minLatency: Math.min(...latencies),
        timeSpanMs,
        agents: uniqueAgents,
      };

      signals.push(signal);
      logs.push(`[signal-aggregator] module=${module} total=${total} successRate=${signal.successRate} avgLatency=${signal.avgLatency}ms agents=${uniqueAgents.length}`);
    }

    signals.sort((a, b) => b.totalEvents - a.totalEvents);
    logs.push(`[signal-aggregator] produced ${signals.length} signal group(s)`);
    return { success: true, logs, signals };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(`[signal-aggregator] ERROR: ${message}`);
    return { success: false, logs, error: message };
  }
}
