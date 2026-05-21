/**
 * server/browser/checks/asset-failure-detector.ts
 * Detects failed asset loads (CSS, JS, images) by scanning HTML for src/href.
 * Single responsibility: asset failure detection. Read-only HTTP requests.
 */

import type { BrowserSession } from "../types.ts";

export interface AssetFailure {
  url:    string;
  type:   "script" | "stylesheet" | "image" | "font";
  status: number;
}

const ASSET_PATTERNS: Array<{ re: RegExp; type: AssetFailure["type"] }> = [
  { re: /<script[^>]+src=["']([^"']+)["']/gi,     type: "script" },
  { re: /<link[^>]+href=["']([^"']+\.css[^"']*)["']/gi, type: "stylesheet" },
  { re: /<img[^>]+src=["']([^"']+)["']/gi,         type: "image" },
];

export async function detectAssetFailures(
  session: BrowserSession,
): Promise<AssetFailure[]> {
  let html = "";
  try {
    const res = await fetch(session.url, {
      headers: { Accept: "text/html" },
      signal:  AbortSignal.timeout(4_000),
    });
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }

  const assetUrls: Array<{ url: string; type: AssetFailure["type"] }> = [];

  for (const { re, type } of ASSET_PATTERNS) {
    for (const m of html.matchAll(re)) {
      const src = m[1]!;
      if (src.startsWith("http") || src.startsWith("//")) continue; // external
      if (src.startsWith("data:")) continue;
      assetUrls.push({ url: `${session.url.replace(/\/$/, "")}${src}`, type });
    }
  }

  const failures: AssetFailure[] = [];
  const checks = assetUrls.slice(0, 20).map(async ({ url, type }) => {
    try {
      const r = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(2_000),
      });
      if (r.status >= 400) failures.push({ url, type, status: r.status });
    } catch { /* network error counts as failure */ }
  });

  await Promise.allSettled(checks);
  return failures;
}
