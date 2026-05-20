import type { FixAction, TransformResult } from "../types.js";
import { createChange, type TransformationContext } from "../types.js";

function splitByMarker(content: string): { first: string; second: string } {
  const lines = content.split("\n");
  const midpoint = Math.max(1, Math.floor(lines.length / 2));
  return {
    first: lines.slice(0, midpoint).join("\n"),
    second: lines.slice(midpoint).join("\n"),
  };
}

export function splitCodeFile(action: FixAction, context: TransformationContext): TransformResult {
  const source = String(action.params.source ?? "");
  const primary = String(action.params.primary ?? `${source}.part-a.ts`);
  const secondary = String(action.params.secondary ?? `${source}.part-b.ts`);

  const sourceContent = context.files[source] ?? "";
  if (!sourceContent) {
    return Object.freeze({
      actionId: action.actionId,
      changes: Object.freeze([]),
      warnings: Object.freeze([`Split skipped; source not available: ${source}`]),
    });
  }

  const { first, second } = splitByMarker(sourceContent);
  const indexContent = `export * from "./${primary.split("/").pop()?.replace(/\.ts$/, ".js")}";\nexport * from "./${secondary.split("/").pop()?.replace(/\.ts$/, ".js")}";\n`;

  return Object.freeze({
    actionId: action.actionId,
    changes: Object.freeze([
      createChange(source, sourceContent, indexContent),
      createChange(primary, "", first),
      createChange(secondary, "", second),
    ]),
    warnings: Object.freeze([]),
  });
}
