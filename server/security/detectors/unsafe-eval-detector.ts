/**
 * server/security/detectors/unsafe-eval-detector.ts
 * Detects unsafe use of eval(), Function(), and dynamic code execution.
 * Single responsibility: eval detection. Read-only, no side effects.
 */

import type { SecurityFinding } from "./types.ts";

const EVAL_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\beval\s*\(/g,                       label: "eval()" },
  { re: /new\s+Function\s*\(/g,               label: "new Function()" },
  { re: /setTimeout\s*\(\s*["'`][^"'`]+/g,   label: "setTimeout(string)" },
  { re: /setInterval\s*\(\s*["'`][^"'`]+/g,  label: "setInterval(string)" },
  { re: /vm\.runInNewContext\s*\(/g,           label: "vm.runInNewContext()" },
  { re: /vm\.runInThisContext\s*\(/g,         label: "vm.runInThisContext()" },
  { re: /Function\.prototype\.constructor\s*\(/g, label: "Function constructor" },
];

export function detectUnsafeEval(code: string, filePath: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  for (const { re, label } of EVAL_PATTERNS) {
    if (re.test(code)) {
      findings.push({
        threat:      "unsafe_eval",
        severity:    "high",
        evidence:    `Unsafe dynamic code execution: ${label}`,
        location:    filePath,
        remediation: "Replace dynamic code execution with static function calls or safe alternatives.",
        blocked:     true,
      });
    }
  }

  return findings;
}
