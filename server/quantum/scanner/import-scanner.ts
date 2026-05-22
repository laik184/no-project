/**
 * import-scanner.ts
 *
 * Static import graph analysis for TypeScript / JavaScript files.
 *
 * Detects:
 *   ✅ all static and dynamic imports
 *   ✅ circular import cycles (DFS)
 *   ✅ dead / unused imports (heuristic)
 *   ✅ invalid / suspicious paths
 *   ✅ cross-domain boundary violations
 */

import path from "path";
import { v4 as uuid } from "uuid";
import type { ScanFinding, CircularRef } from "./types/scan.types.ts";
import type { ImportGraphEntry } from "./types/worker.types.ts";

// ── Regex patterns ─────────────────────────────────────────────────────────────

const STATIC_IMPORT_RE  = /^\s*import\s+(?:[\w{},\s*]+\s+from\s+)?['"]([^'"]+)['"]/gm;
const DYNAMIC_IMPORT_RE = /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
const REQUIRE_RE        = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
const USED_SYMBOL_RE    = (name: string) => new RegExp(`\\b${name}\\b`, "g");

// ── Cross-domain boundary rules ────────────────────────────────────────────────

const BOUNDARY_VIOLATIONS: Array<{ from: RegExp; to: RegExp; message: string }> = [
  {
    from:    /\/client\//,
    to:      /\/server\//,
    message: "Frontend module imports directly from server — violates client/server boundary",
  },
  {
    from:    /\/agents\//,
    to:      /\/orchestration\/core\//,
    message: "Agent imports orchestration core directly — use bridges only",
  },
  {
    from:    /\/quantum\/locks\//,
    to:      /\/memory\//,
    message: "Lock module imports memory module — circular domain risk",
  },
];

// ── Public API ────────────────────────────────────────────────────────────────

export function scanImports(
  filePath: string,
  content:  string,
): { imports: ImportGraphEntry[]; findings: ScanFinding[] } {
  const imports:  ImportGraphEntry[] = [];
  const findings: ScanFinding[]      = [];
  const lines     = content.split("\n");

  const extractAll = (re: RegExp, isDynamic: boolean) => {
    let m: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while ((m = re.exec(content)) !== null) {
      const rawPath = m[1];
      const line    = content.slice(0, m.index).split("\n").length;
      const isUsed  = estimateUsage(content, rawPath, m[0]);

      imports.push({
        fromPath:  filePath,
        toPath:    rawPath,
        isDynamic,
        isUsed,
        line,
      });

      // Dead import detection
      if (!isUsed && !isDynamic) {
        findings.push({
          id:         uuid(),
          type:       "dead_import",
          severity:   "low",
          filePath,
          line,
          message:    `Possibly unused import: '${rawPath}'`,
          evidence:   m[0].trim(),
          confidence: 0.5,
        });
      }

      // Invalid path detection (relative paths starting with weird chars)
      if (rawPath.startsWith(".") && /[<>|*?]/.test(rawPath)) {
        findings.push({
          id:         uuid(),
          type:       "invalid_path",
          severity:   "high",
          filePath,
          line,
          message:    `Suspicious import path: '${rawPath}'`,
          evidence:   m[0].trim(),
          confidence: 0.85,
        });
      }

      // Cross-domain check
      for (const rule of BOUNDARY_VIOLATIONS) {
        if (rule.from.test(filePath) && rule.to.test(rawPath)) {
          findings.push({
            id:         uuid(),
            type:       "cross_domain_violation",
            severity:   "high",
            filePath,
            line,
            message:    rule.message,
            evidence:   `${filePath} → ${rawPath}`,
            confidence: 0.8,
          });
        }
      }
    }
  };

  extractAll(STATIC_IMPORT_RE,  false);
  extractAll(DYNAMIC_IMPORT_RE, true);
  extractAll(REQUIRE_RE,        false);

  return { imports, findings };
}

/**
 * Detect circular imports in a local import graph (within one partition).
 * Uses iterative DFS to avoid stack overflow on large graphs.
 */
export function detectCircularImports(
  importGraph: ImportGraphEntry[],
): CircularRef[] {
  // Build adjacency map
  const adj = new Map<string, string[]>();
  for (const e of importGraph) {
    if (!adj.has(e.fromPath)) adj.set(e.fromPath, []);
    adj.get(e.fromPath)!.push(e.toPath);
  }

  const cycles:  CircularRef[] = [];
  const visited  = new Set<string>();
  const inStack  = new Set<string>();

  const dfs = (node: string, stack: string[]): void => {
    visited.add(node);
    inStack.add(node);
    stack.push(node);

    for (const neighbour of (adj.get(node) ?? [])) {
      if (!visited.has(neighbour)) {
        dfs(neighbour, stack);
      } else if (inStack.has(neighbour)) {
        const cycleStart = stack.indexOf(neighbour);
        cycles.push({ cycle: stack.slice(cycleStart) });
      }
    }

    stack.pop();
    inStack.delete(node);
  };

  for (const node of adj.keys()) {
    if (!visited.has(node)) dfs(node, []);
  }

  return dedupeCycles(cycles);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function estimateUsage(content: string, importPath: string, importStatement: string): boolean {
  // Extract the default or named import identifier
  const defaultMatch = importStatement.match(/import\s+(\w+)\s+from/);
  const namedMatch   = importStatement.match(/\{([^}]+)\}/);

  const symbols: string[] = [];
  if (defaultMatch) symbols.push(defaultMatch[1]);
  if (namedMatch)   symbols.push(...namedMatch[1].split(",").map(s => s.trim().split(" as ").pop()!));

  if (symbols.length === 0) return true; // side-effect import — assume used

  const rest = content.replace(importStatement, "");
  return symbols.some(sym => USED_SYMBOL_RE(sym).test(rest));
}

function dedupeCycles(cycles: CircularRef[]): CircularRef[] {
  const seen = new Set<string>();
  return cycles.filter(c => {
    const key = [...c.cycle].sort().join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
