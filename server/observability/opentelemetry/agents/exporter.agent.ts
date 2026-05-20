import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

import { transitionState } from "../state.js";
import type {
  ExportPayload,
  ExporterConfig,
  ExporterTarget,
  Metric,
  Span,
  TelemetryState,
} from "../types.js";
import { toPrometheusLine } from "../utils/metric.util.js";
import { nowIso } from "../utils/time.util.js";
import { buildError, buildLog } from "../utils/logger.util.js";

const SOURCE = "exporter";

const DEFAULT_TARGETS: Readonly<Record<ExporterTarget, string>> = Object.freeze({
  jaeger: "http://localhost:14268/api/traces",
  zipkin: "http://localhost:9411/api/v2/spans",
  prometheus: "http://localhost:9091/metrics/job/otel",
  console: "",
});

export interface ExportInput {
  readonly traceId: string;
  readonly spans: readonly Readonly<Span>[];
  readonly metrics: readonly Readonly<Metric>[];
  readonly config: Readonly<ExporterConfig>;
}

export interface ExportResult {
  readonly nextState: Readonly<TelemetryState>;
  readonly exported: boolean;
  readonly target: ExporterTarget;
  readonly payload: Readonly<ExportPayload>;
}

function buildPayload(
  input: ExportInput,
): Readonly<ExportPayload> {
  return Object.freeze({
    traceId: input.traceId,
    spans: input.spans,
    metrics: input.metrics,
    service: input.config.serviceName,
    exportedAt: nowIso(),
  });
}

function serializeForTarget(
  target: ExporterTarget,
  payload: Readonly<ExportPayload>,
): string {
  if (target === "prometheus") {
    return payload.metrics.map(toPrometheusLine).join("\n");
  }
  return JSON.stringify(payload);
}

function postPayload(
  endpoint: string,
  body: string,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const requester = url.protocol === "https:" ? httpsRequest : httpRequest;

    const req = requester(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: timeoutMs,
      },
      (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Export HTTP ${res.statusCode}`));
        } else {
          resolve();
        }
      },
    );

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Export request timed out"));
    });

    req.write(body);
    req.end();
  });
}

export async function exportTelemetry(
  state: Readonly<TelemetryState>,
  input: ExportInput,
): Promise<Readonly<ExportResult>> {
  const payload = buildPayload(input);
  const target = input.config.target;
  const endpoint =
    input.config.endpoint ?? DEFAULT_TARGETS[target];
  const timeoutMs = input.config.timeout ?? 5_000;

  if (target === "console") {
    process.stdout.write(
      `[otel-export] ${JSON.stringify(payload, null, 2)}\n`,
    );

    const log = buildLog(SOURCE, `Exported to console: traceId=${input.traceId} spans=${input.spans.length} metrics=${input.metrics.length}`);
    return {
      nextState: transitionState(state, { appendLog: log }),
      exported: true,
      target,
      payload,
    };
  }

  try {
    const body = serializeForTarget(target, payload);
    await postPayload(endpoint, body, timeoutMs);

    const log = buildLog(
      SOURCE,
      `Exported to ${target}: traceId=${input.traceId} endpoint=${endpoint} spans=${input.spans.length}`,
    );
    return {
      nextState: transitionState(state, { appendLog: log }),
      exported: true,
      target,
      payload,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown export error";
    const err = buildError(SOURCE, `Export to ${target} failed: ${message}`);
    const log = buildLog(SOURCE, `Export failed: ${message} — falling back to console`);

    process.stdout.write(`[otel-export-fallback] ${JSON.stringify(payload)}\n`);

    return {
      nextState: transitionState(state, { appendLog: log, appendError: err }),
      exported: false,
      target,
      payload,
    };
  }
}
