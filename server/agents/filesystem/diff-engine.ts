/**
 * diff-engine.ts
 * Lightweight text diff utilities for reporting and future patch support.
 * Does NOT implement AST edits — string-level only.
 */

export interface LineDiff {
  lineNumber: number;
  type:       'added' | 'removed' | 'unchanged';
  content:    string;
}

/**
 * Produce a simple line-based diff between two strings.
 * Returns only changed lines plus 2 lines of context around each change.
 */
export function lineDiff(before: string, after: string): LineDiff[] {
  const beforeLines = before.split('\n');
  const afterLines  = after.split('\n');
  const result: LineDiff[] = [];

  const maxLen = Math.max(beforeLines.length, afterLines.length);
  const changedLines = new Set<number>();

  for (let i = 0; i < maxLen; i++) {
    if (beforeLines[i] !== afterLines[i]) changedLines.add(i);
  }

  // Expand changed lines with ±2 context
  const toInclude = new Set<number>();
  for (const ln of changedLines) {
    for (let c = Math.max(0, ln - 2); c <= Math.min(maxLen - 1, ln + 2); c++) {
      toInclude.add(c);
    }
  }

  for (let i = 0; i < maxLen; i++) {
    if (!toInclude.has(i)) continue;
    const b = beforeLines[i];
    const a = afterLines[i];
    if (b === undefined) {
      result.push({ lineNumber: i + 1, type: 'added',   content: a });
    } else if (a === undefined) {
      result.push({ lineNumber: i + 1, type: 'removed', content: b });
    } else if (b !== a) {
      result.push({ lineNumber: i + 1, type: 'removed', content: b });
      result.push({ lineNumber: i + 1, type: 'added',   content: a });
    } else {
      result.push({ lineNumber: i + 1, type: 'unchanged', content: b });
    }
  }

  return result;
}

/** Format diff as a readable string for logging / LLM context. */
export function formatDiff(diffs: LineDiff[]): string {
  return diffs
    .map((d) => {
      const prefix = d.type === 'added' ? '+' : d.type === 'removed' ? '-' : ' ';
      return `${prefix} ${d.lineNumber}: ${d.content}`;
    })
    .join('\n');
}

/** Count added/removed lines in a diff. */
export function diffStats(diffs: LineDiff[]): { added: number; removed: number } {
  return {
    added:   diffs.filter((d) => d.type === 'added').length,
    removed: diffs.filter((d) => d.type === 'removed').length,
  };
}
