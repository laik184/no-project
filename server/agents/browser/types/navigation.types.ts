/**
 * navigation.types.ts
 * URL navigation, page load, and user flow type definitions.
 */

export type PageLoadStatus =
  | 'loaded'
  | 'blank'
  | 'error'
  | 'timeout'
  | 'crashed'
  | 'blocked';

export interface NavigationResult {
  ok:          boolean;
  url:         string;
  status:      PageLoadStatus;
  httpStatus?: number;
  durationMs:  number;
  title?:      string;
  error?:      string;
}

export interface ViewportSize {
  width:  number;
  height: number;
  label:  'mobile' | 'tablet' | 'desktop';
}

export type FlowAction =
  | 'navigate'
  | 'click'
  | 'fill'
  | 'select'
  | 'wait'
  | 'assert'
  | 'screenshot';

export interface FlowStep {
  label:       string;
  action:      FlowAction;
  selector?:   string;
  value?:      string;
  url?:        string;
  timeoutMs?:  number;
  optional?:   boolean;
}

export interface FlowStepResult {
  label:      string;
  action:     FlowAction;
  success:    boolean;
  durationMs: number;
  error?:     string;
}

export interface FlowResult {
  ok:             boolean;
  flowName:       string;
  stepsTotal:     number;
  stepsCompleted: number;
  steps:          FlowStepResult[];
  failedStep?:    string;
  durationMs:     number;
  error?:         string;
}

export interface ResponsiveTestResult {
  viewport:   ViewportSize;
  ok:         boolean;
  durationMs: number;
  error?:     string;
}
