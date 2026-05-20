import { ValidationInput, ValidationIssue } from "../types";

interface SecurityRule {
  readonly pattern: RegExp;
  readonly rule: string;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly message: string;
}

const SECURITY_RULES: readonly SecurityRule[] = Object.freeze([
  {
    pattern: /innerHTML\s*=/g,
    rule: "xss-innerHTML",
    severity: "critical",
    message: "innerHTML assignment detected — XSS vector. Use textContent or sanitize input.",
  },
  {
    pattern: /document\.write\s*\(/g,
    rule: "xss-document-write",
    severity: "critical",
    message: "document.write() detected — XSS vector.",
  },
  {
    pattern: /eval\s*\(/g,
    rule: "code-injection-eval",
    severity: "critical",
    message: "eval() is a code injection vulnerability — never use.",
  },
  {
    pattern: /new\s+Function\s*\(/g,
    rule: "code-injection-new-function",
    severity: "critical",
    message: "new Function() is a code injection vector — avoid dynamic code execution.",
  },
  {
    pattern: /password|secret|apiKey|api_key|token/gi,
    rule: "hardcoded-credential-pattern",
    severity: "high",
    message: "Potential hardcoded credential or secret detected — use environment variables.",
  },
  {
    pattern: /http:\/\/(?!localhost)/gi,
    rule: "insecure-http",
    severity: "medium",
    message: "Insecure HTTP URL found — use HTTPS in production.",
  },
  {
    pattern: /Math\.random\(\)/g,
    rule: "weak-random",
    severity: "medium",
    message: "Math.random() is not cryptographically secure — use crypto.getRandomValues() for security-sensitive operations.",
  },
  {
    pattern: /require\s*\(\s*[`'"]\s*\+/g,
    rule: "dynamic-require",
    severity: "high",
    message: "Dynamic require() with string concatenation detected — path traversal risk.",
  },
  {
    pattern: /shell\.exec|child_process\.exec\s*\(/g,
    rule: "shell-injection",
    severity: "critical",
    message: "Shell execution with potential for injection — use execFile with args array.",
  },
  {
    pattern: /\.cookie\s*=\s*[^;]+((?!httpOnly|HttpOnly)[^;])*/g,
    rule: "insecure-cookie",
    severity: "high",
    message: "Cookie set without HttpOnly flag — vulnerable to XSS cookie theft.",
  },
]);

export function validateSecurity(input: ValidationInput): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const rule of SECURITY_RULES) {
    const matches = input.code.match(rule.pattern);
    if (matches) {
      issues.push(Object.freeze({
        type: "security" as const,
        severity: rule.severity,
        message: `${rule.message} (${matches.length} occurrence${matches.length > 1 ? "s" : ""})`,
        rule: rule.rule,
      }));
    }
  }

  return Object.freeze(issues);
}
