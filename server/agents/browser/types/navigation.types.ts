/**
 * server/agents/browser/types/navigation.types.ts
 * Navigation, viewport, and flow execution types.
 */

export type PageLoadStatus = 'loaded' | 'timeout' | 'failed' | 'blocked';

export interface ViewportSize {
  width:  number;
  height: number;
  label?: string;
}

export interface NavigationResult {
  url:         string;
  status:      PageLoadStatus;
  httpStatus?: number;
  durationMs:  number;
  error?:      string;
}

export interface FlowStep {
  action:    string;
  selector?: string;
  value?:    string;
  url?:      string;
  label?:    string;
  timeoutMs?: number;
}

export interface FlowStepResult {
  step:      FlowStep;
  ok:        boolean;
  durationMs: number;
  error?:    string;
}

export interface FlowResult {
  flowName:   string;
  ok:         boolean;
  steps:      FlowStepResult[];
  durationMs: number;
  error?:     string;
}

export interface ResponsiveTestResult {
  viewport:   ViewportSize;
  url:        string;
  ok:         boolean;
  screenshot?: string;
  error?:     string;
  durationMs: number;
}
