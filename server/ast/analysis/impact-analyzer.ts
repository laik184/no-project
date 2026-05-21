/**
 * server/ast/analysis/impact-analyzer.ts
 * Determines blast radius of a file change using the dependency graph.
 * Single responsibility: change impact scoring. No filesystem mutations.
 */

import type { DependencyMap } from "./dependency-analyzer.ts";

export interface ImpactReport {
  targetFile:      string;
  directDependents: string[];   // files that directly import target
  transitiveDeps:  string[];   // all files transitively affected
  riskScore:       number;      // 0–100
  riskLevel:       "low" | "medium" | "high" | "critical";
  summary:         string;
}

function collectTransitive(
  file: string,
  incoming: Map<string, Set<string>>,
  visited = new Set<string>(),
): string[] {
  if (visited.has(file)) return [];
  visited.add(file);

  const direct = Array.from(incoming.get(file) ?? []);
  const transitive = direct.flatMap(f => collectTransitive(f, incoming, visited));
  return Array.from(new Set([...direct, ...transitive]));
}

function calcRiskScore(directCount: number, transitiveCount: number): number {
  const base = Math.min(directCount * 10, 40);
  const trans = Math.min(transitiveCount * 3, 60);
  return Math.min(base + trans, 100);
}

function toRiskLevel(score: number): ImpactReport["riskLevel"] {
  if (score >= 80) return "critical";
  if (score >= 50) return "high";
  if (score >= 20) return "medium";
  return "low";
}

export function analyzeImpact(
  targetFile: string,
  map: DependencyMap,
): ImpactReport {
  const directDependents = Array.from(map.incoming.get(targetFile) ?? []);
  const transitiveDeps   = collectTransitive(targetFile, map.incoming);
  const riskScore        = calcRiskScore(directDependents.length, transitiveDeps.length);
  const riskLevel        = toRiskLevel(riskScore);

  const summary =
    riskLevel === "critical"
      ? `Critical impact — ${transitiveDeps.length} files transitively affected.`
      : riskLevel === "high"
      ? `High impact — ${directDependents.length} direct dependents, review carefully.`
      : riskLevel === "medium"
      ? `Medium impact — limited blast radius, proceed with care.`
      : `Low impact — isolated change, safe to proceed.`;

  return { targetFile, directDependents, transitiveDeps, riskScore, riskLevel, summary };
}

export function analyzeMultiFileImpact(
  files: string[],
  map: DependencyMap,
): ImpactReport[] {
  return files.map(f => analyzeImpact(f, map));
}
