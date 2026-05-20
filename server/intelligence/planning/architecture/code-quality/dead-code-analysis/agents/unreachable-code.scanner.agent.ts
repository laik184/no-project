import type { CodeFile, DeadCodeIssue, UnreachableCodeResult } from "../types.js";
import { isTypeScriptOrJs } from "../utils/pattern.matcher.util.js";
import {
  detectCodeAfterReturn,
  detectCodeAfterThrow,
  detectCodeAfterProcessExit,
} from "../checkers/post-terminator.checker.js";
import {
  detectDeadConditionals,
  detectUnreachableBranch,
} from "../checkers/branch-conditional.checker.js";

export function scanUnreachableCode(
  files: readonly CodeFile[],
): UnreachableCodeResult {
  const allIssues: DeadCodeIssue[] = [];
  let codeAfterReturnCount = 0;
  let deadBranchCount = 0;

  for (const file of files) {
    if (!isTypeScriptOrJs(file)) continue;

    const returnIssues = detectCodeAfterReturn(file);
    const throwIssues = detectCodeAfterThrow(file);
    const conditionalIssues = detectDeadConditionals(file);
    const exitIssues = detectCodeAfterProcessExit(file);
    const branchIssues = detectUnreachableBranch(file);

    codeAfterReturnCount += returnIssues.length + throwIssues.length;
    deadBranchCount += conditionalIssues.length + branchIssues.length;

    allIssues.push(
      ...returnIssues,
      ...throwIssues,
      ...conditionalIssues,
      ...exitIssues,
      ...branchIssues,
    );
  }

  return Object.freeze({
    issues: Object.freeze(allIssues),
    filesScanned: files.filter((f) => isTypeScriptOrJs(f)).length,
    codeAfterReturnCount,
    deadBranchCount,
  });
}
