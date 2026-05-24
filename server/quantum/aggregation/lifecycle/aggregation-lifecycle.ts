/**
 * lifecycle/aggregation-lifecycle.ts
 *
 * Lifecycle hook registry for streaming aggregation sessions.
 * Allows external modules to subscribe to session open/close events
 * without coupling to the coordinator directly.
 */

import type {
  StreamingSessionId,
  StreamingSessionConfig,
  CollapseResult,
  PartialAggregationState,
} from "../contracts/aggregation.types.ts";

// ── Hook types ────────────────────────────────────────────────────────────────

export type SessionOpenHook    = (cfg:    StreamingSessionConfig)    => void;
export type SessionCloseHook   = (result: CollapseResult)             => void;
export type SessionFailHook    = (sessionId: StreamingSessionId, reason: string) => void;
export type PartialUpdateHook  = (state:  PartialAggregationState)   => void;

interface LifecycleHooks {
  onOpen:    SessionOpenHook[];
  onClose:   SessionCloseHook[];
  onFail:    SessionFailHook[];
  onPartial: PartialUpdateHook[];
}

// ── Global registry ───────────────────────────────────────────────────────────

const _hooks: LifecycleHooks = {
  onOpen:    [],
  onClose:   [],
  onFail:    [],
  onPartial: [],
};

// ── Registration ──────────────────────────────────────────────────────────────

export function onSessionOpen(hook: SessionOpenHook): () => void {
  _hooks.onOpen.push(hook);
  return () => { _hooks.onOpen = _hooks.onOpen.filter(h => h !== hook); };
}

export function onSessionClose(hook: SessionCloseHook): () => void {
  _hooks.onClose.push(hook);
  return () => { _hooks.onClose = _hooks.onClose.filter(h => h !== hook); };
}

export function onSessionFail(hook: SessionFailHook): () => void {
  _hooks.onFail.push(hook);
  return () => { _hooks.onFail = _hooks.onFail.filter(h => h !== hook); };
}

export function onPartialUpdate(hook: PartialUpdateHook): () => void {
  _hooks.onPartial.push(hook);
  return () => { _hooks.onPartial = _hooks.onPartial.filter(h => h !== hook); };
}

// ── Fire ──────────────────────────────────────────────────────────────────────

export function fireOpen(cfg: StreamingSessionConfig): void {
  for (const h of _hooks.onOpen) { try { h(cfg); } catch { /* non-fatal */ } }
}

export function fireClose(result: CollapseResult): void {
  for (const h of _hooks.onClose) { try { h(result); } catch { /* non-fatal */ } }
}

export function fireFail(sessionId: StreamingSessionId, reason: string): void {
  for (const h of _hooks.onFail) { try { h(sessionId, reason); } catch { /* non-fatal */ } }
}

export function firePartial(state: PartialAggregationState): void {
  for (const h of _hooks.onPartial) { try { h(state); } catch { /* non-fatal */ } }
}

// ── Inspect ───────────────────────────────────────────────────────────────────

export function hookCounts(): { open: number; close: number; fail: number; partial: number } {
  return {
    open:    _hooks.onOpen.length,
    close:   _hooks.onClose.length,
    fail:    _hooks.onFail.length,
    partial: _hooks.onPartial.length,
  };
}
