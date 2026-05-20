import type { FixAction, TransformResult } from "../types.js";
import { createChange, type TransformationContext } from "../types.js";

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

export function rewriteImports(action: FixAction, context: TransformationContext): TransformResult {
  const file = String(action.params.file ?? action.params.from ?? "");
  const from = String(action.params.from ?? action.params.previous ?? "");
  const to = String(action.params.to ?? action.params.importTo ?? file);

  const normalizedFile = normalizePath(file);
  const content = context.files[normalizedFile] ?? "";

  if (!content) {
    return Object.freeze({
      actionId: action.actionId,
      changes: Object.freeze([]),
      warnings: Object.freeze([`Import rewrite skipped; file not available: ${normalizedFile}`]),
    });
  }

  const updated = from ? content.split(from).join(to) : content;
  return Object.freeze({
    actionId: action.actionId,
    changes: Object.freeze([createChange(normalizedFile, content, updated)]),
    warnings: Object.freeze([]),
  });
}
