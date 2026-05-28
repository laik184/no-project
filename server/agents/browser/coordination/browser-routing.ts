/**
 * server/agents/browser/coordination/browser-routing.ts
 *
 * Routes browser goals to the appropriate execution strategy.
 * Classifies incoming requests and selects the right execution path.
 */

import type { FlowStep } from '../types/navigation.types.ts';

export type BrowserGoalType =
  | 'navigate'
  | 'flow'
  | 'screenshot'
  | 'validate'
  | 'responsive'
  | 'health';

export interface BrowserGoal {
  type:        BrowserGoalType;
  url:         string;
  allowedHosts?: string[];
  flows?:      Array<{ name: string; steps: FlowStep[] }>;
  testResponsive?: boolean;
  captureScreenshot?: boolean;
  validateUI?: boolean;
  timeoutMs?:  number;
}

export interface RoutingDecision {
  strategy:         'simple' | 'flow' | 'responsive' | 'full';
  shouldNavigate:   boolean;
  shouldRunFlows:   boolean;
  shouldCapture:    boolean;
  shouldValidate:   boolean;
  shouldResponsive: boolean;
}

// ── Routing logic ─────────────────────────────────────────────────────────────

export function routeBrowserGoal(goal: BrowserGoal): RoutingDecision {
  const hasFlows      = (goal.flows?.length ?? 0) > 0;
  const hasResponsive = goal.testResponsive === true;

  if (goal.type === 'health') {
    return {
      strategy:         'simple',
      shouldNavigate:   false,
      shouldRunFlows:   false,
      shouldCapture:    false,
      shouldValidate:   false,
      shouldResponsive: false,
    };
  }

  if (goal.type === 'responsive' || hasResponsive) {
    return {
      strategy:         'responsive',
      shouldNavigate:   true,
      shouldRunFlows:   false,
      shouldCapture:    true,
      shouldValidate:   true,
      shouldResponsive: true,
    };
  }

  if (goal.type === 'flow' || hasFlows) {
    return {
      strategy:         'flow',
      shouldNavigate:   true,
      shouldRunFlows:   true,
      shouldCapture:    goal.captureScreenshot !== false,
      shouldValidate:   goal.validateUI !== false,
      shouldResponsive: false,
    };
  }

  if (goal.type === 'screenshot') {
    return {
      strategy:         'simple',
      shouldNavigate:   true,
      shouldRunFlows:   false,
      shouldCapture:    true,
      shouldValidate:   false,
      shouldResponsive: false,
    };
  }

  // Default: navigate + validate
  return {
    strategy:         'simple',
    shouldNavigate:   true,
    shouldRunFlows:   false,
    shouldCapture:    goal.captureScreenshot !== false,
    shouldValidate:   goal.validateUI !== false,
    shouldResponsive: false,
  };
}

export function classifyGoalType(input: {
  type?:           string;
  flows?:          unknown[];
  testResponsive?: boolean;
}): BrowserGoalType {
  if (input.type) return input.type as BrowserGoalType;
  if (input.testResponsive) return 'responsive';
  if (input.flows?.length)  return 'flow';
  return 'navigate';
}
