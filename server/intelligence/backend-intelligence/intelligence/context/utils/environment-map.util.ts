import type { Deployment, FrameworkName, NormalizedSignals, Runtime, Scaling } from "../types.js";

// ── Deployment signal patterns ─────────────────────────────────────────────────

const CONTAINER_PATTERN  = /docker|k8s|kubernetes|helm/;
const SERVERLESS_PATTERN = /lambda|serverless|cloudfunction/;

// ── Scaling thresholds ─────────────────────────────────────────────────────────

const HORIZONTAL_SERVICE_MIN  = 3;
const HORIZONTAL_ENDPOINT_MIN = 50;

// ── Classifiers ────────────────────────────────────────────────────────────────

export function pickRuntime(framework: FrameworkName, signals: NormalizedSignals): Runtime {
  if (framework === "Django") return "Python";
  if (framework === "Spring") return "JVM";
  if (signals.dependencies.includes("python")) return "Python";
  return "Node";
}

export function pickDeployment(signals: NormalizedSignals): Deployment {
  const tokens = [...signals.configKeys, ...signals.filePaths].join(" ");

  if (CONTAINER_PATTERN.test(tokens))  return "container";
  if (SERVERLESS_PATTERN.test(tokens)) return "serverless";
  return "server";
}

export function pickScaling(deployment: Deployment, signals: NormalizedSignals): Scaling {
  if (
    deployment === "container"                       ||
    signals.serviceCount  >= HORIZONTAL_SERVICE_MIN  ||
    signals.endpointCount >= HORIZONTAL_ENDPOINT_MIN
  ) {
    return "horizontal";
  }

  return "vertical";
}
