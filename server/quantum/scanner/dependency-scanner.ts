/**
 * dependency-scanner.ts
 *
 * Analyses module dependencies for architecture violations, ownership
 * conflicts, and orchestration boundary leaks.
 *
 * Detects:
 *   ✅ cross-domain boundary violations
 *   ✅ architecture leaks (agent → orchestration core)
 *   ✅ runtime ownership conflicts
 *   ✅ invalid orchestration dependencies
 *   ✅ singleton re-instantiation risks
 */

import { v4 as uuid } from "uuid";
import type { ScanFinding, FileCategory } from "./types/scan.types.ts";
import type { ImportGraphEntry } from "./types/worker.types.ts";

// ── Architecture boundary rules ───────────────────────────────────────────────

interface BoundaryRule {
  description: string;
  severity:    "critical" | "high" | "medium";
  ownerDomain: RegExp;
  forbiddenDep: RegExp;
  message:     string;
}

const BOUNDARY_RULES: BoundaryRule[] = [
  {
    description:  "Frontend must not import server internals",
    severity:     "critical",
    ownerDomain:  /\/client\//,
    forbiddenDep: /\/server\/(?!api)/,
    message:      "Frontend imports server internals — exposes server code to browser bundle",
  },
  {
    description:  "Agents must not import orchestration engine directly",
    severity:     "high",
    ownerDomain:  /\/agents\//,
    forbiddenDep: /\/orchestration\/core\//,
    message:      "Agent bypasses bridge layer — imports orchestration engine directly",
  },
  {
    description:  "Quantum locks must not import application-layer code",
    severity:     "high",
    ownerDomain:  /\/quantum\/locks\//,
    forbiddenDep: /\/agents\/|\/orchestration\//,
    message:      "Lock subsystem imports application code — creates circular dependency risk",
  },
  {
    description:  "Infrastructure must not import agent business logic",
    severity:     "medium",
    ownerDomain:  /\/infrastructure\//,
    forbiddenDep: /\/agents\/(?!types)/,
    message:      "Infrastructure module imports agent business logic — violates layer boundary",
  },
  {
    description:  "Memory system must not import orchestration",
    severity:     "medium",
    ownerDomain:  /\/memory\//,
    forbiddenDep: /\/orchestration\/(?!types)/,
    message:      "Memory subsystem imports orchestration — violates data layer isolation",
  },
];

// ── Singleton ownership patterns ──────────────────────────────────────────────

const SINGLETON_RE    = /export\s+const\s+\w+\s*=\s*new\s+\w+\(/g;
const MULTI_EXPORT_RE = /export\s+(?:const|class|function)\s+(\w+)/g;

// ── Public API ────────────────────────────────────────────────────────────────

export function scanDependencies(
  filePath:    string,
  content:     string,
  category:    FileCategory,
  imports:     ImportGraphEntry[],
): ScanFinding[] {
  const findings: ScanFinding[] = [];

  // ── Boundary rule violations ──────────────────────────────────────────────
  for (const entry of imports) {
    for (const rule of BOUNDARY_RULES) {
      if (rule.ownerDomain.test(entry.fromPath) && rule.forbiddenDep.test(entry.toPath)) {
        findings.push({
          id:         uuid(),
          type:       "architecture_leak",
          severity:   rule.severity,
          filePath,
          line:       entry.line,
          message:    rule.message,
          evidence:   `${entry.fromPath} → ${entry.toPath}`,
          confidence: 0.75,
        });
      }
    }
  }

  // ── Multiple singleton exports ────────────────────────────────────────────
  const singletons = content.match(SINGLETON_RE) ?? [];
  if (singletons.length > 1) {
    findings.push({
      id:         uuid(),
      type:       "unsafe_singleton",
      severity:   "medium",
      filePath,
      message:    `File exports ${singletons.length} singleton instances — ownership ambiguity risk`,
      evidence:   singletons.slice(0, 2).join(" | "),
      confidence: 0.6,
    });
  }

  // ── Runtime ownership: agent files should not own infrastructure ──────────
  if (category === "agents") {
    const infraImports = imports.filter(i => /\/infrastructure\//.test(i.toPath));
    if (infraImports.length > 3) {
      findings.push({
        id:         uuid(),
        type:       "orchestration_risk",
        severity:   "medium",
        filePath,
        message:    `Agent imports ${infraImports.length} infrastructure modules — exceeds expected boundary`,
        evidence:   infraImports.slice(0, 2).map(i => i.toPath).join(", "),
        confidence: 0.55,
      });
    }
  }

  // ── Dead exports: exported but never referenced within this file's imports ─
  // (heuristic: file has many exports but zero inbound imports suggests dead code)
  const exports = [...content.matchAll(MULTI_EXPORT_RE)].map(m => m[1]);
  if (exports.length > 10 && imports.length === 0) {
    findings.push({
      id:         uuid(),
      type:       "architecture_leak",
      severity:   "low",
      filePath,
      message:    `File exports ${exports.length} symbols but has no imports — possible dead module`,
      confidence: 0.45,
    });
  }

  return findings;
}
