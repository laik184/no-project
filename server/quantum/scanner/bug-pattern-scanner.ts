/**
 * bug-pattern-scanner.ts
 *
 * Regex-based heuristic detection of common bugs in TypeScript/JavaScript.
 *
 * Detects:
 *   ✅ missing await on async calls
 *   ✅ unsafe Promise.all (no error handling)
 *   ✅ race conditions (parallel write patterns)
 *   ✅ infinite retry loops
 *   ✅ orphaned event listeners (subscribe with no cleanup)
 *   ✅ unhandled promise rejections
 *   ✅ memory leak patterns (global array grows without bound)
 *   ✅ sequential bottlenecks (serial awaits in loops)
 *   ✅ stale singleton state
 */

import { v4 as uuid } from "uuid";
import type { ScanFinding } from "./types/scan.types.ts";

// ── Pattern registry ──────────────────────────────────────────────────────────

interface BugPattern {
  type:       ScanFinding["type"];
  severity:   ScanFinding["severity"];
  pattern:    RegExp;
  message:    string;
  confidence: number;
}

const BUG_PATTERNS: BugPattern[] = [
  {
    type:       "missing_await",
    severity:   "high",
    pattern:    /(?<!\bawait\s+)\b(fs\.(readFile|writeFile|mkdir|rename|unlink|copyFile|appendFile))\s*\(/g,
    message:    "fs async method called without await — unhandled promise",
    confidence: 0.7,
  },
  {
    type:       "race_condition",
    severity:   "high",
    pattern:    /Promise\.all\s*\(\s*\[[\s\S]{0,200}\.write/g,
    message:    "Promise.all with write operations — concurrent write race condition risk",
    confidence: 0.65,
  },
  {
    type:       "unhandled_error",
    severity:   "high",
    pattern:    /Promise\.all\s*\([^)]+\)\s*(?!\.catch|\.then)/g,
    message:    "Promise.all without .catch — unhandled rejection on any failure",
    confidence: 0.6,
  },
  {
    type:       "infinite_retry",
    severity:   "critical",
    pattern:    /while\s*\(\s*true\s*\)\s*\{[\s\S]{0,300}await[\s\S]{0,100}\}/g,
    message:    "Unconditional while(true) with await — potential infinite retry loop",
    confidence: 0.7,
  },
  {
    type:       "orphaned_listener",
    severity:   "medium",
    pattern:    /\.on\s*\(['"][\w.]+['"]\s*,[\s\S]{0,100}\)(?![\s\S]{0,500}\.off\s*\()/g,
    message:    "EventEmitter .on() without corresponding .off() — orphaned listener risk",
    confidence: 0.5,
  },
  {
    type:       "sequential_bottleneck",
    severity:   "medium",
    pattern:    /for\s*(?:await\s*)?\s*\([\s\S]{0,80}of[\s\S]{0,80}\)\s*\{[\s\S]{0,200}await\s/g,
    message:    "Sequential await inside for-of loop — consider Promise.all for parallelism",
    confidence: 0.65,
  },
  {
    type:       "memory_leak",
    severity:   "medium",
    pattern:    /(?:const|let)\s+\w+\s*:\s*\w+\[\]\s*=\s*\[\][\s\S]{0,500}\.push\(/g,
    message:    "Unbounded array grows via .push() — potential memory leak if never cleared",
    confidence: 0.45,
  },
  {
    type:       "race_condition",
    severity:   "high",
    pattern:    /setInterval\s*\([\s\S]{0,200}await[\s\S]{0,200}\)/g,
    message:    "Async operation inside setInterval — overlapping executions if interval < duration",
    confidence: 0.7,
  },
  {
    type:       "unhandled_error",
    severity:   "medium",
    pattern:    /catch\s*\([^)]*\)\s*\{[\s\n\r\t ]*\}/g,
    message:    "Empty catch block silences errors — fail-closed violation",
    confidence: 0.75,
  },
  {
    type:       "unsafe_singleton",
    severity:   "medium",
    pattern:    /module\.exports\s*=\s*new\s+\w+\(/g,
    message:    "CommonJS singleton export — not safe for ES module interop",
    confidence: 0.6,
  },
];

// ── Public API ────────────────────────────────────────────────────────────────

export function scanBugPatterns(
  filePath: string,
  content:  string,
): ScanFinding[] {
  const findings: ScanFinding[] = [];
  const lines = content.split("\n");

  for (const bp of BUG_PATTERNS) {
    const re = new RegExp(bp.pattern.source, bp.pattern.flags.includes("g") ? bp.pattern.flags : bp.pattern.flags + "g");
    let m: RegExpExecArray | null;

    // eslint-disable-next-line no-cond-assign
    while ((m = re.exec(content)) !== null) {
      const lineNum = content.slice(0, m.index).split("\n").length;

      // Skip if inside a comment
      const lineContent = lines[lineNum - 1] ?? "";
      if (lineContent.trimStart().startsWith("//") || lineContent.trimStart().startsWith("*")) {
        continue;
      }

      findings.push({
        id:         uuid(),
        type:       bp.type,
        severity:   bp.severity,
        filePath,
        line:       lineNum,
        message:    bp.message,
        evidence:   m[0].slice(0, 120).replace(/\s+/g, " ").trim(),
        confidence: bp.confidence,
      });

      // Limit findings per pattern per file to avoid noise
      if (findings.filter(f => f.type === bp.type).length >= 5) break;
    }
  }

  return findings;
}

/**
 * Scan for runtime-specific risks in agent/orchestration code.
 */
export function scanRuntimeRisks(
  filePath: string,
  content:  string,
): ScanFinding[] {
  const findings: ScanFinding[] = [];

  // Stale state: direct mutation of module-level variables in async context
  if (/^(?:export\s+)?(?:const|let)\s+\w+\s*=\s*(?:\{|\[)/m.test(content) &&
      /async\s+function|=>\s*\{/.test(content)) {
    const mutableModuleVars = content.match(/^(?:export\s+)?let\s+(\w+)/gm) ?? [];
    for (const v of mutableModuleVars.slice(0, 3)) {
      findings.push({
        id:         uuid(),
        type:       "runtime_risk",
        severity:   "medium",
        filePath,
        message:    `Module-level mutable 'let': ${v.trim()} — unsafe in concurrent async context`,
        evidence:   v.trim(),
        confidence: 0.5,
      });
    }
  }

  // Preview desync: writing to runtime state without lock
  if (/previewUrl|preview_url/.test(content) && !/fileLock|acquireLock/.test(content)) {
    if (/writeFile|writeFileSync/.test(content)) {
      findings.push({
        id:         uuid(),
        type:       "runtime_risk",
        severity:   "high",
        filePath,
        message:    "Preview state written without lock — preview desync risk",
        confidence: 0.6,
      });
    }
  }

  return findings;
}
