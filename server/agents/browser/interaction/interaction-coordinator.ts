/**
 * server/agents/browser/interaction/interaction-coordinator.ts
 *
 * Coordinates browser interactions (click, fill, select).
 * Builds tool inputs and delegates to tool-coordinator — no direct dispatch.
 */

import {
  dispatchBrowserTool,
  type ToolExecutionContext,
  type ToolExecutionResult,
}                       from '../coordination/dispatcher-client.ts';
import { TOOL }         from '../coordination/tool-coordinator.ts';

export interface ClickTarget {
  selector:  string;
  timeoutMs?: number;
}

export interface FillTarget {
  selector:  string;
  value:     string;
  timeoutMs?: number;
}

export interface SelectTarget {
  selector:  string;
  value:     string;
  timeoutMs?: number;
}

export interface InteractionResult {
  ok:        boolean;
  tool:      string;
  durationMs: number;
  error?:    string;
}

// ── Coordinators ──────────────────────────────────────────────────────────────

export async function coordinateClick(
  target: ClickTarget,
  ctx:    ToolExecutionContext,
): Promise<InteractionResult> {
  const r = await dispatchBrowserTool(TOOL.CLICK, target as Record<string, unknown>, ctx);
  return toInteractionResult(TOOL.CLICK, r);
}

export async function coordinateFill(
  target: FillTarget,
  ctx:    ToolExecutionContext,
): Promise<InteractionResult> {
  const r = await dispatchBrowserTool(TOOL.FILL, target as Record<string, unknown>, ctx);
  return toInteractionResult(TOOL.FILL, r);
}

export async function coordinateSelect(
  target: SelectTarget,
  ctx:    ToolExecutionContext,
): Promise<InteractionResult> {
  const r = await dispatchBrowserTool(TOOL.SELECT, target as Record<string, unknown>, ctx);
  return toInteractionResult(TOOL.SELECT, r);
}

export async function coordinateWaitForElement(
  selector:  string,
  ctx:       ToolExecutionContext,
  timeoutMs?: number,
): Promise<InteractionResult> {
  const r = await dispatchBrowserTool(
    TOOL.WAIT_ELEMENT,
    { selector, timeoutMs } as Record<string, unknown>,
    ctx,
  );
  return toInteractionResult(TOOL.WAIT_ELEMENT, r);
}

export async function coordinateWaitForVisible(
  selector:  string,
  ctx:       ToolExecutionContext,
  timeoutMs?: number,
): Promise<InteractionResult> {
  const r = await dispatchBrowserTool(
    TOOL.WAIT_VISIBLE,
    { selector, timeoutMs } as Record<string, unknown>,
    ctx,
  );
  return toInteractionResult(TOOL.WAIT_VISIBLE, r);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function toInteractionResult(
  tool: string,
  r:    ToolExecutionResult<unknown>,
): InteractionResult {
  return {
    ok:        r.ok,
    tool,
    durationMs: r.durationMs,
    error:     r.ok ? undefined : r.error,
  };
}
