/**
 * server/engine/reflection/reflection-classifier.ts
 *
 * Extended 17-class failure classifier for the Reflection Engine.
 *
 * Single responsibility: classify → ReflectionClassification. No I/O, no state.
 *
 * Operates on raw log lines + verify errors — not VerificationReport objects.
 * This makes it reusable across crash events, verify failures, and preview failures
 * without coupling to the verification pipeline's types.
 *
 * Priority order (highest severity first):
 *   runtime_crash > build_failure > syntax_error > typescript_error >
 *   dependency_missing > port_conflict > port_timeout > memory_leak >
 *   infinite_render_loop > hydration_failure > preview_proxy_failure >
 *   preview_blank > process_exit > verification_failure > timeout >
 *   tool_loop > unknown
 */

import type { ReflectionClassification, ReflectionFailureClass, ReflectionSeverity } from "./reflection-types.ts";

// ── Classification rules ──────────────────────────────────────────────────────

interface ClassRule {
  class:      ReflectionFailureClass;
  severity:   ReflectionSeverity;
  retryable:  boolean;
  recoverable: boolean;
  patterns:   RegExp[];
}

const RULES: ClassRule[] = [
  {
    class: "runtime_crash", severity: "critical", retryable: false, recoverable: true,
    patterns: [/crash|segfault|killed|core dump|signal 9|sigkill/i],
  },
  {
    class: "memory_leak", severity: "critical", retryable: false, recoverable: true,
    patterns: [/heap out of memory|out of memory|oom|allocation failed/i],
  },
  {
    class: "port_conflict", severity: "high", retryable: true, recoverable: true,
    patterns: [/address already in use|eaddrinuse|port.*in use/i],
  },
  {
    class: "syntax_error", severity: "high", retryable: false, recoverable: false,
    patterns: [/syntaxerror|unexpected token|unexpected end of input/i],
  },
  {
    class: "typescript_error", severity: "high", retryable: false, recoverable: false,
    patterns: [/tsc|type error|ts\d{4}|\.ts\(\d+,\d+\)/i, /error ts/i],
  },
  {
    class: "dependency_missing", severity: "high", retryable: true, recoverable: true,
    patterns: [/cannot find module|module not found|no such file.*node_modules|missing peer/i],
  },
  {
    class: "build_failure", severity: "high", retryable: false, recoverable: false,
    patterns: [/build failed|webpack error|vite error|rollup error|esbuild error/i],
  },
  {
    class: "infinite_render_loop", severity: "high", retryable: false, recoverable: false,
    patterns: [/maximum update depth|too many re-renders|infinite loop|stack overflow/i],
  },
  {
    class: "hydration_failure", severity: "medium", retryable: true, recoverable: false,
    patterns: [/hydration|mismatch|did not match|server.*render.*client/i],
  },
  {
    class: "port_timeout", severity: "medium", retryable: true, recoverable: true,
    patterns: [/port.*timeout|waitforport.*timeout|timed out waiting for port/i],
  },
  {
    class: "preview_proxy_failure", severity: "medium", retryable: true, recoverable: true,
    patterns: [/proxy error|econnrefused|econnreset|failed to proxy/i],
  },
  {
    class: "process_exit", severity: "medium", retryable: true, recoverable: true,
    patterns: [/process exited|exit code [^0]|process.exit\(\d+\)/i],
  },
  {
    class: "timeout", severity: "medium", retryable: true, recoverable: false,
    patterns: [/timeout|etimedout|timed out/i],
  },
  {
    class: "preview_blank", severity: "low", retryable: true, recoverable: false,
    patterns: [/preview.*blank|blank.*preview|iframe.*empty|no dom/i],
  },
  {
    class: "verification_failure", severity: "low", retryable: true, recoverable: false,
    patterns: [/verification failed|verify failed|health check/i],
  },
  {
    class: "tool_loop", severity: "medium", retryable: false, recoverable: false,
    patterns: [/tool loop|same tool|repeated.*tool/i],
  },
];

// ── Public API ────────────────────────────────────────────────────────────────

export function classifyFailure(
  logLines:     string[],
  verifyErrors: string[],
  previewDown:  boolean,
): ReflectionClassification {
  const combined = [...logLines, ...verifyErrors].join("\n");
  const evidence: string[] = [];
  const secondaryClasses: ReflectionFailureClass[] = [];
  let primaryRule: ClassRule | undefined;

  for (const rule of RULES) {
    const matched = rule.patterns.some((pat) => pat.test(combined));
    if (!matched) continue;

    // Collect matching evidence lines
    const matchingLines = [...logLines, ...verifyErrors].filter((l) =>
      rule.patterns.some((p) => p.test(l))
    );
    evidence.push(...matchingLines.slice(0, 3).map((l) => l.slice(0, 200)));

    if (!primaryRule) {
      primaryRule = rule;
    } else {
      secondaryClasses.push(rule.class);
    }
  }

  // Preview blank fallback if previewDown with no other match
  if (!primaryRule && previewDown) {
    primaryRule = RULES.find((r) => r.class === "preview_blank");
    evidence.push("Preview reported as unreachable or blank");
  }

  // Unknown fallback
  if (!primaryRule) {
    return {
      primary:     "unknown",
      secondary:   [],
      severity:    "low",
      confidence:  0.3,
      evidence:    verifyErrors.slice(0, 3),
      retryable:   false,
      recoverable: false,
    };
  }

  // Confidence: higher with more evidence lines
  const confidence = Math.min(0.95, 0.55 + evidence.length * 0.1);

  return {
    primary:     primaryRule.class,
    secondary:   secondaryClasses.slice(0, 3),
    severity:    primaryRule.severity,
    confidence,
    evidence:    [...new Set(evidence)].slice(0, 5),
    retryable:   primaryRule.retryable,
    recoverable: primaryRule.recoverable,
  };
}
