/**
 * server/approvals/diff-generator.ts
 *
 * Produces a unified diff string from two text contents.
 * Pure function — no side effects, no dependencies.
 * Uses a simple LCS-based algorithm; correct for all common cases.
 */

const CONTEXT_LINES = 3;

// ── LCS ───────────────────────────────────────────────────────────────────────

function buildLcs(a: string[], b: string[]): number[][] {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp;
}

type Op = { type: "eq" | "del" | "ins"; line: string };

function buildOps(a: string[], b: string[], dp: number[][], i: number, j: number, out: Op[]): void {
  if (i === 0 && j === 0) return;
  if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
    buildOps(a, b, dp, i - 1, j - 1, out);
    out.push({ type: "eq", line: a[i - 1] });
  } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
    buildOps(a, b, dp, i, j - 1, out);
    out.push({ type: "ins", line: b[j - 1] });
  } else {
    buildOps(a, b, dp, i - 1, j, out);
    out.push({ type: "del", line: a[i - 1] });
  }
}

// ── Hunk building ─────────────────────────────────────────────────────────────

interface Hunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
}

function buildHunks(ops: Op[]): Hunk[] {
  const hunks: Hunk[] = [];
  let oldLine = 1, newLine = 1;
  let i = 0;

  while (i < ops.length) {
    // Find the next changed op
    const changeStart = ops.findIndex((op, idx) => idx >= i && op.type !== "eq");
    if (changeStart === -1) break;

    // Collect context before change
    const ctxStart = Math.max(i, changeStart - CONTEXT_LINES);
    const hunkOldStart = oldLine + (ctxStart - i) - ops.slice(i, ctxStart).filter(o => o.type === "ins").length;
    const hunkNewStart = newLine + (ctxStart - i) - ops.slice(i, ctxStart).filter(o => o.type === "del").length;

    // Advance past context before change
    for (let k = i; k < ctxStart; k++) {
      if (ops[k].type !== "ins") oldLine++;
      if (ops[k].type !== "del") newLine++;
    }

    const hunk: Hunk = {
      oldStart: hunkOldStart,
      oldCount: 0,
      newStart: hunkNewStart,
      newCount: 0,
      lines: [],
    };

    // Add context before
    for (let k = ctxStart; k < changeStart; k++) {
      hunk.lines.push(` ${ops[k].line}`);
      hunk.oldCount++;
      hunk.newCount++;
      if (ops[k].type !== "ins") oldLine++;
      if (ops[k].type !== "del") newLine++;
    }

    // Collect change + trailing context
    i = changeStart;
    let trailingCtx = 0;
    while (i < ops.length && trailingCtx < CONTEXT_LINES) {
      const op = ops[i];
      if (op.type === "del") {
        hunk.lines.push(`-${op.line}`);
        hunk.oldCount++;
        oldLine++;
        trailingCtx = 0;
      } else if (op.type === "ins") {
        hunk.lines.push(`+${op.line}`);
        hunk.newCount++;
        newLine++;
        trailingCtx = 0;
      } else {
        hunk.lines.push(` ${op.line}`);
        hunk.oldCount++;
        hunk.newCount++;
        oldLine++;
        newLine++;
        if (ops.slice(i + 1).every(o => o.type === "eq")) break;
        trailingCtx++;
      }
      i++;
    }

    hunks.push(hunk);
  }

  return hunks;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function generateUnifiedDiff(
  oldContent: string,
  newContent: string,
  filePath: string,
): string {
  if (oldContent === newContent) return "";

  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const dp   = buildLcs(oldLines, newLines);
  const ops: Op[] = [];
  buildOps(oldLines, newLines, dp, oldLines.length, newLines.length, ops);

  const hunks = buildHunks(ops);
  if (hunks.length === 0) return "";

  const lines: string[] = [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
  ];
  for (const h of hunks) {
    lines.push(`@@ -${h.oldStart},${h.oldCount} +${h.newStart},${h.newCount} @@`);
    lines.push(...h.lines);
  }

  return lines.join("\n");
}

/** Quick stats about a diff — used in the tool result summary */
export function diffStats(diff: string): { additions: number; deletions: number } {
  const diffLines = diff.split("\n");
  return {
    additions: diffLines.filter(l => l.startsWith("+") && !l.startsWith("+++")).length,
    deletions: diffLines.filter(l => l.startsWith("-") && !l.startsWith("---")).length,
  };
}
