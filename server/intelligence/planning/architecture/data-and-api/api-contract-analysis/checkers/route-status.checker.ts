import type { ApiContractIssue, ApiEndpoint, CodeFile } from "../types.js";
import { matchPattern } from "../utils/pattern.matcher.util.js";
import { routeSignature } from "../utils/endpoint.parser.util.js";
import { buildBreakingIssue } from "./breaking-issue-builder.util.js";

export function detectResponseStatusCodeChanges(file: Readonly<CodeFile>): readonly ApiContractIssue[] {
  const issues: ApiContractIssue[] = [];
  const statusCodeChanges = [
    {
      rx: /res\.status\s*\(\s*200\s*\)[^;]*\.json\s*\(\s*\{\s*(?:error|err|message)\s*:/g,
      message: "Returning error payload with HTTP 200 — breaks client error handling contracts.",
      rule: "SUCCESS_CODE_WITH_ERROR_BODY",
    },
    {
      rx: /res\.status\s*\(\s*201\s*\)[^;]*(?:update|replace|modify)/g,
      message: "Using 201 Created on update operation — should be 200 OK for PUT/PATCH.",
      rule: "WRONG_STATUS_FOR_UPDATE",
    },
    {
      rx: /res\.status\s*\(\s*204\s*\)[^;]*\.json\s*\(/g,
      message: "Sending response body with HTTP 204 No Content — clients expect empty response.",
      rule: "BODY_WITH_204",
    },
  ];

  for (const { rx, message, rule } of statusCodeChanges) {
    const hits = matchPattern(file.content, rx);
    for (const hit of hits.slice(0, 5)) {
      issues.push(
        buildBreakingIssue(
          "BREAKING_STATUS_CODE_CHANGE",
          "HIGH",
          file.path,
          hit.line,
          null,
          rule,
          message,
          "Use correct HTTP status codes consistently: 200 for success, 201 for created, 204 for no-content, 4xx for client errors.",
          hit.snippet,
        ),
      );
    }
  }

  return Object.freeze(issues);
}

export function detectRemovedOrRenamedRoutes(
  endpoints: readonly ApiEndpoint[],
): readonly ApiContractIssue[] {
  const issues: ApiContractIssue[] = [];
  const deprecatedRouteRx = /\/deprecated\/|\/legacy\/|\/old\//g;

  for (const ep of endpoints) {
    if (deprecatedRouteRx.test(ep.route)) {
      deprecatedRouteRx.lastIndex = 0;
      issues.push(
        buildBreakingIssue(
          "BREAKING_ROUTE_REMOVAL",
          "HIGH",
          ep.filePath,
          ep.line,
          `${ep.method} ${ep.route}`,
          "DEPRECATED_ROUTE_IN_USE",
          `Route '${ep.method} ${ep.route}' contains 'deprecated/legacy/old' segment — likely a route pending removal that clients may still use.`,
          "Return HTTP 301/308 redirects from old routes to new ones. Set a sunset date header before removal.",
          ep.rawSnippet,
        ),
      );
    }
  }

  const routesBySignature = new Map<string, ApiEndpoint[]>();
  for (const ep of endpoints) {
    const sig = routeSignature(ep);
    const list = routesBySignature.get(sig) ?? [];
    list.push(ep);
    routesBySignature.set(sig, list);
  }

  for (const [sig, eps] of routesBySignature.entries()) {
    if (eps.length < 2) continue;
    const versions = eps.map((e) => e.version).filter(Boolean);
    if (new Set(versions).size < 2) continue;

    const sorted = [...eps].sort((a, b) => (b.version ?? "").localeCompare(a.version ?? ""));
    const latest = sorted[0];
    if (!latest) continue;

    issues.push(
      buildBreakingIssue(
        "BREAKING_ROUTE_REMOVAL",
        "MEDIUM",
        latest.filePath,
        latest.line,
        sig,
        "ROUTE_VERSION_OVERLAP",
        `Route '${sig}' exists in multiple API versions (${versions.join(", ")}) — ensure older versions remain backward compatible.`,
        "Keep older API versions stable. Only introduce breaking changes in new major versions.",
        latest.rawSnippet,
      ),
    );
  }

  return Object.freeze(issues);
}
