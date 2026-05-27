export type DiffLineType = 'added' | 'removed' | 'context';

export interface DiffLine {
  type: DiffLineType;
  content: string;
  oldLineNo?: number;
  newLineNo?: number;
}

export interface DiffResult {
  lines: DiffLine[];
  added: number;
  removed: number;
  unchanged: number;
}

export function lineDiff(before: string, after: string): DiffResult {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const result: DiffLine[] = [];
  let added = 0;
  let removed = 0;
  let unchanged = 0;

  const maxLen = Math.max(beforeLines.length, afterLines.length);

  for (let i = 0; i < maxLen; i++) {
    const bLine = beforeLines[i];
    const aLine = afterLines[i];

    if (bLine === undefined) {
      result.push({ type: 'added', content: aLine, newLineNo: i + 1 });
      added++;
    } else if (aLine === undefined) {
      result.push({ type: 'removed', content: bLine, oldLineNo: i + 1 });
      removed++;
    } else if (bLine === aLine) {
      result.push({ type: 'context', content: bLine, oldLineNo: i + 1, newLineNo: i + 1 });
      unchanged++;
    } else {
      result.push({ type: 'removed', content: bLine, oldLineNo: i + 1 });
      result.push({ type: 'added', content: aLine, newLineNo: i + 1 });
      added++;
      removed++;
    }
  }

  return { lines: result, added, removed, unchanged };
}

export function formatDiff(diff: DiffResult): string {
  return diff.lines.map(l => {
    const prefix = l.type === 'added' ? '+ ' : l.type === 'removed' ? '- ' : '  ';
    return `${prefix}${l.content}`;
  }).join('\n');
}

export function diffStats(diff: DiffResult): string {
  return `+${diff.added} lines added, -${diff.removed} lines removed, ${diff.unchanged} unchanged`;
}

export function hasDiff(diff: DiffResult): boolean {
  return diff.added > 0 || diff.removed > 0;
}

export function diffSummary(before: string, after: string): string {
  const d = lineDiff(before, after);
  return hasDiff(d) ? diffStats(d) : 'No changes';
}
