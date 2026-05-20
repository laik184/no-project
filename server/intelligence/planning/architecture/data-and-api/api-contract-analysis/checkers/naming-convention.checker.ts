import type { ApiContractIssue, ApiEndpoint } from "../types.js";
import { SNAKE_CASE_RX, KEBAB_CASE_RX } from "../types.js";
import { extractResourceName } from "../utils/endpoint.parser.util.js";
import { buildConsistencyIssue, CAMEL_CASE_RX } from "./consistency-issue-builder.util.js";

export function detectNamingConventionViolations(
  endpoints: readonly ApiEndpoint[],
): readonly ApiContractIssue[] {
  const issues: ApiContractIssue[] = [];
  const caseCounters = { snake: 0, kebab: 0, camel: 0, other: 0 };

  for (const ep of endpoints) {
    const segments = ep.route
      .replace(/\/v\d+/, "")
      .split("/")
      .filter((s) => s && !s.startsWith(":") && !s.startsWith("{"));

    for (const seg of segments) {
      if (SNAKE_CASE_RX.test(seg)) caseCounters.snake++;
      else if (KEBAB_CASE_RX.test(seg)) caseCounters.kebab++;
      else if (CAMEL_CASE_RX.test(seg)) caseCounters.camel++;
      else caseCounters.other++;
    }
  }

  const dominant = Object.entries(caseCounters).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "kebab";

  for (const ep of endpoints) {
    const segments = ep.route
      .replace(/\/v\d+/, "")
      .split("/")
      .filter((s) => s && !s.startsWith(":") && !s.startsWith("{"));

    for (const seg of segments) {
      const isConsistent =
        (dominant === "snake" && SNAKE_CASE_RX.test(seg)) ||
        (dominant === "kebab" && KEBAB_CASE_RX.test(seg)) ||
        (dominant === "camel" && CAMEL_CASE_RX.test(seg));

      if (!isConsistent && seg.length > 1) {
        issues.push(
          buildConsistencyIssue(
            "INCONSISTENT_NAMING_CONVENTION",
            "MEDIUM",
            ep.filePath,
            ep.line,
            `${ep.method} ${ep.route}`,
            "INCONSISTENT_NAMING_CONVENTION",
            `Route segment '${seg}' violates dominant naming convention (${dominant}-case).`,
            `Use consistent ${dominant}-case naming across all route segments.`,
            ep.rawSnippet,
          ),
        );
      }
    }
  }

  return Object.freeze(issues);
}

export function detectResourceNamingViolations(
  endpoints: readonly ApiEndpoint[],
): readonly ApiContractIssue[] {
  const issues: ApiContractIssue[] = [];

  for (const ep of endpoints) {
    const resource = extractResourceName(ep.route);
    if (!resource || resource === "root") continue;

    if (/[A-Z]/.test(resource)) {
      issues.push(
        buildConsistencyIssue(
          "RESOURCE_NAMING_VIOLATION",
          "LOW",
          ep.filePath,
          ep.line,
          `${ep.method} ${ep.route}`,
          "RESOURCE_UPPERCASE",
          `Resource name '${resource}' contains uppercase letters — REST convention requires lowercase.`,
          "Use lowercase resource names in REST API paths (e.g., /users not /Users).",
          ep.rawSnippet,
        ),
      );
    }

    if (ep.method === "GET" && !resource.endsWith("s") && !resource.endsWith("x") && resource.length > 2) {
      const pathParams = ep.route.match(/:([a-zA-Z_]\w*)/g);
      if (!pathParams) {
        issues.push(
          buildConsistencyIssue(
            "RESOURCE_NAMING_VIOLATION",
            "LOW",
            ep.filePath,
            ep.line,
            `${ep.method} ${ep.route}`,
            "RESOURCE_NOT_PLURAL",
            `Collection endpoint '${ep.method} ${ep.route}' uses singular resource name '${resource}' — REST convention prefers plurals.`,
            "Use plural nouns for collection endpoints (e.g., GET /users instead of GET /user).",
            ep.rawSnippet,
          ),
        );
      }
    }
  }

  return Object.freeze(issues);
}
