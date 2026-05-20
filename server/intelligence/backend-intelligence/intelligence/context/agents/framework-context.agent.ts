import type { FrameworkContext, NormalizedSignals } from "../types.js";
import { pickArchitectureStyle, pickFramework } from "../utils/framework-map.util.js";

function detectTypeSafety(signals: NormalizedSignals): boolean {
  return (
    signals.dependencies.includes("typescript")  ||
    signals.dependencies.includes("@types/node") ||
    signals.filePaths.some((path) => path.endsWith(".ts"))
  );
}

export function inferFrameworkContext(signals: NormalizedSignals): FrameworkContext {
  const framework = pickFramework(signals);

  return Object.freeze({
    framework,
    style:      pickArchitectureStyle(framework, signals),
    typeSafety: detectTypeSafety(signals),
  });
}
