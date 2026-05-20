import { groupFilesByModule } from "./folder-structure.util.js";

function safeRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

export function detectCircularDependencies(
  importGraph: Readonly<Record<string, readonly string[]>>,
): readonly string[] {
  const edges = Object.entries(importGraph);
  const circular = new Set<string>();

  for (const [a, deps] of edges) {
    for (const b of deps) {
      const reverse = importGraph[b] ?? [];
      if (reverse.includes(a)) {
        circular.add([a, b].sort((x, y) => x.localeCompare(y)).join(" <-> "));
      }
    }
  }

  return Object.freeze(Array.from(circular).sort((a, b) => a.localeCompare(b)));
}

export function dependencyDensity(importGraph: Readonly<Record<string, readonly string[]>>): number {
  const nodes = Object.keys(importGraph).length;
  if (nodes <= 1) return 0;
  const edgeCount = Object.values(importGraph).reduce((sum, deps) => sum + deps.length, 0);
  const maxEdges = nodes * (nodes - 1);
  return safeRatio(edgeCount, maxEdges);
}

export function moduleIndependenceRatio(
  files: readonly string[],
  importGraph: Readonly<Record<string, readonly string[]>>,
): number {
  const grouped = groupFilesByModule(files);
  const modules = Object.keys(grouped);
  if (modules.length === 0) return 0;

  let independent = 0;
  for (const moduleName of modules) {
    const moduleFiles = new Set(grouped[moduleName]);
    let hasExternalDependency = false;

    for (const file of moduleFiles) {
      const dependencies = importGraph[file] ?? [];
      for (const dep of dependencies) {
        if (!moduleFiles.has(dep) && dep.startsWith(".")) {
          hasExternalDependency = true;
          break;
        }
      }
      if (hasExternalDependency) break;
    }

    if (!hasExternalDependency) independent += 1;
  }

  return safeRatio(independent, modules.length);
}

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}
