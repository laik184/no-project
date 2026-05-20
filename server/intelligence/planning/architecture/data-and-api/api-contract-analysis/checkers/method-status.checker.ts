import type { ApiContractIssue, ApiEndpoint, CodeFile, HttpMethod } from "../types.js";
import {
  RESTFUL_METHOD_RESOURCE_MAP,
  STANDARD_SUCCESS_CODES,
  STANDARD_ERROR_CODES,
} from "../types.js";
import { matchPattern } from "../utils/pattern.matcher.util.js";
import { buildConsistencyIssue } from "./consistency-issue-builder.util.js";

function findExpectedMethods(action: string): HttpMethod[] | null {
  const lowerAction = action.toLowerCase();
  for (const [method, actions] of Object.entries(RESTFUL_METHOD_RESOURCE_MAP)) {
    if ((actions as string[]).some((a) => lowerAction.includes(a))) {
      return [method as HttpMethod];
    }
  }
  return null;
}

export function detectHttpMethodMisalignment(
  endpoints: readonly ApiEndpoint[],
): readonly ApiContractIssue[] {
  const issues: ApiContractIssue[] = [];
  const crudActionRx = /\/(create|add|get|fetch|list|update|modify|delete|remove|destroy|save)\b/gi;

  for (const ep of endpoints) {
    const match = ep.route.match(crudActionRx);
    if (!match) continue;

    const action = match[0].replace("/", "").toLowerCase();
    const method = ep.method as HttpMethod;

    const expectedMethods = findExpectedMethods(action);
    if (!expectedMethods) continue;
    if (expectedMethods.includes(method)) continue;

    issues.push(
      buildConsistencyIssue(
        "MISSING_HTTP_METHOD_ALIGNMENT",
        "MEDIUM",
        ep.filePath,
        ep.line,
        `${ep.method} ${ep.route}`,
        "HTTP_METHOD_MISMATCH",
        `Action '${action}' in route suggests ${expectedMethods.join("/")} but HTTP method is ${method}.`,
        `Remove action verbs from REST routes. Use HTTP method semantics: ${expectedMethods.join("/")} for '${action}' operations.`,
        ep.rawSnippet,
      ),
    );
  }

  return Object.freeze(issues);
}

export function detectNonStandardStatusCodes(file: Readonly<CodeFile>): readonly ApiContractIssue[] {
  const issues: ApiContractIssue[] = [];
  const statusCodeRx = /(?:res\.status|statusCode|status)\s*\(\s*(\d{3})\s*\)/g;
  const hits = matchPattern(file.content, statusCodeRx);

  for (const hit of hits.slice(0, 10)) {
    const codeMatch = hit.matched.match(/(\d{3})/);
    if (!codeMatch) continue;
    const code = parseInt(codeMatch[1] ?? "0", 10);

    const isStandard = [...STANDARD_SUCCESS_CODES, ...STANDARD_ERROR_CODES].includes(code);
    if (isStandard) continue;
    if (code < 100 || code > 599) continue;

    issues.push(
      buildConsistencyIssue(
        "NON_STANDARD_STATUS_CODE",
        "MEDIUM",
        file.path,
        hit.line,
        null,
        "NON_STANDARD_STATUS_CODE",
        `HTTP status code ${code} is non-standard or uncommon — may confuse API clients.`,
        `Use standard HTTP status codes (2xx for success, 4xx for client errors, 5xx for server errors).`,
        hit.snippet,
      ),
    );
  }

  return Object.freeze(issues);
}

export function detectDuplicateRoutes(
  endpoints: readonly ApiEndpoint[],
): readonly ApiContractIssue[] {
  const issues: ApiContractIssue[] = [];
  const seen = new Map<string, ApiEndpoint>();

  for (const ep of endpoints) {
    const key = `${ep.method}:${ep.route}`;
    const existing = seen.get(key);
    if (existing) {
      issues.push(
        buildConsistencyIssue(
          "INCONSISTENT_NAMING_CONVENTION",
          "HIGH",
          ep.filePath,
          ep.line,
          `${ep.method} ${ep.route}`,
          "DUPLICATE_ROUTE",
          `Duplicate route '${ep.method} ${ep.route}' defined in multiple files — last definition wins, earlier will be unreachable.`,
          "Remove duplicate route definitions. Keep a single source of truth per route.",
          ep.rawSnippet,
        ),
      );
    } else {
      seen.set(key, ep);
    }
  }

  return Object.freeze(issues);
}
