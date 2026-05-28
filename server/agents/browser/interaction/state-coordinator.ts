/**
 * server/agents/browser/interaction/state-coordinator.ts
 *
 * Coordinates reading and tracking runtime browser state.
 * Reads element presence, visibility, counts — pure coordination.
 */

import {
  executeTool,
  type ToolExecutionContext,
  type ToolExecutionResult,
}               from '../coordination/dispatcher-client.ts';
import { TOOL } from '../coordination/tool-coordinator.ts';

export interface ElementState {
  selector:  string;
  present:   boolean;
  visible:   boolean;
  count:     number;
}

export interface UIState {
  url:      string;
  title:    string;
  elements: ElementState[];
  consoleErrors: number;
  capturedAt: string;
}

// ── State reads ───────────────────────────────────────────────────────────────

export async function checkElementPresent(
  selector: string,
  ctx:      ToolExecutionContext,
): Promise<boolean> {
  const r = await executeTool(TOOL.IS_PRESENT, { selector }, ctx);
  if (!r.ok) return false;
  const data = r.data as Record<string, unknown>;
  return data?.present === true;
}

export async function checkElementVisible(
  selector: string,
  ctx:      ToolExecutionContext,
): Promise<boolean> {
  const r = await executeTool(TOOL.IS_VISIBLE, { selector }, ctx);
  if (!r.ok) return false;
  const data = r.data as Record<string, unknown>;
  return data?.visible === true;
}

export async function countElements(
  selector: string,
  ctx:      ToolExecutionContext,
): Promise<number> {
  const r = await executeTool(TOOL.COUNT, { selector }, ctx);
  if (!r.ok) return 0;
  const data = r.data as Record<string, unknown>;
  return typeof data?.count === 'number' ? data.count : 0;
}

export async function captureUIState(
  ctx: ToolExecutionContext,
): Promise<ToolExecutionResult<unknown>> {
  return executeTool(TOOL.CAPTURE_UI, {}, ctx);
}

export async function getConsoleErrors(
  ctx: ToolExecutionContext,
): Promise<ToolExecutionResult<unknown>> {
  return executeTool(TOOL.GET_ERRORS, {}, ctx);
}

// ── Composite state snapshot ──────────────────────────────────────────────────

export async function snapshotElementStates(
  selectors: string[],
  ctx:       ToolExecutionContext,
): Promise<ElementState[]> {
  const states: ElementState[] = [];
  for (const selector of selectors) {
    const present = await checkElementPresent(selector, ctx);
    const visible = present ? await checkElementVisible(selector, ctx) : false;
    const count   = present ? await countElements(selector, ctx) : 0;
    states.push({ selector, present, visible, count });
  }
  return states;
}
