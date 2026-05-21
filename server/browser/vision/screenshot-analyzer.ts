/**
 * server/browser/vision/screenshot-analyzer.ts
 * Analyzes screenshot evidence via heuristics (pixel stats when available).
 * Falls back to DOM-based analysis when Playwright is not available.
 * Single responsibility: produce ScreenshotAnalysis. No side effects.
 */

import type { BrowserSession, ScreenshotAnalysis } from "../types.ts";

const PLAYWRIGHT_AVAILABLE = (() => {
  try { require.resolve("playwright"); return true; } catch { return false; }
})();

export async function analyzeScreenshot(
  session:   BrowserSession,
  domText?:  string,
): Promise<ScreenshotAnalysis> {
  if (PLAYWRIGHT_AVAILABLE) {
    return analyzeWithPlaywright(session);
  }
  return analyzeViaDom(session, domText);
}

async function analyzeViaDom(
  session: BrowserSession,
  domText?: string,
): Promise<ScreenshotAnalysis> {
  let bodyText = domText ?? "";

  if (!bodyText) {
    try {
      const res = await fetch(session.url, {
        headers: { Accept: "text/html" },
        signal:  AbortSignal.timeout(4_000),
      });
      if (res.ok) {
        const html = await res.text();
        bodyText = html.replace(/<[^>]+>/g, " ").trim();
      }
    } catch { /* ignore */ }
  }

  const isBlank          = bodyText.length < 50;
  const hasContent       = bodyText.length > 200;
  const hasErrorOverlay  = /\b(?:error|exception|failed)\b/i.test(bodyText);

  return {
    isBlank,
    hasContent,
    hasErrorOverlay,
    confidence: 0.65, // DOM-based, lower confidence than visual
    notes: [
      isBlank         ? "Page appears blank (body too short)"    : "Page has content",
      hasErrorOverlay ? "Error text detected in page body"       : "No error text found",
      "Analysis via DOM (Playwright not installed)",
    ],
  };
}

async function analyzeWithPlaywright(
  session: BrowserSession,
): Promise<ScreenshotAnalysis> {
  // Playwright path — lazy import so server starts without it installed
  try {
    const { chromium } = await import("playwright" as any);
    const browser   = await chromium.launch({ headless: true });
    const page      = await browser.newPage();

    await page.goto(session.url, { waitUntil: "networkidle", timeout: 8_000 });
    const bodyText      = await page.evaluate(() => document.body?.innerText ?? "");
    const screenshotBuf = await page.screenshot({ type: "jpeg", quality: 60 });
    await browser.close();

    // Pixel analysis: if avg brightness very high → likely blank white page
    const avgByte = screenshotBuf.reduce((s: number, b: number) => s + b, 0) / screenshotBuf.length;
    const isBlank = avgByte > 245 && bodyText.length < 50;

    return {
      isBlank,
      hasContent:       !isBlank,
      hasErrorOverlay:  /error|exception|failed/i.test(bodyText),
      confidence:       0.92,
      notes: [isBlank ? "Likely blank (high pixel brightness)" : "Visual content detected"],
    };
  } catch (e: any) {
    return {
      isBlank: false, hasContent: true,
      hasErrorOverlay: false, confidence: 0.3,
      notes: [`Playwright analysis failed: ${e.message}`],
    };
  }
}
