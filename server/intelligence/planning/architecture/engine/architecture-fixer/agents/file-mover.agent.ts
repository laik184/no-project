import type { FixAction, TransformResult } from "../types.js";
import { createChange, type TransformationContext } from "../types.js";

export function moveFile(action: FixAction, context: TransformationContext): TransformResult {
  const from = String(action.params.from ?? "");
  const to = String(action.params.to ?? "");
  const content = context.files[from] ?? "";

  if (!from || !to || !content) {
    return Object.freeze({
      actionId: action.actionId,
      changes: Object.freeze([]),
      warnings: Object.freeze([`Move skipped; missing source/target for ${action.actionId}`]),
    });
  }

  return Object.freeze({
    actionId: action.actionId,
    changes: Object.freeze([
      createChange(from, content, ""),
      createChange(to, "", content),
    ]),
    warnings: Object.freeze([]),
  });
}
