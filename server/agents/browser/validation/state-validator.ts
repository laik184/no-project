/**
 * server/agents/browser/validation/state-validator.ts
 *
 * Validates browser runtime state and session lifecycle transitions.
 * Detects: invalid session state, corrupted sessions, invalid transitions.
 */

import { hasSession }         from '../../tools/browser/session/browser-context.ts';
import { getSession }         from '../core/browser-state.ts';
import {
  getContext,
  type BrowserAgentStatus,
}                             from '../core/browser-context.ts';
import type { BrowserSessionStatus } from '../types/browser.types.ts';

export interface StateValidationResult {
  ok:      boolean;
  checks:  StateCheck[];
  summary: string;
}

export interface StateCheck {
  name:    string;
  ok:      boolean;
  reason?: string;
}

// ── Valid lifecycle transitions ───────────────────────────────────────────────

const VALID_TRANSITIONS: Record<BrowserAgentStatus, BrowserAgentStatus[]> = {
  idle:       ['planning'],
  planning:   ['executing'],
  executing:  ['capturing', 'validating', 'retrying', 'failed'],
  capturing:  ['validating', 'completed', 'failed'],
  validating: ['completed', 'failed'],
  retrying:   ['executing', 'failed'],
  completed:  [],
  failed:     [],
};

export function isValidTransition(
  from: BrowserAgentStatus,
  to:   BrowserAgentStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Session state validation ──────────────────────────────────────────────────

export function validateSessionState(
  runId:     string,
  sessionId: string,
): StateValidationResult {
  const checks: StateCheck[] = [];

  // Check session exists in tool layer
  const toolHasSession = hasSession(runId);
  checks.push({ name: 'tool-session-active', ok: toolHasSession,
    reason: toolHasSession ? undefined : 'No active tool-layer session for runId' });

  // Check session in state store
  const stateSession = getSession(sessionId);
  checks.push({ name: 'state-record-exists', ok: !!stateSession,
    reason: stateSession ? undefined : 'Session not found in state store' });

  if (stateSession) {
    const sessionOk = stateSession.status === 'active';
    checks.push({ name: 'session-status-active', ok: sessionOk,
      reason: sessionOk ? undefined : `Session status is "${stateSession.status}"` });
  }

  const allOk = checks.every(c => c.ok);
  return {
    ok:      allOk,
    checks,
    summary: allOk ? 'Session state valid' : checks.filter(c => !c.ok).map(c => c.reason).join('; '),
  };
}

// ── Agent context validation ──────────────────────────────────────────────────

export function validateAgentContext(runId: string): StateValidationResult {
  const checks: StateCheck[] = [];
  const ctx = getContext(runId);

  checks.push({ name: 'context-exists', ok: !!ctx,
    reason: ctx ? undefined : 'No agent context found for runId' });

  if (ctx) {
    checks.push({ name: 'has-goal', ok: !!ctx.goal?.trim(),
      reason: ctx.goal ? undefined : 'Agent context has no goal' });
    checks.push({ name: 'has-url', ok: !!ctx.url?.trim(),
      reason: ctx.url ? undefined : 'Agent context has no URL' });
  }

  const allOk = checks.every(c => c.ok);
  return {
    ok:      allOk,
    checks,
    summary: allOk ? 'Agent context valid' : checks.filter(c => !c.ok).map(c => c.reason).join('; '),
  };
}
