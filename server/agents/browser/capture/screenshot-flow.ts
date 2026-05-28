/**
 * server/agents/browser/capture/screenshot-flow.ts
 *
 * Coordinates screenshot orchestration and capture flow lifecycle.
 * Sequences: pre-capture setup → dispatch → post-capture record.
 * All execution via dispatcher-client — no direct Playwright access.
 */

import {
  executeTool,
  type ToolExecutionContext,
}                          from '../coordination/dispatcher-client.ts';
import { TOOL }            from '../coordination/tool-coordinator.ts';
import { browserBus }      from '../events/browser-events.ts';
import { logStep }         from '../telemetry/browser-logger.ts';
import { sanitizeLabel }   from '../utils/browser-utils.ts';
import type { ScreenshotMeta } from '../types/reporting.types.ts';

export interface CaptureRequest {
  label:     string;
  fullPage?: boolean;
  timeoutMs?: number;
}

export interface CaptureResult {
  ok:        boolean;
  meta?:     ScreenshotMeta;
  durationMs: number;
  error?:    string;
}

export interface SequenceResult {
  ok:        boolean;
  captures:  CaptureResult[];
  durationMs: number;
}

// ── Single capture ────────────────────────────────────────────────────────────

export async function captureScreenshot(
  request: CaptureRequest,
  ctx:     ToolExecutionContext,
): Promise<CaptureResult> {
  const start = Date.now();
  const label = sanitizeLabel(request.label);

  const r = await executeTool(TOOL.SCREENSHOT, {
    label,
    fullPage:  request.fullPage  ?? true,
    timeoutMs: request.timeoutMs ?? 10_000,
  }, ctx);

  const durationMs = Date.now() - start;
  logStep(ctx.runId, TOOL.SCREENSHOT, r.ok, durationMs, r.ok ? undefined : r.error);

  if (!r.ok) {
    return { ok: false, durationMs, error: r.error };
  }

  const meta = r.data as ScreenshotMeta;
  browserBus.emit('screenshot.captured', {
    sessionId:       ctx.meta['sessionId'] as string ?? 'unknown',
    runId:           ctx.runId,
    label,
    screenshotPath:  meta?.path,
    ts:              new Date().toISOString(),
  });

  return { ok: true, meta, durationMs };
}

// ── Capture sequence ──────────────────────────────────────────────────────────

export async function captureSequence(
  requests: CaptureRequest[],
  ctx:      ToolExecutionContext,
): Promise<SequenceResult> {
  const start    = Date.now();
  const captures: CaptureResult[] = [];

  for (const req of requests) {
    const result = await captureScreenshot(req, ctx);
    captures.push(result);
    if (!result.ok) break; // Stop sequence on failure
  }

  return {
    ok:         captures.every(c => c.ok),
    captures,
    durationMs: Date.now() - start,
  };
}

// ── Element capture ───────────────────────────────────────────────────────────

export async function captureElement(
  selector: string,
  label:    string,
  ctx:      ToolExecutionContext,
): Promise<CaptureResult> {
  const start = Date.now();
  const r = await executeTool(TOOL.ELEM_SS, { selector, label }, ctx);
  const durationMs = Date.now() - start;
  if (!r.ok) return { ok: false, durationMs, error: r.error };
  return { ok: true, meta: r.data as ScreenshotMeta, durationMs };
}
