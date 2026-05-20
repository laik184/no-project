/**
 * playwright-manager.ts
 *
 * Singleton manager for Playwright browser instance.
 * Gracefully degrades when Playwright is not available.
 * All external callers MUST use isPlaywrightAvailable() before using the browser.
 */

const PLAYWRIGHT_ENABLED = process.env.ENABLE_PLAYWRIGHT_VERIFICATION === "true";

let _browserAvailable: boolean | null = null;

export async function isPlaywrightAvailable(): Promise<boolean> {
  if (!PLAYWRIGHT_ENABLED) return false;
  if (_browserAvailable !== null) return _browserAvailable;

  try {
    const pw = await import("playwright");
    const browser = await pw.chromium.launch({ headless: true });
    await browser.close();
    _browserAvailable = true;
    console.log("[playwright-manager] Playwright + Chromium available");
  } catch {
    _browserAvailable = false;
    console.log("[playwright-manager] Playwright unavailable — using HTTP fallback");
  }
  return _browserAvailable;
}

export interface PlaywrightSession {
  url:       string;
  html:      string;
  title:     string;
  consoleLogs: Array<{ level: string; text: string }>;
  errors:    string[];
  durationMs:number;
}

/**
 * Open a page with Playwright, capture HTML + console errors.
 * Only call after confirming isPlaywrightAvailable() === true.
 */
export async function capturePageSession(url: string, timeoutMs = 15_000): Promise<PlaywrightSession> {
  const pw      = await import("playwright");
  const browser = await pw.chromium.launch({ headless: true });
  const page    = await browser.newPage();
  const logs: Array<{ level: string; text: string }> = [];
  const errors: string[] = [];
  const t0 = Date.now();

  page.on("console", msg => {
    logs.push({ level: msg.type(), text: msg.text() });
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", err => errors.push(err.message));

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: timeoutMs });
    const html  = await page.content();
    const title = await page.title();
    return { url, html, title, consoleLogs: logs, errors, durationMs: Date.now() - t0 };
  } finally {
    await browser.close();
  }
}

export function isPlaywrightFeatureFlagEnabled(): boolean {
  return PLAYWRIGHT_ENABLED;
}
