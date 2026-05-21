/**
 * server/completion/checks/security-validation-check.ts
 * Scans project files for critical security issues before completion.
 * Single responsibility: security gate at completion boundary. No execution.
 */

import fs   from "fs/promises";
import path from "path";
import type { CompletionCheckResult, CompletionGateInput } from "../types.ts";

interface SecurityIssue {
  file:     string;
  line:     number;
  severity: "critical" | "high" | "medium";
  message:  string;
}

const CRITICAL_PATTERNS: Array<{ re: RegExp; msg: string }> = [
  { re: /(?:OPENAI|ANTHROPIC|OPENROUTER)_API_KEY\s*=\s*['"]sk-[^'"]+['"]/i, msg: "Hardcoded AI API key" },
  { re: /process\.env\.[A-Z_]+\s*\|\|\s*['"][A-Za-z0-9+/=]{20,}['"]/,       msg: "Fallback secret in code" },
  { re: /eval\s*\(\s*(?:req|request|body|params|query)/,                      msg: "Eval of user input" },
  { re: /child_process.*exec\s*\(\s*(?:req|request|body|params|query)/,       msg: "Shell injection via user input" },
];

async function scanFile(filePath: string): Promise<SecurityIssue[]> {
  const issues: SecurityIssue[] = [];
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const lines   = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      for (const { re, msg } of CRITICAL_PATTERNS) {
        if (re.test(lines[i])) {
          issues.push({ file: filePath, line: i + 1, severity: "critical", message: msg });
        }
      }
    }
  } catch {
    // Unreadable file — skip
  }
  return issues;
}

async function collectFiles(root: string, exts: string[]): Promise<string[]> {
  const results: string[] = [];
  async function walk(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.name === "node_modules" || e.name === ".git") continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) await walk(full);
        else if (exts.some(x => e.name.endsWith(x))) results.push(full);
      }
    } catch { /* skip unreadable dirs */ }
  }
  await walk(root);
  return results;
}

export async function runSecurityValidationCheck(
  input: CompletionGateInput,
): Promise<CompletionCheckResult> {
  const files  = await collectFiles(input.projectRoot, [".ts", ".tsx", ".js", ".jsx"]);
  const allIssues: SecurityIssue[] = [];

  for (const f of files) {
    const found = await scanFile(f);
    allIssues.push(...found);
  }

  const critical = allIssues.filter(i => i.severity === "critical");
  const passed   = critical.length === 0;

  return {
    check:   "SecurityValidation",
    status:  passed ? "passed" : "failed",
    passed,
    details: passed
      ? `Security check passed — ${files.length} files scanned, no critical issues.`
      : `${critical.length} critical security issue(s): ${critical.map(i => i.message).join("; ")}`,
    evidence: { filesScanned: files.length, criticalCount: critical.length, issues: critical.slice(0, 5) },
  };
}
