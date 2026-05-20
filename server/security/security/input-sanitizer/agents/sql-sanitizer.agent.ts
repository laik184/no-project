import { transitionState } from "../state.js";
import type { AgentResult, InputPayload, Issue, SanitizerState } from "../types.js";
import { escapeSql } from "../utils/escape.util.js";
import { buildError, buildLog } from "../utils/logger.util.js";
import { PATTERNS, test } from "../utils/regex.util.js";
import { mapStringFields } from "../utils/sanitizer-map.util.js";

const SOURCE = "sql-sanitizer";

const STACKED_QUERIES = /;\s*(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b/gi;
const SLEEP_BENCHMARK = /\b(SLEEP|BENCHMARK|WAITFOR\s+DELAY)\s*\(/gi;
const HEX_ENCODING = /0x[0-9a-fA-F]+/g;
const CHAR_FUNCTION = /\bCHAR\s*\(\s*\d+/gi;

export interface SqlSanitizerInput {
  readonly payload: InputPayload;
  readonly state: Readonly<SanitizerState>;
}

function sanitizeSqlValue(value: string, field: string, issues: Issue[]): string {
  let result = value;
  let flagged = false;

  const threats: Array<{ pattern: RegExp; description: string }> = [
    { pattern: PATTERNS.SQL_TAUTOLOGY, description: "SQL tautology (OR 1=1) detected" },
    { pattern: STACKED_QUERIES, description: "Stacked query injection detected" },
    { pattern: SLEEP_BENCHMARK, description: "Time-based blind injection detected" },
    { pattern: HEX_ENCODING, description: "Hex encoding in SQL context detected" },
    { pattern: CHAR_FUNCTION, description: "CHAR() function injection detected" },
    { pattern: PATTERNS.SQL_COMMENT, description: "SQL comment sequence detected" },
    { pattern: PATTERNS.SQL_KEYWORDS, description: "SQL keyword in user input detected" },
  ];

  for (const { pattern, description } of threats) {
    pattern.lastIndex = 0;
    if (pattern.test(result)) {
      flagged = true;
      issues.push(Object.freeze({
        field,
        type: "SQL_INJECTION",
        level: "BLOCKED",
        original: value,
        sanitized: "",
        description,
      }));
    }
  }

  result = escapeSql(result);

  if (flagged) {
    const lastIssue = issues[issues.length - 1];
    if (lastIssue && lastIssue.field === field) {
      (issues as Issue[]).splice(issues.length - 1, 1, Object.freeze({
        ...lastIssue,
        sanitized: result,
      }));
    }
  }

  return result;
}

export function sanitizeSql(input: SqlSanitizerInput): Readonly<AgentResult & { sanitized?: InputPayload }> {
  const { payload, state } = input;
  const issues: Issue[] = [];

  const sanitized = mapStringFields(payload, (value, field) =>
    sanitizeSqlValue(value, field, issues),
  );

  const blocked = issues.filter((i) => i.type === "SQL_INJECTION").length;
  const log = buildLog(SOURCE, `SQL sanitization complete: ${issues.length} issues, ${blocked} blocked`);
  const allIssues = Object.freeze([...state.issues, ...issues]);

  return {
    nextState: transitionState(state, {
      issues: allIssues,
      appendLog: log,
      ...(blocked > 0 ? { appendError: buildError(SOURCE, `${blocked} SQL injection patterns detected`) } : {}),
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
