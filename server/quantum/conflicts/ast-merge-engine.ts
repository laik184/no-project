/**
 * ast-merge-engine.ts
 *
 * Structural text-based merge for TypeScript/JavaScript files.
 * Operates on line-level blocks (import blocks, export blocks, function blocks).
 * Full AST parsing is intentionally avoided for performance and zero-dep reasons.
 * Falls back to confidence-winner strategy when structural merge fails.
 */

import type { AstMergeFragment, MergeResult } from "../types/merge.types.ts";

// ── Block extractor ───────────────────────────────────────────────────────────

interface TextBlock {
  kind:    "import" | "export" | "function" | "class" | "other";
  id:      string;     // first-line signature for identity
  content: string;
  start:   number;
  end:     number;
}

function extractBlocks(source: string): TextBlock[] {
  const lines   = source.split("\n");
  const blocks: TextBlock[] = [];
  let   i       = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    let kind: TextBlock["kind"] = "other";

    if (line.startsWith("import "))                          kind = "import";
    else if (line.startsWith("export "))                     kind = "export";
    else if (line.startsWith("function ") || line.startsWith("async function ")) kind = "function";
    else if (line.startsWith("class "))                      kind = "class";

    // Simple block: single line or until closing brace
    const start = i;
    let depth   = (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
    i++;

    while (depth > 0 && i < lines.length) {
      const l = lines[i];
      depth += (l.match(/\{/g) ?? []).length;
      depth -= (l.match(/\}/g) ?? []).length;
      i++;
    }

    blocks.push({
      kind,
      id:      lines[start].trim().slice(0, 80),
      content: lines.slice(start, i).join("\n"),
      start,
      end:     i - 1,
    });
  }

  return blocks;
}

// ── Merge logic ───────────────────────────────────────────────────────────────

export interface AstMergeInput {
  filePath:       string;
  contentA:       string;   // from path A
  contentB:       string;   // from path B
  confidenceA:    number;
  confidenceB:    number;
  pathIdA:        string;
  pathIdB:        string;
}

export function astMerge(input: AstMergeInput): MergeResult {
  try {
    const blocksA = extractBlocks(input.contentA);
    const blocksB = extractBlocks(input.contentB);

    const merged: string[] = [];
    let   conflictCount    = 0;
    let   winnerPathId     = input.confidenceA >= input.confidenceB
      ? input.pathIdA : input.pathIdB;

    // Union imports (prefer A's import if both define same module)
    const importsA = blocksA.filter(b => b.kind === "import");
    const importsB = blocksB.filter(b => b.kind === "import");
    const importIds = new Set<string>();

    for (const imp of [...importsA, ...importsB]) {
      if (!importIds.has(imp.id)) {
        importIds.add(imp.id);
        merged.push(imp.content);
      }
    }

    // Merge non-import blocks: prefer higher-confidence path when same id
    const blockMapA = new Map(blocksA.filter(b => b.kind !== "import").map(b => [b.id, b]));
    const blockMapB = new Map(blocksB.filter(b => b.kind !== "import").map(b => [b.id, b]));
    const allIds    = new Set([...blockMapA.keys(), ...blockMapB.keys()]);

    for (const id of allIds) {
      const blockA = blockMapA.get(id);
      const blockB = blockMapB.get(id);

      if (blockA && !blockB) { merged.push(blockA.content); continue; }
      if (blockB && !blockA) { merged.push(blockB.content); continue; }

      // Both have this block — conflict
      conflictCount++;
      const winner = input.confidenceA >= input.confidenceB ? blockA! : blockB!;
      merged.push(winner.content);
    }

    return {
      filePath:     input.filePath,
      strategy:     "AST_MERGE",
      winnerPathId,
      content:      merged.join("\n\n"),
      conflicts:    conflictCount,
      success:      true,
      reason:       `AST merge: ${conflictCount} conflict(s) resolved by confidence`,
    };
  } catch (err) {
    // Fallback: confidence winner takes all
    const winner = input.confidenceA >= input.confidenceB;
    return {
      filePath:     input.filePath,
      strategy:     "CONFIDENCE_WINNER",
      winnerPathId: winner ? input.pathIdA : input.pathIdB,
      content:      winner ? input.contentA : input.contentB,
      conflicts:    1,
      success:      false,
      reason:       `AST merge failed, confidence-winner fallback: ${(err as Error).message}`,
    };
  }
}

// ── Fragment extraction (for external use) ────────────────────────────────────

export function extractFragments(
  filePath: string,
  pathId:   string,
  content:  string,
): AstMergeFragment[] {
  return extractBlocks(content).map(b => ({
    filePath,
    pathId,
    nodeType:  b.kind,
    nodeId:    b.id,
    content:   b.content,
    lineStart: b.start,
    lineEnd:   b.end,
  }));
}
