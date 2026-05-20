import { transitionState } from "../state.js";
import type { AgentResult, InputPayload, Issue, SanitizerState, SanitizerOptions } from "../types.js";
import { stripControlChars, stripNullBytes } from "../utils/escape.util.js";
import { buildLog } from "../utils/logger.util.js";
import { DEFAULT_MAX_STRING_LENGTH, truncate, exceedsMaxLength } from "../utils/pattern.util.js";
import { PATTERNS, replace } from "../utils/regex.util.js";
import { mapStringFields } from "../utils/sanitizer-map.util.js";

const SOURCE = "payload-normalizer";

export interface NormalizerInput {
  readonly payload: InputPayload;
  readonly options?: SanitizerOptions;
  readonly state: Readonly<SanitizerState>;
}

export function normalizePayload(input: NormalizerInput): Readonly<AgentResult & { normalized?: InputPayload }> {
  const { payload, options = {}, state } = input;
  const issues: Issue[] = [];
  const maxLen = options.maxStringLength ?? DEFAULT_MAX_STRING_LENGTH;

  const normalized = mapStringFields(payload, (value, field) => {
    let result = value;

    result = stripNullBytes(result);
    if (result !== value) {
      issues.push(Object.freeze({
        field,
        type: "NULL_BYTE",
        level: "ERROR",
        original: value,
        sanitized: result,
        description: "Null bytes removed",
      }));
    }

    result = stripControlChars(result);
    if (result !== value && !issues.some((i) => i.field === field && i.type === "CONTROL_CHARS")) {
      issues.push(Object.freeze({
        field,
        type: "CONTROL_CHARS",
        level: "WARNING",
        original: value,
        sanitized: result,
        description: "Control characters removed",
      }));
    }

    result = result.trim();

    if (options.normalizeWhitespace !== false) {
      result = replace(PATTERNS.WHITESPACE_COLLAPSE, result, " ");
    }

    if (exceedsMaxLength(result, maxLen)) {
      issues.push(Object.freeze({
        field,
        type: "INVALID_LENGTH",
        level: "WARNING",
        original: result,
        sanitized: truncate(result, maxLen),
        description: `Value truncated to ${maxLen} characters`,
      }));
      result = truncate(result, maxLen);
    }

    return result;
  });

  const log = buildLog(SOURCE, `Payload normalized: ${Object.keys(payload).length} fields, ${issues.length} issues`);
  const allIssues = Object.freeze([...state.issues, ...issues]);

  return {
    nextState: transitionState(state, {
      status: "RUNNING",
      lastInput: payload,
      issues: allIssues,
      appendLog: log,
    }),
    output: Object.freeze({
      success: true,
      sanitized: normalized,
      issues: allIssues,
      logs: Object.freeze([log]),
    }),
    normalized,
  };
}
