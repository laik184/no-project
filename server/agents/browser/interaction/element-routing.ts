/**
 * server/agents/browser/interaction/element-routing.ts
 *
 * Routes element interaction operations to the correct coordinator.
 * Classifies element actions and delegates — pure routing logic.
 */

import {
  coordinateClick,
  coordinateFill,
  coordinateSelect,
  coordinateWaitForElement,
  coordinateWaitForVisible,
  type InteractionResult,
}                       from './interaction-coordinator.ts';
import type { FlowStep } from '../types/navigation.types.ts';
import type { ToolExecutionContext } from '../coordination/dispatcher-client.ts';

export type ElementAction =
  | 'click'
  | 'fill'
  | 'select'
  | 'wait'
  | 'wait-visible';

export interface ElementRoute {
  action:   ElementAction;
  selector: string;
  value?:   string;
  timeoutMs?: number;
}

// ── Route classifier ──────────────────────────────────────────────────────────

export function classifyElementAction(raw: string): ElementAction {
  const normalized = raw.toLowerCase().trim();
  if (normalized === 'click')        return 'click';
  if (normalized === 'fill')         return 'fill';
  if (normalized === 'type')         return 'fill';
  if (normalized === 'input')        return 'fill';
  if (normalized === 'select')       return 'select';
  if (normalized === 'wait')         return 'wait';
  if (normalized === 'wait-visible') return 'wait-visible';
  return 'click'; // default
}

export function routeFromStep(step: FlowStep): ElementRoute | null {
  if (!step.selector) return null;
  return {
    action:    classifyElementAction(step.action),
    selector:  step.selector,
    value:     step.value,
    timeoutMs: step.timeoutMs,
  };
}

// ── Router ────────────────────────────────────────────────────────────────────

export async function routeElementInteraction(
  route: ElementRoute,
  ctx:   ToolExecutionContext,
): Promise<InteractionResult> {
  switch (route.action) {
    case 'click':
      return coordinateClick({ selector: route.selector, timeoutMs: route.timeoutMs }, ctx);

    case 'fill':
      return coordinateFill(
        { selector: route.selector, value: route.value ?? '', timeoutMs: route.timeoutMs },
        ctx,
      );

    case 'select':
      return coordinateSelect(
        { selector: route.selector, value: route.value ?? '', timeoutMs: route.timeoutMs },
        ctx,
      );

    case 'wait':
      return coordinateWaitForElement(route.selector, ctx, route.timeoutMs);

    case 'wait-visible':
      return coordinateWaitForVisible(route.selector, ctx, route.timeoutMs);

    default:
      return { ok: false, tool: 'unknown', durationMs: 0, error: `Unknown action: ${route.action}` };
  }
}

export async function routeFromFlowStep(
  step: FlowStep,
  ctx:  ToolExecutionContext,
): Promise<InteractionResult | null> {
  const route = routeFromStep(step);
  if (!route) return null;
  return routeElementInteraction(route, ctx);
}
