import { transitionState } from "../state.js";
import type { AgentResult, InputPayload, Issue, SanitizerState, SanitizerOptions } from "../types.js";
import { buildError, buildLog } from "../utils/logger.util.js";
import { DEFAULT_MAX_URL_LENGTH, isSafeProtocol, isValidUrl, SAFE_PROTOCOLS } from "../utils/pattern.util.js";
import { PATTERNS, test } from "../utils/regex.util.js";
import { mapStringFields } from "../utils/sanitizer-map.util.js";

const SOURCE = "url-sanitizer";

const URL_FIELD_PATTERN = /^(url|href|src|link|redirect|callback|return_url|next|origin|referer)/i;

export interface UrlSanitizerInput {
  readonly payload: InputPayload;
  readonly options?: SanitizerOptions;
  readonly state: Readonly<SanitizerState>;
}

function sanitizeUrlValue(
  value: string,
  field: string,
  issues: Issue[],
  allowedProtocols: readonly string[],
): string {
  if (!URL_FIELD_PATTERN.test(field) && !isValidUrl(value)) {
    return value;
  }

  let result = value;

  if (test(PATTERNS.UNSAFE_PROTO, result)) {
    issues.push(Object.freeze({
      field,
      type: "UNSAFE_PROTOCOL",
      level: "BLOCKED",
      original: value,
      sanitized: "",
      description: `Unsafe URL protocol blocked: ${result.split(":")[0]}:`,
    }));
    return "";
  }

  if (result.length > DEFAULT_MAX_URL_LENGTH) {
    issues.push(Object.freeze({
      field,
      type: "INVALID_LENGTH",
      level: "WARNING",
      original: value,
      sanitized: result.slice(0, DEFAULT_MAX_URL_LENGTH),
      description: `URL truncated to ${DEFAULT_MAX_URL_LENGTH} characters`,
    }));
    result = result.slice(0, DEFAULT_MAX_URL_LENGTH);
  }

  if (isValidUrl(result) && !isSafeProtocol(result, allowedProtocols)) {
    issues.push(Object.freeze({
      field,
      type: "UNSAFE_URL",
      level: "BLOCKED",
      original: value,
      sanitized: "",
      description: `URL protocol not in allowed list: ${allowedProtocols.join(", ")}`,
    }));
    return "";
  }

  return result;
}

export function sanitizeUrls(input: UrlSanitizerInput): Readonly<AgentResult & { sanitized?: InputPayload }> {
  const { payload, options = {}, state } = input;
  const allowedProtocols = options.allowedProtocols ?? SAFE_PROTOCOLS;
  const issues: Issue[] = [];

  const sanitized = mapStringFields(payload, (value, field) =>
    sanitizeUrlValue(value, field, issues, allowedProtocols),
  );

  const blocked = issues.filter((i) => i.level === "BLOCKED").length;
  const log = buildLog(SOURCE, `URL sanitization complete: ${issues.length} issues, ${blocked} blocked`);
  const allIssues = Object.freeze([...state.issues, ...issues]);

  return {
    nextState: transitionState(state, {
      issues: allIssues,
      appendLog: log,
      ...(blocked > 0 ? { appendError: buildError(SOURCE, `${blocked} unsafe URLs blocked`) } : {}),
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
