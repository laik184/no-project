import type { EnvironmentContext, FrameworkContext, NormalizedSignals } from "../types.js";
import { pickDeployment, pickRuntime, pickScaling } from "../utils/environment-map.util.js";

export function inferEnvironmentContext(
  signals:          NormalizedSignals,
  frameworkContext: FrameworkContext,
): EnvironmentContext {
  const runtime    = pickRuntime(frameworkContext.framework, signals);
  const deployment = pickDeployment(signals);

  return Object.freeze({
    runtime,
    deployment,
    scaling: pickScaling(deployment, signals),
  });
}
