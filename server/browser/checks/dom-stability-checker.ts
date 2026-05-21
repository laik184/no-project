/**
 * server/browser/checks/dom-stability-checker.ts
 * Checks DOM stability by comparing two snapshots taken 500ms apart.
 * Single responsibility: DOM stability assessment. No side effects.
 */

import type { BrowserSession, DOMSnapshot } from "../types.ts";

async function fetchDOMSnapshot(url: string): Promise<DOMSnapshot | null> {
  try {
    const res = await fetch(url, {
      headers: { "Accept": "text/html" },
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) return null;

    const html = await res.text();

    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const bodyMatch  = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyText   = (bodyMatch?.[1] ?? "").replace(/<[^>]+>/g, " ").trim();

    // Count elements
    const elementCount = (html.match(/<[a-z][^>/]*/gi) ?? []).length;

    // Find visible error text patterns
    const visibleErrors: string[] = [];
    for (const pattern of [/error:/i, /failed:/i, /exception:/i]) {
      const m = bodyText.match(pattern);
      if (m) visibleErrors.push(m[0]);
    }

    return {
      title:        titleMatch?.[1] ?? "",
      url,
      bodyText:     bodyText.slice(0, 500),
      elementCount,
      hasMain:      /<main[\s>]/.test(html),
      hasNav:       /<nav[\s>]/.test(html),
      visibleErrors,
    };
  } catch {
    return null;
  }
}

export interface DOMStabilityResult {
  stable:       boolean;
  snapshot:     DOMSnapshot | null;
  changedCount: number;
  reason?:      string;
}

export async function checkDOMStability(
  session: BrowserSession,
): Promise<DOMStabilityResult> {
  const snap1 = await fetchDOMSnapshot(session.url);
  await new Promise(r => setTimeout(r, 600));
  const snap2 = await fetchDOMSnapshot(session.url);

  if (!snap1 || !snap2) {
    return { stable: false, snapshot: snap1, changedCount: 0, reason: "Could not fetch DOM" };
  }

  // Compare element count drift
  const drift = Math.abs(snap1.elementCount - snap2.elementCount);
  const stable = drift < 10; // allow minor updates

  return {
    stable,
    snapshot:     snap2,
    changedCount: drift,
    reason:       stable ? undefined : `DOM changed by ${drift} elements between snapshots`,
  };
}
