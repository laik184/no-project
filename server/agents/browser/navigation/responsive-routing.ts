/**
 * server/agents/browser/navigation/responsive-routing.ts
 *
 * Manages responsive execution routing — maps URLs to viewport test strategies.
 * Pure routing/planning — no tool dispatch.
 */

import type { ViewportSize } from '../types/navigation.types.ts';

export interface ResponsiveRoute {
  url:       string;
  viewports: ViewportSize[];
  captureScreenshot: boolean;
  validateUI:        boolean;
  timeoutMs:         number;
}

// ── Standard viewports ────────────────────────────────────────────────────────

export const VIEWPORT_MOBILE: ViewportSize   = { width:  375, height:  812, label: 'mobile' };
export const VIEWPORT_TABLET: ViewportSize   = { width:  768, height: 1024, label: 'tablet' };
export const VIEWPORT_DESKTOP: ViewportSize  = { width: 1280, height:  720, label: 'desktop' };
export const VIEWPORT_WIDE: ViewportSize     = { width: 1920, height: 1080, label: 'wide' };

export const STANDARD_VIEWPORTS: ViewportSize[] = [
  VIEWPORT_MOBILE,
  VIEWPORT_TABLET,
  VIEWPORT_DESKTOP,
];

// ── Route builder ─────────────────────────────────────────────────────────────

export function buildResponsiveRoute(
  url:       string,
  opts: {
    viewports?:         ViewportSize[];
    captureScreenshot?: boolean;
    validateUI?:        boolean;
    timeoutMs?:         number;
  } = {},
): ResponsiveRoute {
  return {
    url,
    viewports:         opts.viewports        ?? STANDARD_VIEWPORTS,
    captureScreenshot: opts.captureScreenshot ?? true,
    validateUI:        opts.validateUI        ?? true,
    timeoutMs:         opts.timeoutMs         ?? 30_000,
  };
}

// ── Viewport utilities ────────────────────────────────────────────────────────

export function routeForViewport(
  route:    ResponsiveRoute,
  viewport: ViewportSize,
): { url: string; viewport: ViewportSize; label: string } {
  return {
    url:      route.url,
    viewport,
    label:    `${viewport.label ?? `${viewport.width}x${viewport.height}`}`,
  };
}

export function expandResponsiveRoutes(
  route: ResponsiveRoute,
): Array<{ url: string; viewport: ViewportSize; label: string }> {
  return route.viewports.map(vp => routeForViewport(route, vp));
}

export function selectViewports(
  input?: ViewportSize[],
  preset: 'standard' | 'mobile-only' | 'desktop-only' = 'standard',
): ViewportSize[] {
  if (input?.length) return input;
  if (preset === 'mobile-only')  return [VIEWPORT_MOBILE];
  if (preset === 'desktop-only') return [VIEWPORT_DESKTOP];
  return STANDARD_VIEWPORTS;
}
