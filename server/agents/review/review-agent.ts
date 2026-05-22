/**
 * server/agents/review/review-agent.ts
 *
 * ReviewAgent — code quality, architecture validation, and policy enforcement.
 * Analyses files against defined policies and architectural rules.
 * Emits structured findings with severity levels.
 *
 * Single responsibility: static review and policy validation — no code changes.
 */

import { bus }    from "../../infrastructure/events/bus.ts";
import { record } from "../../telemetry/index.ts";
import type {
  ReviewRequest,
  ReviewResult,
  ReviewFinding,
  ReviewCategory,
} from "./types.ts";
import { POLICY_RULES } from "./types.ts";

const AGENT_NAME = "review-agent";

// ── Telemetry ─────────────────────────────────────────────────────────────────

function emitEvent(
  eventType: string,
  runId: string,
  projectId: number,
  payload: Record<string, unknown>,
): void {
  bus.emit("agent.event", {
    runId,
    projectId,
    phase:     "review",
    agentName: AGENT_NAME,
    eventType,
    payload,
    ts:        Date.now(),
  });
}

// ── Policy checkers ───────────────────────────────────────────────────────────

const POLICY_PATTERNS: Array<{
  pattern: RegExp;
  message: string;
  category: ReviewCategory;
  severity: ReviewFinding["severity"];
}> = [
  {
    pattern:  /VITE_[A-Z_]*(KEY|SECRET|TOKEN|PASSWORD)/,
    message:  "Secret exposed via VITE_ prefix — will leak to browser bundle",
    category: "security",
    severity: "critical",
  },
  {
    pattern:  /eval\s*\(/,
    message:  "eval() usage detected — security and correctness risk",
    category: "security",
    severity: "error",
  },
  {
    pattern:  /new\s+Function\s*\(/,
    message:  "new Function() usage detected — potential code injection",
    category: "security",
    severity: "error",
  },
  {
    pattern:  /process\.env\.[A-Z_]+(KEY|SECRET|TOKEN)/,
    message:  "Raw env secret reference — ensure this is server-side only",
    category: "security",
    severity: "warn",
  },
  {
    pattern:  /console\.(log|warn|error)\s*\(.*(?:password|secret|token|key)/i,
    message:  "Potential secret logged to console",
    category: "security",
    severity: "error",
  },
  {
    pattern:  /\.catch\s*\(\s*\)/,
    message:  "Empty catch block swallows errors silently",
    category: "code_quality",
    severity: "warn",
  },
  {
    pattern:  /TODO|FIXME|HACK|XXX/,
    message:  "Unresolved TODO/FIXME marker in production code",
    category: "code_quality",
    severity: "info",
  },
];

function analyzeFile(
  path: string,
  content: string,
): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  const lines = content.split("\n");

  for (const { pattern, message, category, severity } of POLICY_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        findings.push({ category, severity, file: path, line: i + 1, message });
      }
    }
  }

  // Architecture: detect frontend files making direct DB calls
  const isFrontend = path.startsWith("client/") || path.includes("/pages/") || path.includes("/components/");
  if (isFrontend && /drizzle|pg\.Pool|Pool\(|knex\(/.test(content)) {
    findings.push({
      category: "architecture",
      severity:  "critical",
      file:      path,
      message:   "Direct database access detected in frontend code — must go through API layer",
    });
  }

  // Detect suspiciously large files
  if (lines.length > 500) {
    findings.push({
      category: "architecture",
      severity:  "warn",
      file:      path,
      message:   `File has ${lines.length} lines — consider splitting into smaller modules`,
    });
  }

  return findings;
}

// ── Score calculator ──────────────────────────────────────────────────────────

function calculateScore(findings: ReviewFinding[]): number {
  const penalties: Record<ReviewFinding["severity"], number> = {
    critical: 30,
    error:    15,
    warn:     5,
    info:     1,
  };
  const deduction = findings.reduce((acc, f) => acc + (penalties[f.severity] ?? 0), 0);
  return Math.max(0, 100 - deduction);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function runReview(req: ReviewRequest): Promise<ReviewResult> {
  const { runId, projectId, files } = req;
  const t0 = Date.now();

  emitEvent("agent.started", runId, projectId, { fileCount: files.length });
  record("agent.started", runId, projectId, {
    agentName: AGENT_NAME, fileCount: files.length,
  }, [AGENT_NAME]);

  try {
    const allFindings: ReviewFinding[] = [];

    for (const { path, content } of files) {
      const fileFindings = analyzeFile(path, content);
      allFindings.push(...fileFindings);
    }

    // Policy summary
    const policyFindings: ReviewFinding[] = POLICY_RULES.map(rule => ({
      category: "policy" as ReviewCategory,
      severity:  "info" as ReviewFinding["severity"],
      message:   `Policy enforced: ${rule}`,
    }));

    const blockers  = allFindings.filter(f => f.severity === "error" || f.severity === "critical");
    const warnings  = allFindings.filter(f => f.severity === "warn");
    const score     = calculateScore(allFindings);
    const passed    = blockers.length === 0;

    const summary = passed
      ? `Review passed — score ${score}/100, ${warnings.length} warnings, ${allFindings.length} total findings`
      : `Review FAILED — ${blockers.length} blocker(s), score ${score}/100`;

    const result: ReviewResult = {
      projectId,
      runId,
      passed,
      score,
      findings:  [...allFindings, ...policyFindings],
      summary,
      blockers,
      warnings,
      durationMs: Date.now() - t0,
      ts:         Date.now(),
    };

    const eventType = passed ? "agent.completed" : "agent.blocked";
    emitEvent(eventType, runId, projectId, { score, blockers: blockers.length, warnings: warnings.length });
    record(passed ? "agent.completed" : "verifier.failed", runId, projectId, {
      agentName: AGENT_NAME, score, blockers: blockers.length,
    }, [AGENT_NAME]);

    return result;

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emitEvent("agent.failed", runId, projectId, { error: msg });
    record("agent.started", runId, projectId, { agentName: AGENT_NAME, error: msg }, [AGENT_NAME]);

    return {
      projectId,
      runId,
      passed:    false,
      score:     0,
      findings:  [],
      summary:   `ReviewAgent failed: ${msg}`,
      blockers:  [],
      warnings:  [],
      durationMs: Date.now() - t0,
      ts:         Date.now(),
    };
  }
}
