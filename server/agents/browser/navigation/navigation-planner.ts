/**
 * server/agents/browser/navigation/navigation-planner.ts
 *
 * Builds a navigation strategy from a URL goal.
 * Pure planning — produces a plan object, never dispatches tools.
 */

import type { FlowStep } from '../types/navigation.types.ts';

export interface NavigationPlan {
  url:          string;
  allowedHosts: string[];
  steps:        FlowStep[];
  timeoutMs:    number;
  strategy:     'direct' | 'wait-load' | 'spa' | 'auth-gated';
}

export interface NavigationContext {
  url:           string;
  allowedHosts?: string[];
  timeoutMs?:    number;
  waitForLoad?:  boolean;
  isSPA?:        boolean;
  requiresAuth?: boolean;
}

// ── Strategy classification ───────────────────────────────────────────────────

function classifyStrategy(ctx: NavigationContext): NavigationPlan['strategy'] {
  if (ctx.requiresAuth)  return 'auth-gated';
  if (ctx.isSPA)         return 'spa';
  if (ctx.waitForLoad)   return 'wait-load';
  return 'direct';
}

function buildAllowedHosts(url: string, extra: string[] = []): string[] {
  try {
    const { hostname } = new URL(url);
    const defaults = ['localhost', '127.0.0.1', hostname];
    const replitHost = process.env.REPLIT_DEV_DOMAIN;
    if (replitHost) defaults.push(replitHost);
    return [...new Set([...defaults, ...extra])];
  } catch {
    return ['localhost', '127.0.0.1', ...extra];
  }
}

// ── Plan builder ──────────────────────────────────────────────────────────────

export function buildNavigationPlan(ctx: NavigationContext): NavigationPlan {
  const strategy    = classifyStrategy(ctx);
  const allowedHosts = buildAllowedHosts(ctx.url, ctx.allowedHosts);
  const timeoutMs   = ctx.timeoutMs ?? 30_000;

  const steps: FlowStep[] = [
    { action: 'navigate', url: ctx.url, timeoutMs },
  ];

  if (strategy === 'wait-load' || strategy === 'spa') {
    steps.push({ action: 'wait', selector: 'body', timeoutMs: 5_000 });
  }

  return { url: ctx.url, allowedHosts, steps, timeoutMs, strategy };
}

export function planFromUrl(url: string, opts: Omit<NavigationContext, 'url'> = {}): NavigationPlan {
  return buildNavigationPlan({ url, ...opts });
}

export function extractUrlHost(url: string): string {
  try { return new URL(url).hostname; } catch { return 'localhost'; }
}

export function isLocalUrl(url: string): boolean {
  const host = extractUrlHost(url);
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.replit.dev');
}
