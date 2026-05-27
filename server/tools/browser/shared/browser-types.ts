/**
 * server/tools/browser/shared/browser-types.ts
 *
 * Browser tool-layer types. Re-exports agent types so the rest of
 * server/tools/browser/ imports from one place, not from agents/.
 */

export type {
  BrowserSession,
  BrowserSessionStatus,
  BrowserLaunchOptions,
  BrowserHealthStatus,
} from '../../../agents/browser/types/browser.types.ts';

export type {
  NavigationResult,
  PageLoadStatus,
  ViewportSize,
  FlowStep,
  FlowResult,
  FlowStepResult,
  ResponsiveTestResult,
} from '../../../agents/browser/types/navigation.types.ts';

export type {
  UIValidationResult,
  UICheck,
  ConsoleError,
  ConsoleErrorType,
  CrashReport,
  CrashType,
  VisualDiffResult,
  PerformanceValidation,
} from '../../../agents/browser/types/validation.types.ts';

export type {
  BrowserReport,
  ScreenshotMeta,
  ActionEntry,
  PerformanceSummary,
} from '../../../agents/browser/types/reporting.types.ts';

export type { LiveBrowserSession } from '../../../agents/browser/core/browser-session.ts';

// ── Tool-layer input / output shapes ──────────────────────────────────────────

export interface NavigateInput {
  url:           string;
  allowedHosts?: string[];
  timeoutMs?:    number;
}

export interface ClickInput {
  selector:  string;
  timeoutMs?: number;
}

export interface FillInput {
  selector:  string;
  value:     string;
  timeoutMs?: number;
}

export interface SelectInput {
  selector:  string;
  value:     string;
  timeoutMs?: number;
}

export interface WaitForElementInput {
  selector:  string;
  timeoutMs?: number;
}

export interface IsElementInput {
  selector: string;
}

export interface CountElementsInput {
  selector: string;
}

export interface ScreenshotInput {
  label:     string;
  fullPage?: boolean;
  timeoutMs?: number;
}

export interface ElementScreenshotInput {
  selector: string;
  label:    string;
}

export interface UserFlowInput {
  flowName: string;
  steps:    FlowStep[];
}

export interface ResponsiveTestInput {
  url:       string;
  viewports?: ViewportSize[];
}

export interface ViewportTestInput {
  url:      string;
  viewport: ViewportSize;
}

export interface CompareScreenshotsInput {
  label:        string;
  currentPath:  string;
  threshold?:   number;
}

export interface ValidatePerformanceInput {
  thresholdMs?: number;
}

export interface RunBrowserAgentInput {
  url:             string;
  allowedHosts?:   string[];
  flows?:          Array<{ name: string; steps: FlowStep[] }>;
  testResponsive?: boolean;
  timeoutMs?:      number;
}
