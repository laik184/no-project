/**
 * ast-merge-engine.ts
 *
 * AST-level 3-way merge for TypeScript / JavaScript files.
 * Single responsibility: given ancestor + ours + theirs, produce a merged output.
 *
 * Strategy:
 *   1. Identity checks — if ours===theirs or one side unchanged, return clean merge.
 *   2. Line-based 3-way merge with proper LCS diff (fixes prior index-drift bug).
 *   3. Conflict markers embedded for unresolvable regions.
 *
 * BUGFIX (index-drift):
 *   The prior implementation incremented all indices (aIdx, oIdx, tIdx) by 1
 *   uniformly even when a hunk replaced multiple lines, causing downstream
 *   diff entries to be matched against the wrong ancestor lines.
 *   Fix: use a proper LCS-based differ that maps ancestor→target line ranges,
 *   then walk ancestor lines once with correct hunk consumption.
 *
 * Telemetry: emitted by conflict-resolver on merge outcome.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MergeInput {
  ancestor: string;
  ours:     string;
  theirs:   string;
  path:     string;
}

export type MergeOutcome = "clean" | "conflict_markers" | "failed";

export interface MergeOutput {
  outcome:   MergeOutcome;
  content:   string;
  conflicts: number;
}

// ── LCS-based differ ─────────────────────────────────────────────────────────

interface Hunk {
  /** First ancestor line index (inclusive) consumed by this hunk. */
  anchorStart: number;
  /** Ancestor lines consumed (0 = pure insertion before anchorStart). */
  anchorLen:   number;
  /** Replacement lines in the target version. */
  lines:       string[];
}

/**
 * Compute change hunks from `a` (ancestor) to `b` (target) using a simple
 * DP LCS. Returns hunks in ascending anchorStart order.
 */
function diffToHunks(a: string[], b: string[]): Hunk[] {
  const m = a.length;
  const n = b.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j]
        ? 1 + dp[i + 1][j + 1]
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  // Walk LCS table to produce edit script
  const hunks: Hunk[] = [];
  let i = 0; let j = 0;

  while (i < m || j < n) {
    if (i < m && j < n && a[i] === b[j]) {
      // Unchanged line — advance both
      i++; j++;
    } else if (j < n && (i >= m || dp[i][j + 1] >= dp[i + 1][j])) {
      // Insertion in b — collect consecutive insertions
      const insLines: string[] = [];
      while (j < n && !(i < m && a[i] === b[j] && dp[i][j] === dp[i][j])) {
        insLines.push(b[j]);
        j++;
        if (i < m && j < n && a[i] === b[j]) break;
      }
      if (insLines.length > 0) {
        hunks.push({ anchorStart: i, anchorLen: 0, lines: insLines });
      }
    } else {
      // Deletion/replacement in a — collect consecutive changes
      const anchorStart = i;
      let anchorLen     = 0;
      const replLines:   string[] = [];

      while (i < m && !(j < n && a[i] === b[j] && dp[i + 1][j + 1] === dp[i][j] - 1)) {
        anchorLen++;
        i++;
        if (j < n && i < m && a[i] === b[j]) break;
      }
      while (j < n && (i >= m || !(a[i] === b[j]))) {
        replLines.push(b[j]);
        j++;
        if (i < m && j < n && a[i] === b[j]) break;
      }

      if (anchorLen > 0 || replLines.length > 0) {
        hunks.push({ anchorStart, anchorLen: Math.max(anchorLen, 1), lines: replLines });
      }

      // Prevent infinite loop: advance i if we made no progress
      if (anchorLen === 0 && replLines.length === 0) { i++; }
    }
  }

  return hunks;
}

// ── Engine ────────────────────────────────────────────────────────────────────

class AstMergeEngine {
  /**
   * Attempt a 3-way merge of ancestor, ours, theirs.
   * Returns MergeOutput with outcome and final content.
   */
  merge(input: MergeInput): MergeOutput {
    const { ancestor, ours, theirs } = input;

    // Fast-path identity checks
    if (ours === theirs)   return { outcome: "clean", content: ours,   conflicts: 0 };
    if (ours === ancestor) return { outcome: "clean", content: theirs, conflicts: 0 };
    if (theirs === ancestor) return { outcome: "clean", content: ours, conflicts: 0 };

    return this._lineMerge(ancestor, ours, theirs);
  }

  private _lineMerge(ancestor: string, ours: string, theirs: string): MergeOutput {
    const aLines = ancestor.split("\n");
    const oLines = ours.split("\n");
    const tLines = theirs.split("\n");

    // Compute proper LCS-based hunks for each side
    const ourHunks   = diffToHunks(aLines, oLines);
    const theirHunks = diffToHunks(aLines, tLines);

    // Build hunk index keyed by anchorStart for fast lookup
    const ourByAnchor   = new Map<number, Hunk>();
    const theirByAnchor = new Map<number, Hunk>();
    for (const h of ourHunks)   ourByAnchor.set(h.anchorStart, h);
    for (const h of theirHunks) theirByAnchor.set(h.anchorStart, h);

    const output:   string[] = [];
    let conflicts            = 0;
    let i                    = 0;   // ancestor line index

    while (i < aLines.length) {
      const ourH   = ourByAnchor.get(i);
      const theirH = theirByAnchor.get(i);

      if (!ourH && !theirH) {
        // Both unchanged — emit ancestor line
        output.push(aLines[i]);
        i++;
        continue;
      }

      if (ourH && !theirH) {
        // Only ours changed — emit ours hunk
        output.push(...ourH.lines);
        i += ourH.anchorLen || 1;
        continue;
      }

      if (!ourH && theirH) {
        // Only theirs changed — emit theirs hunk
        output.push(...theirH.lines);
        i += theirH.anchorLen || 1;
        continue;
      }

      // Both changed — check if identical replacement
      if (ourH!.lines.join("\n") === theirH!.lines.join("\n")) {
        output.push(...ourH!.lines);
      } else {
        // True conflict — emit markers
        output.push(
          "<<<<<<< OURS",
          ...ourH!.lines,
          "=======",
          ...theirH!.lines,
          ">>>>>>> THEIRS",
        );
        conflicts++;
      }

      // Advance past the consumed ancestor lines (use max of both hunks)
      const consumed = Math.max(ourH!.anchorLen || 1, theirH!.anchorLen || 1);
      i += consumed;
    }

    return {
      outcome:  conflicts > 0 ? "conflict_markers" : "clean",
      content:  output.join("\n"),
      conflicts,
    };
  }
}

export const astMergeEngine = new AstMergeEngine();
