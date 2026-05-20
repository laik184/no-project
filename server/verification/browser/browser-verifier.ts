/**
 * browser-verifier.ts
 *
 * Main orchestrator for browser-level verification.
 * Uses HTTP + HTML analysis as default path.
 * Upgrades to Playwright capture when available + feature-flagged.
 */

import { validateDom, scoreDom }                from "./dom-validator.ts";
import { analyzeVisuals }                       from "./screenshot-analyzer.ts";
import { extractConsoleErrorsFromHtml }         from "./console-monitor.ts";
import { deriveDefaultInteractions, runInteractions, scoreInteractions } from "./interaction-runner.ts";
import { isPlaywrightAvailable, capturePageSession } from "./playwright-manager.ts";
import type {
  BrowserVerificationResult, VerificationTarget,
  NetworkReport, AccessibilityReport,
} from "./verification-types.ts";

const DEFAULT_TIMEOUT_MS = 10_000;

// ── HTTP fetch + HTML retrieval ───────────────────────────────────────────────

async function fetchPage(url: string): Promise<{ html: string; network: NetworkReport }> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      headers: { "User-Agent": "NURA-X-Verifier/1.0" },
    });
    const contentType   = res.headers.get("content-type") ?? "";
    const text          = await res.text();
    const responseTimeMs = Date.now() - t0;
    return {
      html: text,
      network: {
        statusCode:    res.status,
        responseTimeMs,
        contentType,
        contentLength: text.length,
        serverError:   res.status >= 500,
      },
    };
  } catch (err) {
    return {
      html: "",
      network: {
        statusCode:    0,
        responseTimeMs: Date.now() - t0,
        contentType:   "",
        contentLength: 0,
        serverError:   true,
      },
    };
  }
}

// ── Accessibility heuristics ──────────────────────────────────────────────────

function analyzeAccessibility(html: string): AccessibilityReport {
  const imgs        = (html.match(/<img[^>]+>/gi) ?? []);
  const missingAlt  = imgs.filter(t => !/alt=/i.test(t)).length;
  const inputs      = (html.match(/<input[^>]+>/gi) ?? []);
  const missingLbl  = inputs.filter(t => !/(?:aria-label|id=)/i.test(t)).length;
  const score       = Math.max(0, 100 - missingAlt * 5 - missingLbl * 3);
  return { missingAltText: missingAlt, missingLabels: missingLbl, lowContrastCount: 0, score };
}

// ── Main verifier ─────────────────────────────────────────────────────────────

export async function runBrowserVerification(
  target: VerificationTarget,
): Promise<BrowserVerificationResult> {
  const t0    = Date.now();
  const depth = target.depth ?? "standard";
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Step 1 — Fetch page (upgrade to Playwright if available)
  let html:    string;
  let network: NetworkReport;

  const playwrightOk = await isPlaywrightAvailable();
  if (playwrightOk) {
    const session = await capturePageSession(target.url);
    html    = session.html;
    network = { statusCode: 200, responseTimeMs: session.durationMs, contentType: "text/html", contentLength: html.length, serverError: false };
  } else {
    ({ html, network } = await fetchPage(target.url));
  }

  // Step 2 — Network check
  if (network.serverError) {
    issues.push(`Server returned HTTP ${network.statusCode}`);
    suggestions.push("Check that the server is running and the port is exposed");
  }
  if (network.responseTimeMs > 3000) {
    issues.push(`Slow response: ${network.responseTimeMs}ms`);
    suggestions.push("Investigate slow startup or database query");
  }

  // Step 3 — DOM analysis
  const dom    = validateDom(html);
  const domScore = scoreDom(dom);
  if (dom.isBlank)       issues.push("Page appears blank — body content missing");
  if (dom.hasReactError) { issues.push("React error boundary triggered"); suggestions.push("Check console for hydration errors"); }
  if (dom.hasWhiteScreen){ issues.push("White screen detected"); }

  // Step 4 — Console error extraction
  const consoleErrors = extractConsoleErrorsFromHtml(html);
  const errCount      = consoleErrors.filter(e => e.level === "error").length;
  if (errCount > 0) {
    issues.push(`${errCount} JavaScript error(s) detected`);
    suggestions.push("Open browser console for details");
  }

  // Step 5 — Visual analysis
  const visual = analyzeVisuals(html, dom, network);
  if (visual.likelyLoading) issues.push("App may be stuck in loading state");

  // Step 6 — Interaction tests (standard + deep only)
  const interactions: BrowserVerificationResult["interactions"] = [];
  if (depth !== "smoke") {
    const specs = target.interactions ?? deriveDefaultInteractions(html);
    interactions.push(...runInteractions(html, specs));
    const intScore = scoreInteractions(interactions);
    if (intScore < 60) issues.push(`Interaction checks: ${intScore}% pass rate`);
  }

  // Step 7 — Accessibility (deep only)
  const accessibility = depth === "deep"
    ? analyzeAccessibility(html)
    : { missingAltText: 0, missingLabels: 0, lowContrastCount: 0, score: 100 };

  // Step 8 — Compute final score
  const intScore = scoreInteractions(interactions);
  const score = Math.round(
    (domScore * 0.40) +
    (Math.max(0, 100 - errCount * 20) * 0.30) +
    (intScore * 0.20) +
    (accessibility.score * 0.10),
  );

  return {
    passed:        score >= 60 && !network.serverError,
    score,
    depth,
    network,
    dom,
    consoleErrors,
    interactions,
    accessibility,
    issues,
    suggestions,
    elapsedMs: Date.now() - t0,
    ts:        Date.now(),
  };
}
