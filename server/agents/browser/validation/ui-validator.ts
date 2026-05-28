/**
 * server/agents/browser/validation/ui-validator.ts
 *
 * Validates UI states through the tool layer.
 * Detects: missing elements, blank screens, hydration errors, console errors.
 * Coordination only — all execution via dispatcher-client.
 */

import {
  dispatchBrowserTool,
  type ToolExecutionContext,
}               from '../coordination/dispatcher-client.ts';
import { TOOL } from '../coordination/tool-coordinator.ts';
import type { UIValidationResult } from '../types/validation.types.ts';

export interface UIValidationReport {
  ok:              boolean;
  checks:          UICheckResult[];
  consoleErrors:   number;
  isBlankScreen:   boolean;
  hasHydrationErr: boolean;
  summary:         string;
  durationMs:      number;
}

export interface UICheckResult {
  check:  string;
  ok:     boolean;
  detail?: string;
}

// ── Validation coordinators ───────────────────────────────────────────────────

async function checkBlankScreen(ctx: ToolExecutionContext): Promise<UICheckResult> {
  const r = await dispatchBrowserTool(TOOL.DETECT_BLANK, {}, ctx);
  const data = (r.ok ? r.data : {}) as Record<string, unknown>;
  const isBlank = data?.blank === true;
  return { check: 'blank-screen', ok: !isBlank, detail: isBlank ? 'Blank screen detected' : undefined };
}

async function checkConsolErrors(ctx: ToolExecutionContext): Promise<{ count: number; result: UICheckResult }> {
  const r    = await dispatchBrowserTool(TOOL.GET_ERRORS, {}, ctx);
  const data = (r.ok ? r.data : {}) as Record<string, unknown>;
  const errors = Array.isArray(data?.errors) ? data.errors.length : 0;
  return {
    count:  errors,
    result: { check: 'console-errors', ok: errors === 0, detail: errors > 0 ? `${errors} console error(s)` : undefined },
  };
}

async function checkHydrationErrors(ctx: ToolExecutionContext): Promise<UICheckResult> {
  const r    = await dispatchBrowserTool(TOOL.DETECT_BLANK, {}, ctx);
  const data = (r.ok ? r.data : {}) as Record<string, unknown>;
  const hasErr = data?.hydrationErrors === true;
  return { check: 'hydration', ok: !hasErr, detail: hasErr ? 'Hydration errors detected' : undefined };
}

async function runUIValidation(ctx: ToolExecutionContext): Promise<{ ok: boolean; detail?: string }> {
  const r    = await dispatchBrowserTool(TOOL.VALIDATE_UI, {}, ctx);
  const data = (r.ok ? r.data : {}) as UIValidationResult | undefined;
  return { ok: data?.ok ?? r.ok, detail: data?.summary };
}

// ── Composite validator ───────────────────────────────────────────────────────

export async function validateUI(ctx: ToolExecutionContext): Promise<UIValidationReport> {
  const start  = Date.now();
  const checks: UICheckResult[] = [];

  const [blankResult, hydrationResult, consoleData, validationResult] = await Promise.all([
    checkBlankScreen(ctx),
    checkHydrationErrors(ctx),
    checkConsolErrors(ctx),
    runUIValidation(ctx),
  ]);

  checks.push(blankResult, hydrationResult, consoleData.result);
  checks.push({ check: 'ui-validation', ok: validationResult.ok, detail: validationResult.detail });

  const allOk         = checks.every(c => c.ok);
  const failedChecks  = checks.filter(c => !c.ok).map(c => c.detail ?? c.check);

  return {
    ok:              allOk,
    checks,
    consoleErrors:   consoleData.count,
    isBlankScreen:   !blankResult.ok,
    hasHydrationErr: !hydrationResult.ok,
    summary:         allOk ? 'All UI checks passed' : `Failed: ${failedChecks.join(', ')}`,
    durationMs:      Date.now() - start,
  };
}
