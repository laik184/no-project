import type { CodeFile, ObservabilityIssue, MonitoringHooksResult } from "../types.js";
import {
  HEALTH_ENDPOINT_PATTERNS,
  METRICS_HOOK_PATTERNS,
  TRACE_CONTEXT_PATTERNS,
  ALERT_HOOK_PATTERNS,
} from "../types.js";
import {
  hasAnyPattern,
  isServerFile,
} from "../utils/pattern.matcher.util.js";

let _issueCounter = 0;
function nextId(): string {
  _issueCounter += 1;
  return `obs-mon-${Date.now()}-${String(_issueCounter).padStart(4, "0")}`;
}

function checkHealthEndpoints(
  files: readonly CodeFile[],
): readonly ObservabilityIssue[] {
  const serverFiles = files.filter(isServerFile);
  if (serverFiles.length === 0) return Object.freeze([]);

  const hasHealthEndpoint = serverFiles.some((f) =>
    hasAnyPattern(f.content, HEALTH_ENDPOINT_PATTERNS),
  );

  if (!hasHealthEndpoint) {
    return Object.freeze([
      Object.freeze<ObservabilityIssue>({
        id:         nextId(),
        type:       "MISSING_HEALTH_ENDPOINT",
        severity:   "HIGH",
        filePath:   serverFiles[0]?.path ?? "unknown",
        line:       null,
        column:     null,
        message:    `No health check endpoint (/health, /healthz, /liveness, /readiness, /ping) found in server files. Orchestrators and load balancers cannot verify service availability.`,
        rule:       "OBS-MON-001",
        suggestion: "Add a GET /health route that returns { status: 'ok', uptime, timestamp } so container orchestrators and load balancers can confirm liveness.",
        snippet:    null,
      }),
    ]);
  }

  return Object.freeze([]);
}

function checkMetricsHooks(
  files: readonly CodeFile[],
): readonly ObservabilityIssue[] {
  const hasMetrics = files.some((f) =>
    hasAnyPattern(f.content, METRICS_HOOK_PATTERNS),
  );

  if (!hasMetrics) {
    const serverFiles = files.filter(isServerFile);
    const targetFile  = serverFiles[0] ?? files[0];
    if (!targetFile) return Object.freeze([]);

    return Object.freeze([
      Object.freeze<ObservabilityIssue>({
        id:         nextId(),
        type:       "MISSING_METRICS_HOOK",
        severity:   "MEDIUM",
        filePath:   targetFile.path,
        line:       null,
        column:     null,
        message:    `No metrics instrumentation found (Prometheus, StatsD, Datadog, CloudWatch, New Relic). Service performance is unobservable at runtime.`,
        rule:       "OBS-MON-002",
        suggestion: "Integrate a metrics client (e.g., prom-client for Prometheus) and expose a /metrics endpoint for scraping, or push metrics to your APM provider.",
        snippet:    null,
      }),
    ]);
  }

  return Object.freeze([]);
}

function checkTraceContext(
  files: readonly CodeFile[],
): readonly ObservabilityIssue[] {
  const hasTracing = files.some((f) =>
    hasAnyPattern(f.content, TRACE_CONTEXT_PATTERNS),
  );

  if (!hasTracing) {
    const serverFiles = files.filter(isServerFile);
    const targetFile  = serverFiles[0] ?? files[0];
    if (!targetFile) return Object.freeze([]);

    return Object.freeze([
      Object.freeze<ObservabilityIssue>({
        id:         nextId(),
        type:       "MISSING_TRACE_CONTEXT",
        severity:   "MEDIUM",
        filePath:   targetFile.path,
        line:       null,
        column:     null,
        message:    `No distributed tracing integration detected (OpenTelemetry, Jaeger, Zipkin). Cross-service request flows cannot be reconstructed.`,
        rule:       "OBS-MON-003",
        suggestion: "Instrument with OpenTelemetry (@opentelemetry/sdk-node) and propagate trace context headers (traceparent) across service boundaries.",
        snippet:    null,
      }),
    ]);
  }

  return Object.freeze([]);
}

function checkAlertHooks(
  files: readonly CodeFile[],
): readonly ObservabilityIssue[] {
  const hasAlerts = files.some((f) =>
    hasAnyPattern(f.content, ALERT_HOOK_PATTERNS),
  );

  if (!hasAlerts) {
    const serverFiles = files.filter(isServerFile);
    const targetFile  = serverFiles[0] ?? files[0];
    if (!targetFile) return Object.freeze([]);

    return Object.freeze([
      Object.freeze<ObservabilityIssue>({
        id:         nextId(),
        type:       "NO_ALERT_HOOK",
        severity:   "LOW",
        filePath:   targetFile.path,
        line:       null,
        column:     null,
        message:    `No on-call alerting integration found (PagerDuty, OpsGenie, VictorOps, AlertManager). Critical failures may go unnoticed outside business hours.`,
        rule:       "OBS-MON-004",
        suggestion: "Integrate an alerting hook that triggers on CRITICAL severity events or unhandled exceptions in production, routing to your on-call platform.",
        snippet:    null,
      }),
    ]);
  }

  return Object.freeze([]);
}

export function detectMonitoringHooks(
  files: readonly CodeFile[],
): MonitoringHooksResult {
  if (files.length === 0) {
    return Object.freeze({
      issues:                  Object.freeze([]),
      filesScanned:            0,
      missingHealthEndpoints:  0,
      missingMetricsHooks:     0,
    });
  }

  const healthIssues   = checkHealthEndpoints(files);
  const metricsIssues  = checkMetricsHooks(files);
  const traceIssues    = checkTraceContext(files);
  const alertIssues    = checkAlertHooks(files);

  const allIssues: ObservabilityIssue[] = [
    ...healthIssues,
    ...metricsIssues,
    ...traceIssues,
    ...alertIssues,
  ];

  return Object.freeze({
    issues:                 Object.freeze(allIssues),
    filesScanned:           files.length,
    missingHealthEndpoints: healthIssues.length,
    missingMetricsHooks:    metricsIssues.length,
  });
}
