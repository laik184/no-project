import { transitionState } from "../state.js";
import type { Metric, PrometheusState } from "../types.js";
import { renderAllMetrics } from "../utils/renderer.util.js";
import { buildLog } from "../utils/logger.util.js";

const SOURCE = "metrics-collector";

export interface AggregateResult {
  readonly nextState: Readonly<PrometheusState>;
  readonly allMetrics: readonly Readonly<Metric>[];
  readonly exposition: string;
  readonly metricsCount: number;
  readonly byType: Readonly<Record<string, number>>;
}

export function aggregateMetrics(
  state: Readonly<PrometheusState>,
): Readonly<AggregateResult> {
  const allMetrics = Object.freeze([...state.metrics]);
  const exposition = renderAllMetrics(allMetrics);

  const byType: Record<string, number> = {};
  for (const m of allMetrics) {
    byType[m.type] = (byType[m.type] ?? 0) + 1;
  }

  const log = buildLog(
    SOURCE,
    `Metrics aggregated: total=${allMetrics.length} ${Object.entries(byType)
      .map(([t, n]) => `${t}=${n}`)
      .join(" ")}`,
  );

  return {
    nextState: transitionState(state, { appendLog: log }),
    allMetrics,
    exposition,
    metricsCount: allMetrics.length,
    byType: Object.freeze(byType),
  };
}
