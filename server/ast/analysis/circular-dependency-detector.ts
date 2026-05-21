/**
 * server/ast/analysis/circular-dependency-detector.ts
 * Detects circular import chains given a set of parsed files.
 * Single responsibility: produce circular dependency findings. Read-only.
 */

import { parseFiles }       from "../parsers/ast-parser.ts";
import { buildImportGraph } from "../graph/import-graph-builder.ts";
import type { ASTParseResult } from "../types.ts";

export interface CircularDependencyFinding {
  chain:    string[];
  severity: "low" | "medium" | "high";
  hint:     string;
}

function chainSeverity(chain: string[]): CircularDependencyFinding["severity"] {
  if (chain.length <= 2) return "high";   // direct A→B→A cycle
  if (chain.length <= 4) return "medium";
  return "low";
}

export async function detectCircularDependencies(
  filePaths: string[],
): Promise<CircularDependencyFinding[]> {
  const parsed = await parseFiles(filePaths);
  return detectFromParsed(parsed);
}

export function detectFromParsed(
  parsed: ASTParseResult[],
): CircularDependencyFinding[] {
  const graph    = buildImportGraph(parsed);
  const findings: CircularDependencyFinding[] = [];

  for (const chain of graph.circular) {
    findings.push({
      chain,
      severity: chainSeverity(chain),
      hint: `Break the cycle: extract shared types to a separate file imported by both ${chain[0]} and ${chain[chain.length - 1]}.`,
    });
  }

  return findings;
}
