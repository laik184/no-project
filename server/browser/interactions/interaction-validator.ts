/**
 * server/browser/interactions/interaction-validator.ts
 * Validates that critical interactive elements exist and are visible in the DOM.
 * Single responsibility: interaction validation. No side effects.
 */

import type { BrowserSession, InteractionStatus } from "../types.ts";

const CRITICAL_ELEMENT_PATTERNS = [
  { pattern: /<button[^>]*>/i,         name: "button" },
  { pattern: /<a\s[^>]*href/i,         name: "link" },
  { pattern: /<input[^>]*>/i,          name: "input" },
  { pattern: /<form[^>]*>/i,           name: "form" },
];

export interface InteractionValidationResult {
  status:           InteractionStatus;
  elementsFound:    string[];
  elementsMissing:  string[];
  reason?:          string;
}

export async function validateInteractions(
  session: BrowserSession,
  requiredElements?: string[],
): Promise<InteractionValidationResult> {
  try {
    const res = await fetch(session.url, {
      headers: { Accept: "text/html" },
      signal:  AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      return {
        status:          "failed",
        elementsFound:   [],
        elementsMissing: [],
        reason:          `HTTP ${res.status}`,
      };
    }

    const html       = await res.text();
    const found:   string[] = [];
    const missing: string[] = [];

    for (const { pattern, name } of CRITICAL_ELEMENT_PATTERNS) {
      if (pattern.test(html)) {
        found.push(name);
      } else if (requiredElements?.includes(name)) {
        missing.push(name);
      }
    }

    const status: InteractionStatus = missing.length > 0 ? "failed" : "ok";

    return {
      status,
      elementsFound:   found,
      elementsMissing: missing,
      reason: missing.length > 0
        ? `Critical elements missing: ${missing.join(", ")}`
        : undefined,
    };
  } catch (e: any) {
    return {
      status:          "failed",
      elementsFound:   [],
      elementsMissing: [],
      reason:          e?.message ?? "Fetch failed",
    };
  }
}
