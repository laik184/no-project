/**
 * reroute-signal-analyzer.ts
 *
 * Analyses a RuntimeMetricsSnapshot and produces a list of active RerouteSignals.
 * Each signal has a strength (0–1) reflecting how far the metric has exceeded
 * its threshold. Pure computation — no side effects, no telemetry.
 */

import type { RerouteSignal, RerouteSignalKind, RuntimeMetricsSnapshot } from "./reroute-types.ts";
import { THRESHOLDS } from "./reroute-thresholds.ts";

// ── Signal detector registry ──────────────────────────────────────────────────

interface Detector {
  kind:    RerouteSignalKind;
  detect:  (m: RuntimeMetricsSnapshot) => RerouteSignal | null;
}

const DETECTORS: Detector[] = [

  {
    kind: "MASS_FILE_TOUCH",
    detect: (m) => {
      const t = THRESHOLDS.MASS_FILE_TOUCH;
      if (m.filesTouchedCount <= t) return null;
      return _signal("MASS_FILE_TOUCH", m.filesTouchedCount, t,
        `${m.filesTouchedCount} files touched (threshold: ${t})`);
    },
  },

  {
    kind: "RETRY_STORM",
    detect: (m) => {
      const t = THRESHOLDS.RETRY_STORM;
      if (m.retryCount <= t) return null;
      return _signal("RETRY_STORM", m.retryCount, t,
        `${m.retryCount} retries (threshold: ${t})`);
    },
  },

  {
    kind: "VERIFICATION_CASCADE",
    detect: (m) => {
      const t = THRESHOLDS.VERIFICATION_CASCADE;
      if (m.verificationFailCount <= t) return null;
      return _signal("VERIFICATION_CASCADE", m.verificationFailCount, t,
        `${m.verificationFailCount} verification failures (threshold: ${t})`);
    },
  },

  {
    kind: "RUNTIME_INSTABILITY",
    detect: (m) => {
      const t = THRESHOLDS.RUNTIME_INSTABILITY;
      const crashed = m.runtimeStatus === "crashed" ? 1 : 0;
      const restarts = m.runtimeRestarts;
      const value = restarts + crashed;
      if (value <= t) return null;
      return _signal("RUNTIME_INSTABILITY", value, t,
        `status=${m.runtimeStatus} restarts=${restarts}`);
    },
  },

  {
    kind: "DEPENDENCY_EXPLOSION",
    detect: (m) => {
      const t = THRESHOLDS.DEPENDENCY_EXPLOSION;
      if (m.dependencyCount <= t) return null;
      return _signal("DEPENDENCY_EXPLOSION", m.dependencyCount, t,
        `${m.dependencyCount} dependencies discovered (threshold: ${t})`);
    },
  },

  {
    kind: "HIGH_COMPLEXITY",
    detect: (m) => {
      const t = THRESHOLDS.TOOL_FAILURE_HIGH;
      if (m.toolFailureCount <= t) return null;
      return _signal("HIGH_COMPLEXITY", m.toolFailureCount, t,
        `${m.toolFailureCount} tool failures indicating high complexity`);
    },
  },

  {
    kind: "REFLECTION_ESCALATION",
    detect: (m) => {
      const hallucThreshold = THRESHOLDS.HALLUCINATION_RISK;
      const refThreshold    = THRESHOLDS.REFLECTION_SEVERITY;
      if (m.hallucinationRisk < hallucThreshold && m.reflectionSeverity < refThreshold) return null;
      const value = Math.max(m.hallucinationRisk, m.reflectionSeverity);
      const threshold = Math.min(hallucThreshold, refThreshold);
      return _signal("REFLECTION_ESCALATION", value, threshold,
        `hallucination=${m.hallucinationRisk.toFixed(2)} reflection=${m.reflectionSeverity.toFixed(2)}`);
    },
  },

  {
    kind: "DURATION_EXCEEDED",
    detect: (m) => {
      const t = THRESHOLDS.DURATION_EXCEEDED_MS;
      if (m.elapsedMs <= t) return null;
      return _signal("DURATION_EXCEEDED", m.elapsedMs, t,
        `Run elapsed ${Math.round(m.elapsedMs / 60000)}min (threshold: ${t / 60000}min)`);
    },
  },

  {
    kind: "MEMORY_PRESSURE",
    detect: (m) => {
      const t = THRESHOLDS.MEMORY_PRESSURE_MB;
      if (m.heapUsedMb <= t) return null;
      return _signal("MEMORY_PRESSURE", m.heapUsedMb, t,
        `Heap ${Math.round(m.heapUsedMb)}MB (threshold: ${t}MB)`);
    },
  },

  {
    kind: "PARALLEL_OPPORTUNITY",
    detect: (m) => {
      const t = THRESHOLDS.PARALLEL_STEP_MS;
      if (m.avgStepMs <= t) return null;
      return _signal("PARALLEL_OPPORTUNITY", m.avgStepMs, t,
        `Avg step ${Math.round(m.avgStepMs)}ms — parallel execution would speed this up`);
    },
  },

];

// ── Public analyser ───────────────────────────────────────────────────────────

export interface SignalAnalysis {
  signals:        RerouteSignal[];
  activeKinds:    RerouteSignalKind[];
  totalStrength:  number;      // sum of individual signal strengths
  dominant:       RerouteSignal | null;
}

export function analyzeSignals(metrics: RuntimeMetricsSnapshot): SignalAnalysis {
  const signals: RerouteSignal[] = [];

  for (const detector of DETECTORS) {
    const signal = detector.detect(metrics);
    if (signal) signals.push(signal);
  }

  const totalStrength = signals.reduce((s, sig) => s + sig.strength, 0);
  const dominant      = signals.length > 0
    ? signals.sort((a, b) => b.strength - a.strength)[0]
    : null;

  return {
    signals,
    activeKinds:   signals.map(s => s.kind),
    totalStrength,
    dominant,
  };
}

// ── Helper ────────────────────────────────────────────────────────────────────

function _signal(
  kind:      RerouteSignalKind,
  value:     number,
  threshold: number,
  detail:    string,
): RerouteSignal {
  // Strength: 0 at threshold, approaches 1 as value doubles the threshold
  const overage  = Math.max(0, value - threshold);
  const strength = Math.min(1, overage / Math.max(1, threshold));

  return { kind, strength, value, threshold, detectedAt: Date.now(), detail };
}
