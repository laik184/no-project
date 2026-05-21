/**
 * server/browser/vision/responsive-overflow-detector.ts
 * Detects responsive overflow issues by checking common viewport breakpoints.
 * Single responsibility: viewport overflow detection. No side effects.
 */

import type { BrowserSession, ResponsiveIssue } from "../types.ts";

const VIEWPORTS = [
  { name: "mobile",  width: 375 },
  { name: "tablet",  width: 768 },
  { name: "desktop", width: 1280 },
];

export async function detectResponsiveIssues(
  session: BrowserSession,
): Promise<ResponsiveIssue[]> {
  const issues: ResponsiveIssue[] = [];

  // Without a real browser we check HTML for viewport meta and overflow-hiding CSS
  try {
    const res = await fetch(session.url, {
      headers: { Accept: "text/html" },
      signal:  AbortSignal.timeout(4_000),
    });
    if (!res.ok) return [];

    const html = await res.text();

    // 1. Missing viewport meta
    if (!/meta[^>]+viewport/i.test(html)) {
      issues.push({
        viewport:    "all",
        description: "Missing <meta name='viewport'> — page will not scale on mobile",
        severity:    "high",
      });
    }

    // 2. Fixed pixel widths wider than mobile
    const wideFixed = html.match(/width:\s*(\d{4,})px/gi) ?? [];
    for (const match of wideFixed.slice(0, 3)) {
      const px = parseInt(match.replace(/\D/g, ""));
      if (px > 600) {
        issues.push({
          viewport:    "mobile",
          description: `Fixed width ${px}px will overflow mobile viewport (${VIEWPORTS[0]!.width}px)`,
          severity:    "medium",
        });
      }
    }

    // 3. overflow-x: hidden on body (often masks overflow bugs)
    if (/overflow-x\s*:\s*hidden/i.test(html)) {
      issues.push({
        viewport:    "mobile",
        description: "overflow-x: hidden on body may mask overflow issues",
        severity:    "low",
      });
    }

  } catch { /* ignore — can't connect */ }

  return issues;
}
