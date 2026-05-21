/**
 * server/ast/refactors/patch-generator.ts
 * Generates structured patches from AST proposals — no raw string splicing.
 * Single responsibility: patch creation. Does NOT apply patches to disk.
 */

import type { ASTEditProposal } from "../types.ts";

export interface PatchLine {
  lineNumber: number;
  kind:       "add" | "remove" | "context";
  content:    string;
}

export interface GeneratedPatch {
  filePath:   string;
  operation:  ASTEditProposal["operation"];
  hunks:      PatchLine[];
  unified:    string;       // unified diff format string
  linesAdded: number;
  linesRemoved: number;
  safeToApply: boolean;
}

function buildUnifiedDiff(
  original: string,
  modified: string,
  filePath: string,
): { unified: string; hunks: PatchLine[]; added: number; removed: number } {
  const origLines = original.split("\n");
  const modLines  = modified.split("\n");
  const hunks: PatchLine[] = [];
  let added = 0, removed = 0;

  // Simple line-by-line diff (LCS-lite for patch generation)
  const maxLen = Math.max(origLines.length, modLines.length);
  for (let i = 0; i < maxLen; i++) {
    const orig = origLines[i];
    const mod  = modLines[i];
    if (orig === mod) {
      hunks.push({ lineNumber: i + 1, kind: "context", content: orig ?? "" });
    } else {
      if (orig !== undefined) {
        hunks.push({ lineNumber: i + 1, kind: "remove", content: orig });
        removed++;
      }
      if (mod !== undefined) {
        hunks.push({ lineNumber: i + 1, kind: "add", content: mod });
        added++;
      }
    }
  }

  const unified = [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    ...hunks.map(h =>
      h.kind === "add"     ? `+${h.content}` :
      h.kind === "remove"  ? `-${h.content}` :
      ` ${h.content}`
    ),
  ].join("\n");

  return { unified, hunks, added, removed };
}

export function generatePatch(
  proposal: ASTEditProposal,
  originalContent: string,
): GeneratedPatch {
  let modifiedContent = originalContent;

  if (proposal.operation === "replace") {
    modifiedContent = proposal.newCode;
  } else if (proposal.operation === "insert") {
    modifiedContent = originalContent + "\n" + proposal.newCode;
  } else if (proposal.operation === "delete") {
    modifiedContent = originalContent.replace(proposal.newCode, "");
  }

  const { unified, hunks, added, removed } = buildUnifiedDiff(
    originalContent,
    modifiedContent,
    proposal.filePath,
  );

  return {
    filePath:     proposal.filePath,
    operation:    proposal.operation,
    hunks,
    unified,
    linesAdded:   added,
    linesRemoved: removed,
    safeToApply:  proposal.safeToApply,
  };
}

export function applyPatchToContent(
  original: string,
  patch: GeneratedPatch,
): string {
  if (!patch.safeToApply) {
    throw new Error(`Patch for "${patch.filePath}" is not marked safe to apply.`);
  }

  return patch.hunks
    .filter(h => h.kind !== "remove")
    .map(h => h.content)
    .join("\n");
}
