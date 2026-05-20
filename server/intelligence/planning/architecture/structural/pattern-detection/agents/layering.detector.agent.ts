import type { LayeringReport } from "../types.js";

type LayerName = "controller" | "service" | "repository" | "other";

function inferLayer(path: string): LayerName {
  const p = path.toLowerCase();
  if (p.includes("controller")) return "controller";
  if (p.includes("service")) return "service";
  if (p.includes("repo")) return "repository";
  return "other";
}

export function detectLayering(input: {
  readonly files: readonly string[];
  readonly importGraph: Readonly<Record<string, readonly string[]>>;
}): LayeringReport {
  const layers: Record<string, string[]> = {
    controller: [],
    service: [],
    repository: [],
    other: [],
  };

  for (const file of [...input.files].sort((a, b) => a.localeCompare(b))) {
    layers[inferLayer(file)].push(file);
  }

  const violations: string[] = [];
  for (const [source, deps] of Object.entries(input.importGraph)) {
    const srcLayer = inferLayer(source);
    for (const dep of deps) {
      const dstLayer = inferLayer(dep);
      if (srcLayer === "controller" && dstLayer === "repository") {
        violations.push(`Layer violation: ${source} directly depends on ${dep}`);
      }
    }
  }

  const totalLayered = layers.controller.length + layers.service.length + layers.repository.length;
  const scoreBase = totalLayered === 0 ? 40 : 90;
  const score = Math.max(0, Math.min(100, scoreBase - violations.length * 10));

  return {
    layers: Object.freeze({
      controller: Object.freeze(layers.controller),
      service: Object.freeze(layers.service),
      repository: Object.freeze(layers.repository),
      other: Object.freeze(layers.other),
    }),
    violations: Object.freeze(violations.sort((a, b) => a.localeCompare(b))),
    score,
  };
}
