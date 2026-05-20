import { transitionState } from "../state.js";
import type { AgentResult, InputPayload, Issue, SanitizerState, SanitizerOptions } from "../types.js";
import { buildError, buildLog } from "../utils/logger.util.js";
import { PATTERNS, replace, test } from "../utils/regex.util.js";
import { mapStringFields } from "../utils/sanitizer-map.util.js";

const SOURCE = "html-sanitizer";

export interface HtmlSanitizerInput {
  readonly payload: InputPayload;
  readonly options?: SanitizerOptions;
  readonly state: Readonly<SanitizerState>;
}

function stripDangerousHtml(value: string, field: string, issues: Issue[]): string {
  let result = value;

  if (test(PATTERNS.SCRIPT_TAG, result)) {
    result = replace(PATTERNS.SCRIPT_TAG, result, "");
    issues.push(Object.freeze({
      field, type: "XSS", level: "BLOCKED",
      original: value, sanitized: result,
      description: "script tag block removed",
    }));
  }

  if (test(PATTERNS.OPEN_SCRIPT_TAG, result)) {
    result = replace(PATTERNS.OPEN_SCRIPT_TAG, result, "");
    if (!issues.some((i) => i.field === field && i.type === "XSS")) {
      issues.push(Object.freeze({
        field, type: "XSS", level: "BLOCKED",
        original: value, sanitized: result,
        description: "Open script tag removed",
      }));
    }
  }

  if (test(PATTERNS.CLOSE_SCRIPT_TAG, result)) {
    result = replace(PATTERNS.CLOSE_SCRIPT_TAG, result, "");
  }

  if (test(PATTERNS.ON_EVENT_ATTR, result)) {
    result = replace(PATTERNS.ON_EVENT_ATTR, result, "");
    issues.push(Object.freeze({
      field, type: "XSS", level: "BLOCKED",
      original: value, sanitized: result,
      description: "Inline event handler (on*) removed",
    }));
  }

  if (test(PATTERNS.ON_EVENT_UNQUOTED, result)) {
    result = replace(PATTERNS.ON_EVENT_UNQUOTED, result, "");
  }

  if (test(PATTERNS.JAVASCRIPT_PROTO, result)) {
    result = replace(PATTERNS.JAVASCRIPT_PROTO, result, "blocked:");
    issues.push(Object.freeze({
      field, type: "UNSAFE_PROTOCOL", level: "BLOCKED",
      original: value, sanitized: result,
      description: "javascript: protocol blocked",
    }));
  }

  if (test(PATTERNS.VBSCRIPT_PROTO, result)) {
    result = replace(PATTERNS.VBSCRIPT_PROTO, result, "blocked:");
    issues.push(Object.freeze({
      field, type: "UNSAFE_PROTOCOL", level: "BLOCKED",
      original: value, sanitized: result,
      description: "vbscript: protocol blocked",
    }));
  }

  if (test(PATTERNS.DANGEROUS_TAGS, result)) {
    result = replace(PATTERNS.DANGEROUS_TAGS, result, "");
    result = replace(PATTERNS.CLOSE_DANGEROUS_TAGS, result, "");
    issues.push(Object.freeze({
      field, type: "XSS", level: "BLOCKED",
      original: value, sanitized: result,
      description: "Dangerous HTML tags (iframe/object/embed/etc.) removed",
    }));
  }

  return result;
}

export function sanitizeHtml(input: HtmlSanitizerInput): Readonly<AgentResult & { sanitized?: InputPayload }> {
  const { payload, state } = input;
  const issues: Issue[] = [];

  const sanitized = mapStringFields(payload, (value, field) =>
    stripDangerousHtml(value, field, issues),
  );

  const blocked = issues.filter((i) => i.level === "BLOCKED").length;
  const log = buildLog(SOURCE, `HTML sanitized: ${issues.length} issues, ${blocked} blocked`);
  const allIssues = Object.freeze([...state.issues, ...issues]);

  return {
    nextState: transitionState(state, {
      issues: allIssues,
      appendLog: log,
      ...(blocked > 0 ? { appendError: buildError(SOURCE, `${blocked} XSS payloads blocked`) } : {}),
    }),
    output: Object.freeze({
      success: true,
      sanitized,
      issues: allIssues,
      logs: Object.freeze([log]),
    }),
    sanitized,
  };
}
