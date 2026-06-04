/**
 * server/agents/browser/utils/browser-utils.ts
 * Pure utility helpers for the browser agent layer.
 */

import { randomUUID } from 'crypto';

export function generateSessionId(): string {
  return `bsess_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export function generateStepId(): string {
  return `bstep_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

export function generateFlowId(): string {
  return `bflow_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

export function elapsedMs(from: Date): number {
  return Date.now() - from.getTime();
}

export function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function isTimeoutError(msg: string): boolean {
  return /timeout|timed out/i.test(msg);
}

export function isNavigationError(msg: string): boolean {
  return /navigation|net::|ERR_|blocked/i.test(msg);
}

export function isCrashError(msg: string): boolean {
  return /crash|SIGKILL|Target closed|Session closed/i.test(msg);
}

export function sanitizeLabel(label: string): string {
  return label.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function truncate(str: string, max = 120): string {
  return str.length <= max ? str : str.slice(0, max) + '…';
}
