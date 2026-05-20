import type { CodeFile, ApiContractIssue, ApiEndpoint, EndpointConsistencyResult } from "../types.js";
import { isTestFile, isTypeFile } from "../utils/pattern.matcher.util.js";
import { parseEndpointsFromFile } from "../utils/endpoint.parser.util.js";
import {
  detectNamingConventionViolations,
  detectResourceNamingViolations,
} from "../checkers/naming-convention.checker.js";
import {
  detectDuplicateRoutes,
  detectHttpMethodMisalignment,
  detectNonStandardStatusCodes,
} from "../checkers/method-status.checker.js";

export { resetConsistencyCounter } from "../checkers/consistency-issue-builder.util.js";

export function analyzeEndpointConsistency(
  files: readonly CodeFile[],
): EndpointConsistencyResult {
  const allIssues: ApiContractIssue[] = [];
  const allEndpoints: ApiEndpoint[] = [];
  let filesScanned = 0;

  for (const file of files) {
    if (isTestFile(file.path) || isTypeFile(file.path)) continue;
    if (!file.content.trim()) continue;

    filesScanned += 1;

    const fileEndpoints = parseEndpointsFromFile(file.path, file.content);
    allEndpoints.push(...fileEndpoints);

    allIssues.push(...detectNonStandardStatusCodes(file));
  }

  allIssues.push(
    ...detectNamingConventionViolations(allEndpoints),
    ...detectResourceNamingViolations(allEndpoints),
    ...detectHttpMethodMisalignment(allEndpoints),
    ...detectDuplicateRoutes(allEndpoints),
  );

  return Object.freeze({
    issues: Object.freeze(allIssues),
    filesScanned,
    endpointsFound: allEndpoints.length,
    endpoints: Object.freeze(allEndpoints),
  });
}

export function consistencyIssueCount(result: Readonly<EndpointConsistencyResult>): number {
  return result.issues.length;
}
