/**
 * server/browser/checks/blank-screen-detector.ts
 * Detects blank/empty page by inspecting DOM body content via HTTP.
 * Single responsibility: blank screen detection. No Playwright dependency.
 */

import type { BrowserSession, VisualStatus } from "../types.ts";

const BLANK_INDICATORS = [
  /^\s*$/,                          // completely empty body
  /<body[^>]*>\s*<\/body>/i,        // empty body tags
  /loading\.\.\.|initializing/i,    // stuck loading state
];

const CONTENT_MINIMUM_CHARS = 50;

export interface BlankScreenResult {
  isBlank:     boolean;
  visualStatus: VisualStatus;
  bodyLength:  number;
  reason?:     string;
}

export async function detectBlankScreen(
  session: BrowserSession,
): Promise<BlankScreenResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);

    const res = await fetch(session.url, {
      signal:  controller.signal,
      headers: { "Accept": "text/html" },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        isBlank:     true,
        visualStatus: "error",
        bodyLength:  0,
        reason:      `HTTP ${res.status}`,
      };
    }

    const html       = await res.text();
    const bodyMatch  = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyText   = bodyMatch?.[1] ?? html;
    const bodyLength = bodyText.replace(/\s+/g, " ").trim().length;

    for (const pattern of BLANK_INDICATORS) {
      if (pattern.test(bodyText)) {
        return {
          isBlank: true, visualStatus: "blank",
          bodyLength, reason: `Blank indicator matched: ${pattern}`,
        };
      }
    }

    if (bodyLength < CONTENT_MINIMUM_CHARS) {
      return {
        isBlank: true, visualStatus: "partial",
        bodyLength, reason: `Body too short (${bodyLength} chars)`,
      };
    }

    return { isBlank: false, visualStatus: "ok", bodyLength };

  } catch (e: any) {
    return {
      isBlank: true, visualStatus: "error",
      bodyLength: 0,
      reason: e?.name === "AbortError" ? "Request timed out" : e?.message,
    };
  }
}
