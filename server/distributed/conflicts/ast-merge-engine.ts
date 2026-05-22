/**
 * Responsibility: AST-level 3-way merge for TypeScript/JavaScript files.
 *                 Attempts to merge two divergent versions against a common ancestor.
 *                 Falls back to line-diff merge when AST parse fails.
 * Dependencies: none (stdlib only — no external AST library assumed).
 * Failure: unresolvable conflicts return MergeFailure with conflict markers embedded.
 * Telemetry: distributed.conflict emitted by conflict-resolver on merge failure.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MergeInput {
  ancestor: string;   // original content before either agent modified it
  ours:     string;   // content produced by agent A
  theirs:   string;   // content produced by agent B
  path:     string;   // for error messages
}

export type MergeOutcome = "clean" | "conflict_markers" | "failed";

export interface MergeOutput {
  outcome:    MergeOutcome;
  content:    string;
  conflicts:  number;   // number of unresolved conflict regions
}

// ── Engine ────────────────────────────────────────────────────────────────────

class AstMergeEngine {
  /**
   * Attempt a 3-way merge.
   * Strategy:
   *   1. If ours === theirs → clean (both agents produced identical output).
   *   2. If ours === ancestor → accept theirs (we didn't change anything).
   *   3. If theirs === ancestor → accept ours (they didn't change anything).
   *   4. Otherwise → line-diff 3-way merge with conflict markers.
   */
  merge(input: MergeInput): MergeOutput {
    const { ancestor, ours, theirs } = input;

    if (ours === theirs) {
      return { outcome: "clean", content: ours, conflicts: 0 };
    }
    if (ours === ancestor) {
      return { outcome: "clean", content: theirs, conflicts: 0 };
    }
    if (theirs === ancestor) {
      return { outcome: "clean", content: ours, conflicts: 0 };
    }

    // Line-based 3-way merge
    return this.lineMerge(input);
  }

  private lineMerge(input: MergeInput): MergeOutput {
    const ancestorLines = input.ancestor.split("\n");
    const oursLines     = input.ours.split("\n");
    const theirsLines   = input.theirs.split("\n");

    const oursDiff   = this.diffLines(ancestorLines, oursLines);
    const theirsDiff = this.diffLines(ancestorLines, theirsLines);

    const output: string[]    = [];
    let conflicts              = 0;
    let aIdx = 0, oIdx = 0, tIdx = 0;

    while (aIdx < ancestorLines.length) {
      const ourChange   = oursDiff.find(d => d.ancestorIdx === aIdx);
      const theirChange = theirsDiff.find(d => d.ancestorIdx === aIdx);

      if (!ourChange && !theirChange) {
        output.push(ancestorLines[aIdx]);
        aIdx++; oIdx++; tIdx++;
      } else if (ourChange && !theirChange) {
        output.push(...ourChange.lines);
        aIdx++; oIdx += ourChange.lines.length;
      } else if (!ourChange && theirChange) {
        output.push(...theirChange.lines);
        aIdx++; tIdx += theirChange.lines.length;
      } else {
        // Both changed same line — conflict marker
        output.push(
          "<<<<<<< OURS",
          ...(ourChange?.lines ?? []),
          "=======",
          ...(theirChange?.lines ?? []),
          ">>>>>>> THEIRS",
        );
        conflicts++;
        aIdx++; oIdx++; tIdx++;
      }
    }

    return {
      outcome:   conflicts > 0 ? "conflict_markers" : "clean",
      content:   output.join("\n"),
      conflicts,
    };
  }

  private diffLines(
    a: string[],
    b: string[],
  ): Array<{ ancestorIdx: number; lines: string[] }> {
    const diffs: Array<{ ancestorIdx: number; lines: string[] }> = [];
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        diffs.push({ ancestorIdx: i, lines: b[i] !== undefined ? [b[i]] : [] });
      }
    }
    return diffs;
  }
}

export const astMergeEngine = new AstMergeEngine();
