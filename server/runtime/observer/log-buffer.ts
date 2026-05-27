export interface LogLine {
  stream: 'stdout' | 'stderr';
  text:   string;
  ts:     number;
}

const buffers = new Map<number, LogLine[]>();
const MAX = 2_000;

export const logBuffer = {
  append(projectId: number, stream: 'stdout' | 'stderr', text: string): void {
    if (!buffers.has(projectId)) buffers.set(projectId, []);
    const buf = buffers.get(projectId)!;
    buf.push({ stream, text, ts: Date.now() });
    if (buf.length > MAX) buf.splice(0, buf.length - MAX);
  },

  tail(projectId: number, n = 50): LogLine[] {
    const buf = buffers.get(projectId) ?? [];
    return buf.slice(-n);
  },

  clear(projectId: number): void {
    buffers.delete(projectId);
  },

  all(projectId: number): LogLine[] {
    return [...(buffers.get(projectId) ?? [])];
  },
};

export interface LineAnalysis {
  hasErrors:   boolean;
  hasWarnings: boolean;
  errorLines:  string[];
  warnLines:   string[];
  ready:       boolean;
}

export function analyzeLines(lines: LogLine[]): LineAnalysis {
  const errorLines: string[] = [];
  const warnLines:  string[] = [];
  let   ready = false;

  for (const { text } of lines) {
    const lower = text.toLowerCase();
    if (/error|exception|fatal/i.test(lower))  errorLines.push(text);
    if (/warn/i.test(lower))                   warnLines.push(text);
    if (/listening|ready|started|server running/i.test(lower)) ready = true;
  }

  return { hasErrors: errorLines.length > 0, hasWarnings: warnLines.length > 0, errorLines, warnLines, ready };
}
