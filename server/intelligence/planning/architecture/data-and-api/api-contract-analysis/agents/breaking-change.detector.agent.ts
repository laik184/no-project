import type {
  CodeFile,
  ApiContractIssue,
  ApiEndpoint,
  BreakingChangeResult,
} from "../types.js";
import { isTestFile, isTypeFile } from "../utils/pattern.matcher.util.js";
import {
  detectRemovedFields,
  detectBreakingTypeChanges,
  detectRequiredFieldAdditions,
} from "../checkers/field-and-type.checker.js";
import {
  detectResponseStatusCodeChanges,
  detectRemovedOrRenamedRoutes,
} from "../checkers/route-status.checker.js";

export { resetBreakingChangeCounter } from "../checkers/breaking-issue-builder.util.js";

export function detectBreakingChanges(
  files: readonly CodeFile[],
  endpoints: readonly ApiEndpoint[],
): BreakingChangeResult {
  const allIssues: ApiContractIssue[] = [];
  let filesScanned = 0;

  for (const file of files) {
    if (isTestFile(file.path) || isTypeFile(file.path)) continue;
    if (!file.content.trim()) continue;

    filesScanned += 1;

    allIssues.push(
      ...detectRemovedFields(file),
      ...detectResponseStatusCodeChanges(file),
      ...detectBreakingTypeChanges(file),
      ...detectRequiredFieldAdditions(file),
    );
  }

  allIssues.push(...detectRemovedOrRenamedRoutes(endpoints));

  return Object.freeze({
    issues: Object.freeze(allIssues),
    filesScanned,
    breakingChangeCount: allIssues.length,
  });
}

export function breakingChangeCount(result: Readonly<BreakingChangeResult>): number {
  return result.issues.length;
}

export function criticalBreakingChanges(
  result: Readonly<BreakingChangeResult>,
): readonly ApiContractIssue[] {
  return Object.freeze(result.issues.filter((i) => i.severity === "CRITICAL"));
}
