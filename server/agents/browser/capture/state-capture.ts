/**
 * server/agents/browser/capture/state-capture.ts
 *
 * Coordinates runtime browser state capture.
 * Aggregates: UI state, console errors, performance, element states.
 * Pure coordination — all reads through dispatcher-client.
 */

import {
  captureUIState,
  getConsoleErrors,
  snapshotElementStates,
}                             from '../interaction/state-coordinator.ts';
import {
  dispatchBrowserTool,
  type ToolExecutionContext,
}                             from '../coordination/dispatcher-client.ts';
import { TOOL }               from '../coordination/tool-coordinator.ts';

export interface RuntimeStateSnapshot {
  runId:         string;
  url?:          string;
  uiState?:      unknown;
  consoleErrors: unknown[];
  performance?:  unknown;
  elementStates: Array<{ selector: string; present: boolean; visible: boolean; count: number }>;
  capturedAt:    string;
}

// ── State capture ─────────────────────────────────────────────────────────────

export async function captureRuntimeState(
  ctx:          ToolExecutionContext,
  opts: {
    selectors?:      string[];
    capturePerf?:    boolean;
    captureConsole?: boolean;
  } = {},
): Promise<RuntimeStateSnapshot> {
  const [uiResult, consoleResult, perfResult] = await Promise.all([
    captureUIState(ctx),
    opts.captureConsole !== false ? getConsoleErrors(ctx) : Promise.resolve(null),
    opts.capturePerf     ? dispatchBrowserTool(TOOL.PERF, {}, ctx) : Promise.resolve(null),
  ]);

  const elementStates = opts.selectors?.length
    ? await snapshotElementStates(opts.selectors, ctx)
    : [];

  const uiData      = (uiResult.ok  ? uiResult.data  : undefined) as Record<string, unknown> | undefined;
  const consoleData = consoleResult?.ok ? consoleResult.data : null;
  const consoleErrs = Array.isArray((consoleData as Record<string, unknown>)?.errors)
    ? (consoleData as Record<string, unknown>).errors as unknown[]
    : [];

  return {
    runId:         ctx.runId,
    url:           uiData?.url as string | undefined,
    uiState:       uiData,
    consoleErrors: consoleErrs,
    performance:   perfResult?.ok ? perfResult.data : undefined,
    elementStates,
    capturedAt:    new Date().toISOString(),
  };
}

// ── Modal / form state ────────────────────────────────────────────────────────

export async function captureFormState(
  formSelector: string,
  ctx:          ToolExecutionContext,
): Promise<{ present: boolean; visible: boolean; fields: unknown }> {
  const present  = await (await import('../interaction/state-coordinator.ts')).checkElementPresent(formSelector, ctx);
  const visible  = present
    ? await (await import('../interaction/state-coordinator.ts')).checkElementVisible(formSelector, ctx)
    : false;

  const uiResult = await captureUIState(ctx);
  const uiData   = (uiResult.ok ? uiResult.data : {}) as Record<string, unknown>;

  return {
    present,
    visible,
    fields: uiData?.forms ?? null,
  };
}
