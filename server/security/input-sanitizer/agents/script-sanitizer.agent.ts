import { transitionState } from "../state.js";
import type { AgentResult, InputPayload, Issue, SanitizerState } from "../types.js";
import { buildError, buildLog } from "../utils/logger.util.js";
import { PATTERNS, replace, test } from "../utils/regex.util.js";
import { mapStringFields } from "../utils/sanitizer-map.util.js";

const SOURCE = "script-sanitizer";

const TEMPLATE_LITERAL = /`[^`]*`/g;
const EVAL_CALLS = /\beval\s*\(/gi;
const FUNCTION_CONSTRUCTOR = /new\s+Function\s*\(/gi;
const SETTIMEOUT_SETINTERVAL = /\b(setTimeout|setInterval)\s*\(\s*["'`]/gi;
const DOCUMENT_WRITE = /\bdocument\s*\.\s*write\s*\(/gi;
const INNER_HTML_ASSIGN = /\.(innerHTML|outerHTML)\s*=/gi;
const IMPORT_DYNAMIC = /\bimport\s*\(/gi;
const REQUIRE_CALL = /\brequire\s*\(\s*["'`]/gi;

export interface ScriptSanitizerInput {
  readonly payload: InputPayload;
  readonly state: Readonly<SanitizerState>;
}

function stripScriptPayloads(value: string, field: string, issues: Issue[]): string {
  let result = value;

  const checks: Array<{ pattern: RegExp; description: string }> = [
    { pattern: EVAL_CALLS, description: "eval() call removed" },
    { pattern: FUNCTION_CONSTRUCTOR, description: "new Function() constructor removed" },
    { pattern: SETTIMEOUT_SETINTERVAL, description: "setTimeout/setInterval with string removed" },
    { pattern: DOCUMENT_WRITE, description: "document.write() removed" },
    { pattern: INNER_HTML_ASSIGN, description: "innerHTML/outerHTML assignment removed" },
    { pattern: IMPORT_DYNAMIC, description: "Dynamic import() removed" },
    { pattern: REQUIRE_CALL, description: "require() call removed" },
    { pattern: TEMPLATE_LITERAL, description: "Template literal removed" },
    { pattern: PATTERNS.DATA_PROTO_SCRIPT, description: "data:text/html URI removed" },
  ];

  for (const { pattern, description } of checks) {
    pattern.lastIndex = 0;
    if (pattern.test(result)) {
      pattern.lastIndex = 0;
      const before = result;
      result = result.replace(pattern, "");
      if (result !== before) {
        issues.push(Object.freeze({
          field,
          type: "SCRIPT_INJECTION",
          level: "BLOCKED",
          original: value,
          sanitized: result,
          description,
        }));
      }
    }
  }

  return result;
}

export function sanitizeScripts(input: ScriptSanitizerInput): Readonly<AgentResult & { sanitized?: InputPayload }> {
  const { payload, state } = input;
  const issues: Issue[] = [];

  const sanitized = mapStringFields(payload, (value, field) =>
    stripScriptPayloads(value, field, issues),
  );

  const blocked = issues.length;
  const log = buildLog(SOURCE, `Script injection check: ${blocked} patterns blocked`);
  const allIssues = Object.freeze([...state.issues, ...issues]);

  return {
    nextState: transitionState(state, {
      issues: allIssues,
      appendLog: log,
      ...(blocked > 0 ? { appendError: buildError(SOURCE, `${blocked} script injection patterns removed`) } : {}),
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
