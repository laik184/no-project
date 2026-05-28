/**
 * server/agents/browser/coordination/tool-coordinator.ts
 *
 * Maps browser tasks to registered tool names and invokes them
 * exclusively through dispatcher-client.ts.
 * Knows WHAT tool to call and with WHAT input — never executes directly.
 */

import {
  executeTool,
  buildToolContext,
  type ToolExecutionContext,
  type ToolExecutionResult,
}                          from './dispatcher-client.ts';
import type { FlowStep }   from '../types/navigation.types.ts';

// ── Tool name constants ───────────────────────────────────────────────────────

export const TOOL = {
  HEALTH:        'browser_health',
  NAVIGATE:      'browser_navigate',
  RELOAD:        'browser_reload',
  WAIT_LOAD:     'browser_wait_for_load',
  RUN_FLOW:      'browser_run_flow',
  TEST_VIEWPORT: 'browser_test_viewport',
  RESPONSIVE:    'browser_responsive_tests',
  CLICK:         'browser_click',
  FILL:          'browser_fill',
  SELECT:        'browser_select',
  WAIT_ELEMENT:  'browser_wait_for_element',
  WAIT_VISIBLE:  'browser_wait_for_visible',
  IS_PRESENT:    'browser_is_element_present',
  IS_VISIBLE:    'browser_is_element_visible',
  COUNT:         'browser_count_elements',
  CAPTURE_UI:    'browser_capture_ui_state',
  VALIDATE_UI:   'browser_validate_ui',
  SCREENSHOT:    'browser_screenshot',
  ELEM_SS:       'browser_element_screenshot',
  PERF:          'browser_collect_performance',
  VALIDATE_PERF: 'browser_validate_performance',
  CONSOLE_CATCH: 'browser_console_catcher',
  GET_ERRORS:    'browser_get_console_errors',
  DETECT_CRASH:  'browser_detect_crash',
  DETECT_BLANK:  'browser_detect_blank_screen',
} as const;

// ── Coordination methods ──────────────────────────────────────────────────────

export async function coordinateNavigate(
  url:       string,
  ctx:       ToolExecutionContext,
  opts:      { allowedHosts?: string[]; timeoutMs?: number } = {},
): Promise<ToolExecutionResult<unknown>> {
  return executeTool(TOOL.NAVIGATE, { url, ...opts }, ctx);
}

export async function coordinateScreenshot(
  label:   string,
  ctx:     ToolExecutionContext,
  opts:    { fullPage?: boolean; timeoutMs?: number } = {},
): Promise<ToolExecutionResult<unknown>> {
  return executeTool(TOOL.SCREENSHOT, { label, ...opts }, ctx);
}

export async function coordinateValidateUI(
  ctx: ToolExecutionContext,
): Promise<ToolExecutionResult<unknown>> {
  return executeTool(TOOL.VALIDATE_UI, {}, ctx);
}

export async function coordinateFlowStep(
  step: FlowStep,
  ctx:  ToolExecutionContext,
): Promise<ToolExecutionResult<unknown>> {
  const { action, selector, value, url, label, timeoutMs } = step;
  const input: Record<string, unknown> = { selector, value, url, label, timeoutMs };
  const toolMap: Record<string, string> = {
    navigate: TOOL.NAVIGATE,
    click:    TOOL.CLICK,
    fill:     TOOL.FILL,
    select:   TOOL.SELECT,
    wait:     TOOL.WAIT_ELEMENT,
    screenshot: TOOL.SCREENSHOT,
  };
  const tool = toolMap[action.toLowerCase()] ?? TOOL.CAPTURE_UI;
  return executeTool(tool, input, ctx);
}

export async function coordinateHealth(
  runId:     string,
  projectId: string,
): Promise<ToolExecutionResult<unknown>> {
  const ctx = buildToolContext(runId, projectId);
  return executeTool(TOOL.HEALTH, {}, ctx);
}
