/**
 * server/browser/checks/hydration-failure-detector.ts
 * Detects React/Vue/Svelte hydration failures from page HTML and error patterns.
 * Single responsibility: hydration failure detection. No side effects.
 */

import type { BrowserSession, HydrationStatus } from "../types.ts";

const HYDRATION_ERROR_PATTERNS = [
  /Hydration failed/i,
  /hydration mismatch/i,
  /did not match server-rendered HTML/i,
  /Text content does not match/i,
  /Minified React error/i,
  /There was an error while hydrating/i,
  /Cannot hydrate/i,
];

export interface HydrationResult {
  status:    HydrationStatus;
  errorText?: string;
  confidence: number;
}

export async function detectHydrationFailure(
  session: BrowserSession,
): Promise<HydrationResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);

    const res = await fetch(session.url, {
      signal: controller.signal,
      headers: { "Accept": "text/html" },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { status: "unknown", confidence: 0 };
    }

    const html = await res.text();

    for (const pattern of HYDRATION_ERROR_PATTERNS) {
      const match = html.match(pattern);
      if (match) {
        return {
          status:     "failed",
          errorText:  match[0],
          confidence: 0.9,
        };
      }
    }

    // Check for empty root mount point (common hydration issue)
    const hasEmptyRoot =
      /<div\s+id=["']root["']\s*><\/div>/.test(html) ||
      /<div\s+id=["']app["']\s*><\/div>/.test(html);

    if (hasEmptyRoot) {
      return {
        status:     "failed",
        errorText:  "Empty root/app mount point — JS likely failed to hydrate",
        confidence: 0.7,
      };
    }

    return { status: "ok", confidence: 0.85 };

  } catch (e: any) {
    if (e?.name === "AbortError") return { status: "timeout", confidence: 1 };
    return { status: "unknown", confidence: 0 };
  }
}
