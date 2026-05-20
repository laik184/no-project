/**
 * verification-types.ts
 *
 * Shared type contracts for the browser verification engine.
 * Used by all sub-modules — zero circular dependency risk.
 */

export type VerificationDepth = "smoke" | "standard" | "deep";

export interface ConsoleError {
  level:   "error" | "warning";
  message: string;
  source?: string;
}

export interface DomReport {
  title:         string;
  bodyText:      string;
  isBlank:       boolean;
  hasReactError: boolean;
  hasWhiteScreen:boolean;
  headingCount:  number;
  buttonCount:   number;
  inputCount:    number;
  linkCount:     number;
  imageCount:    number;
  errorMessages: string[];
}

export interface NetworkReport {
  statusCode:    number;
  responseTimeMs:number;
  contentType:   string;
  contentLength: number;
  serverError:   boolean;
}

export interface InteractionResult {
  target:  string;
  action:  "click" | "fill" | "submit";
  success: boolean;
  error?:  string;
}

export interface AccessibilityReport {
  missingAltText:    number;
  missingLabels:     number;
  lowContrastCount:  number;
  score:             number;   // 0–100
}

export interface BrowserVerificationResult {
  passed:        boolean;
  score:         number;        // 0–100
  depth:         VerificationDepth;
  network:       NetworkReport;
  dom:           DomReport;
  consoleErrors: ConsoleError[];
  interactions:  InteractionResult[];
  accessibility: AccessibilityReport;
  issues:        string[];
  suggestions:   string[];
  elapsedMs:     number;
  ts:            number;
}

export interface VerificationTarget {
  url:         string;
  projectId:   number;
  depth?:      VerificationDepth;
  expectedTitle?: string;
  interactions?:  Array<{ selector: string; action: "click" | "fill"; value?: string }>;
}
