/**
 * server/agents/browser/reasoning/ui-analyzer.ts
 *
 * Analyzes browser state descriptions and screenshot text to detect:
 *   - layout issues
 *   - broken UI states (missing content, error screens, spinners)
 *   - accessibility problems
 *   - visual regressions
 *
 * Takes textual descriptions / DOM summaries as input.
 * No Playwright imports. No direct browser access.
 * No tool imports. Pure analysis.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type UiIssueKind =
  | 'blank-page'
  | 'error-screen'
  | 'spinner-frozen'
  | 'missing-content'
  | 'broken-layout'
  | 'navigation-failed'
  | 'auth-redirect'
  | 'accessibility'
  | 'console-error';

export type UiSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface UiIssue {
  kind:        UiIssueKind;
  severity:    UiSeverity;
  description: string;
  hint:        string;
}

export interface UiAnalysis {
  ok:       boolean;
  issues:   UiIssue[];
  score:    number;     // 0 (broken) – 100 (healthy)
  summary:  string;
}

// ── Detection patterns ─────────────────────────────────────────────────────────

const PATTERNS: Array<{
  re: RegExp; kind: UiIssueKind; severity: UiSeverity; hint: string;
}> = [
  {
    re: /\bblank\b|\bwhite\s+screen\b|\bnothing\s+rendered\b|\bno\s+content\b/i,
    kind: 'blank-page', severity: 'critical',
    hint: 'Check console errors, verify component mounts, inspect React root',
  },
  {
    re: /\b(500|503|502)\s*(error|internal)|\bserver\s+error\b|\binternal\s+error\b/i,
    kind: 'error-screen', severity: 'critical',
    hint: 'Server returned 5xx — inspect backend logs and request payload',
  },
  {
    re: /\b404\b|\bnot\s+found\b|\bpage\s+not\s+found\b/i,
    kind: 'error-screen', severity: 'high',
    hint: 'Route or resource not found — verify URL and routing config',
  },
  {
    re: /\bspinner\b|\bloading\b|\bskeleton\b/i,
    kind: 'spinner-frozen', severity: 'medium',
    hint: 'Page stuck in loading state — check async data fetching and network',
  },
  {
    re: /\bcannot\s+read\s+propert|\buntitled\b|\bundle\s+error|\bchunk.*failed/i,
    kind: 'broken-layout', severity: 'high',
    hint: 'JS bundle error — check Vite build output and import paths',
  },
  {
    re: /\bnavigation\s+failed\b|\berr_connection\b|\bnet::/i,
    kind: 'navigation-failed', severity: 'critical',
    hint: 'Browser navigation failed — verify dev server is running on expected port',
  },
  {
    re: /\bredirect.*login\b|\bsign.?in\b|\bunauthorized\b|\b401\b/i,
    kind: 'auth-redirect', severity: 'medium',
    hint: 'Auth redirect encountered — ensure session/token is configured',
  },
  {
    re: /\baria.*missing\b|\bno\s+alt\b|\bmissing\s+label\b/i,
    kind: 'accessibility', severity: 'low',
    hint: 'Accessibility attribute missing — add aria-label or alt text',
  },
  {
    re: /\bconsole\s+error\b|\bunhandled\s+rejection\b|\buncaught\b/i,
    kind: 'console-error', severity: 'high',
    hint: 'Uncaught console error — inspect browser console and fix root cause',
  },
  {
    re: /\bheading\s+missing\b|\bno\s+\w+\s+visible\b|\bcontent\s+empty\b/i,
    kind: 'missing-content', severity: 'medium',
    hint: 'Expected content not visible — verify data loading and conditional rendering',
  },
];

const SEVERITY_DEDUCTIONS: Record<UiSeverity, number> = {
  critical: 40, high: 20, medium: 10, low: 5,
};

// ── Main export ────────────────────────────────────────────────────────────────

export function analyzeUi(
  description: string,
  context?: { url?: string; expectedElements?: string[] },
): UiAnalysis {
  const issues: UiIssue[] = [];

  for (const pattern of PATTERNS) {
    if (pattern.re.test(description)) {
      issues.push({
        kind:        pattern.kind,
        severity:    pattern.severity,
        description: `Detected: ${pattern.kind}`,
        hint:        pattern.hint,
      });
    }
  }

  // Check expected elements
  if (context?.expectedElements) {
    for (const el of context.expectedElements) {
      if (!description.toLowerCase().includes(el.toLowerCase())) {
        issues.push({
          kind:        'missing-content',
          severity:    'medium',
          description: `Expected element "${el}" not found in page description`,
          hint:        `Verify that "${el}" is rendered and not hidden by conditional logic`,
        });
      }
    }
  }

  const deduction = issues.reduce((s, i) => s + SEVERITY_DEDUCTIONS[i.severity], 0);
  const score     = Math.max(0, 100 - deduction);
  const criticals = issues.filter((i) => i.severity === 'critical');
  const ok        = criticals.length === 0;

  const summary = ok
    ? `UI appears healthy (score: ${score}/100)`
    : `UI has ${criticals.length} critical issue(s): ${criticals.map((i) => i.kind).join(', ')}`;

  return { ok, issues, score, summary };
}

/** Quick boolean check — does the UI appear to have critical problems? */
export function hasUiCriticalIssues(description: string): boolean {
  return !analyzeUi(description).ok;
}
