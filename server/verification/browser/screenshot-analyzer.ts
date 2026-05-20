/**
 * screenshot-analyzer.ts
 *
 * Analyzes page content for visual "blank screen" indicators.
 * Uses content-based heuristics — no screenshot binary needed.
 * When Playwright is available, can analyze actual pixel data.
 */

import type { DomReport, NetworkReport } from "./verification-types.ts";

export interface VisualAnalysis {
  likelyBlank:    boolean;
  likelyLoading:  boolean;
  hasVisibleContent: boolean;
  confidenceScore:   number;  // 0.0–1.0
  signals:        string[];   // human-readable reasons
}

/** Patterns that indicate loading states. */
const LOADING_PATTERNS = [
  /loading\.\.\./i,
  /please wait/i,
  /spinner/i,
  /<div[^>]+class="[^"]*loading[^"]*"/i,
  /<div[^>]+class="[^"]*skeleton[^"]*"/i,
  /data-loading="true"/i,
];

/** Patterns that indicate the app is rendering real content. */
const CONTENT_SIGNALS = [
  /<h[1-3][^>]*>[^<]{3,}/i,       // heading with text
  /<p[^>]*>[^<]{20,}/i,            // paragraph with content
  /<button[^>]*>[^<]{2,}/i,        // button with label
  /<nav[^>]*>/i,                   // navigation present
  /<main[^>]*>/i,                  // main content area
  /<article[^>]*>/i,               // article content
  /class="[^"]*container[^"]*"/i,  // layout container
  /class="[^"]*dashboard[^"]*"/i,  // dashboard
  /class="[^"]*card[^"]*"/i,       // card component
];

export function analyzeVisuals(
  html:    string,
  dom:     DomReport,
  network: NetworkReport,
): VisualAnalysis {
  const signals: string[] = [];
  let contentScore = 0;

  // Network signals
  if (network.serverError) {
    signals.push("Server returned error status");
  }
  if (network.contentLength < 200) {
    signals.push(`Suspiciously small response (${network.contentLength} bytes)`);
  }

  // DOM signals
  if (dom.isBlank) {
    signals.push("DOM body is empty or near-empty");
  }
  if (dom.hasReactError) {
    signals.push("React error boundary triggered");
  }
  if (dom.bodyText.length < 30) {
    signals.push("Body text too short for a real UI");
  }

  // Content signals
  for (const pattern of CONTENT_SIGNALS) {
    if (pattern.test(html)) contentScore++;
  }
  if (contentScore >= 3) signals.push(`${contentScore} content signals detected`);

  // Loading patterns
  const isLoading = LOADING_PATTERNS.some(p => p.test(html));
  if (isLoading) signals.push("Loading state detected — app may not be ready");

  const hasVisibleContent = contentScore >= 2 && !dom.isBlank && !dom.hasReactError;
  const likelyBlank       = dom.isBlank || (contentScore === 0 && dom.bodyText.length < 30);
  const likelyLoading     = isLoading && !hasVisibleContent;

  const confidenceScore = hasVisibleContent
    ? Math.min(1.0, 0.5 + (contentScore * 0.1))
    : likelyBlank ? 0.1 : 0.4;

  return { likelyBlank, likelyLoading, hasVisibleContent, confidenceScore, signals };
}

/** Quick check: does the content look like a real app? */
export function isAppRendered(dom: DomReport, network: NetworkReport): boolean {
  if (network.serverError)           return false;
  if (dom.isBlank || dom.hasWhiteScreen) return false;
  if (dom.bodyText.length < 20)      return false;
  return true;
}
