import { transitionState } from "../state.js";
import type { AgentResult, InputPayload, Issue, SanitizerState, ValidationResult } from "../types.js";
import { buildError, buildLog } from "../utils/logger.util.js";
import { DEFAULT_MAX_STRING_LENGTH, exceedsMaxLength } from "../utils/pattern.util.js";
import { PATTERNS, test } from "../utils/regex.util.js";

const SOURCE = "validation-agent";

export interface ValidationInput {
  readonly payload: InputPayload;
  readonly state: Readonly<SanitizerState>;
}

function validateField(key: string, value: unknown): ValidationResult {
  const fieldIssues: Issue[] = [];

  if (typeof value === "string") {
    if (exceedsMaxLength(value, DEFAULT_MAX_STRING_LENGTH)) {
      fieldIssues.push(Object.freeze({
        field: key,
        type: "INVALID_LENGTH",
        level: "WARNING",
        original: value,
        sanitized: value.slice(0, DEFAULT_MAX_STRING_LENGTH),
        description: `Field exceeds max length of ${DEFAULT_MAX_STRING_LENGTH}`,
      }));
    }

    if (test(PATTERNS.SCRIPT_TAG, value) || test(PATTERNS.OPEN_SCRIPT_TAG, value)) {
      fieldIssues.push(Object.freeze({
        field: key,
        type: "XSS",
        level: "ERROR",
        original: value,
        sanitized: "",
        description: "Script tag remnant detected after sanitization",
      }));
    }

    if (test(PATTERNS.JAVASCRIPT_PROTO, value)) {
      fieldIssues.push(Object.freeze({
        field: key,
        type: "UNSAFE_PROTOCOL",
        level: "ERROR",
        original: value,
        sanitized: "",
        description: "javascript: protocol remnant detected",
      }));
    }

    if (test(PATTERNS.NULL_BYTE, value)) {
      fieldIssues.push(Object.freeze({
        field: key,
        type: "NULL_BYTE",
        level: "ERROR",
        original: value,
        sanitized: "",
        description: "Null byte remnant detected after sanitization",
      }));
    }
  }

  return Object.freeze({
    valid: fieldIssues.length === 0,
    field: key,
    issues: Object.freeze([...fieldIssues]),
  });
}

export function validatePayload(input: ValidationInput): Readonly<AgentResult & { valid?: boolean }> {
  const { payload, state } = input;
  const allNewIssues: Issue[] = [];
  let allValid = true;

  for (const [key, value] of Object.entries(payload)) {
    const result = validateField(key, value);
    if (!result.valid) {
      allValid = false;
      allNewIssues.push(...result.issues);
    }

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      const nested = validatePayload({ payload: value as InputPayload, state });
      if (!nested.output.success) allValid = false;
      allNewIssues.push(...nested.output.issues);
    }
  }

  const allIssues = Object.freeze([...state.issues, ...allNewIssues]);
  const status = allValid ? "SUCCESS" : "FAILED";
  const log = buildLog(SOURCE, `Validation complete: valid=${allValid} issues=${allNewIssues.length}`);

  return {
    nextState: transitionState(state, {
      status,
      issues: allIssues,
      appendLog: log,
      ...(allNewIssues.length > 0 ? { appendError: buildError(SOURCE, `${allNewIssues.length} validation issues found`) } : {}),
    }),
    output: Object.freeze({
      success: allValid,
      sanitized: payload,
      issues: allIssues,
      logs: Object.freeze([log]),
      ...(!allValid ? { error: "validation_failed" } : {}),
    }),
    valid: allValid,
  };
}
