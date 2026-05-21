/**
 * server/browser/interactions/route-navigation-validator.ts
 * Validates that client-side routes load without errors.
 * Single responsibility: route navigation probing. No orchestration.
 */

import type { Page } from "playwright";

export interface RouteResult {
  path:          string;
  statusCode:    number | null;
  loaded:        boolean;
  isBlank:       boolean;
  consoleErrors: string[];
  loadTimeMs:    number;
}

export interface RouteNavigationReport {
  testedRoutes:  RouteResult[];
  failedRoutes:  RouteResult[];
  passed:        boolean;
  summary:       string;
}

const DEFAULT_ROUTES = ["/", "/404"];
const NAV_TIMEOUT_MS = 8_000;
const BLANK_THRESHOLD = 200;   // body text chars below this = blank

async function probeRoute(page: Page, baseUrl: string, routePath: string): Promise<RouteResult> {
  const errors: string[] = [];
  const url = `${baseUrl}${routePath}`;
  const start = Date.now();
  let statusCode: number | null = null;
  let loaded = false;

  page.on("console", msg => {
    if (msg.type() === "error") errors.push(msg.text().slice(0, 120));
  });

  try {
    const response = await page.goto(url, { timeout: NAV_TIMEOUT_MS, waitUntil: "domcontentloaded" });
    statusCode = response?.status() ?? null;

    await page.waitForTimeout(500);

    const bodyText = await page.evaluate(() => document.body?.innerText ?? "");
    const isBlank  = bodyText.trim().length < BLANK_THRESHOLD;
    loaded = !isBlank && (statusCode == null || statusCode < 400);

    return {
      path: routePath,
      statusCode,
      loaded,
      isBlank,
      consoleErrors: errors,
      loadTimeMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      path: routePath,
      statusCode,
      loaded: false,
      isBlank: true,
      consoleErrors: [...errors, `Navigation error: ${message}`],
      loadTimeMs: Date.now() - start,
    };
  }
}

export async function validateRoutes(
  page: Page,
  baseUrl: string,
  routes: string[] = DEFAULT_ROUTES,
): Promise<RouteNavigationReport> {
  const results: RouteResult[] = [];

  for (const route of routes) {
    const result = await probeRoute(page, baseUrl, route);
    results.push(result);
  }

  const failedRoutes = results.filter(r => !r.loaded || r.isBlank);
  const passed = failedRoutes.length === 0;

  const summary = passed
    ? `All ${results.length} route(s) loaded successfully.`
    : `${failedRoutes.length}/${results.length} route(s) failed: ${failedRoutes.map(r => r.path).join(", ")}`;

  return { testedRoutes: results, failedRoutes, passed, summary };
}
