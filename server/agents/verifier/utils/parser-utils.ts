export function parseLines(output: string): string[] {
  return output.split(/\r?\n/).filter((l) => l.trim().length > 0);
}

export function extractSection(
  output:    string,
  startMark: string,
  endMark:   string,
): string {
  const start = output.indexOf(startMark);
  if (start === -1) return '';
  const end = output.indexOf(endMark, start + startMark.length);
  return end === -1
    ? output.slice(start + startMark.length).trim()
    : output.slice(start + startMark.length, end).trim();
}

export function splitOutput(
  output: string,
  delimiter = '\n\n',
): string[] {
  return output.split(delimiter).map((s) => s.trim()).filter(Boolean);
}

export function extractNumber(text: string, pattern: RegExp): number | undefined {
  const m = text.match(pattern);
  return m ? parseInt(m[1], 10) : undefined;
}

export function extractGroup(text: string, pattern: RegExp, group = 1): string | undefined {
  const m = text.match(pattern);
  return m ? m[group] : undefined;
}

export function matchAll(text: string, pattern: RegExp): RegExpMatchArray[] {
  return Array.from(text.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')));
}

export function lastLines(output: string, n: number): string[] {
  const lines = parseLines(output);
  return lines.slice(-n);
}

export function firstLines(output: string, n: number): string[] {
  return parseLines(output).slice(0, n);
}
