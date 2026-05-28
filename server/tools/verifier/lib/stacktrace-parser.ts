import type { ParsedStackTrace, StackFrame } from './verifier-types.ts';

const FRAME_RE = /at\s+(?:(\S+)\s+\()?(.+?):(\d+):(\d+)\)?/;

export function parseStackTrace(raw: string): ParsedStackTrace {
  const lines  = raw.split('\n');
  const msg    = lines.find((l) => !l.trimStart().startsWith('at')) ?? '';
  const frames = lines.reduce<StackFrame[]>((acc, line) => {
    const m = FRAME_RE.exec(line.trim());
    if (!m) return acc;
    const [, fn = '<anonymous>', file = '', lineStr = '0', colStr = '0'] = m;
    acc.push({
      fn,
      file,
      line:     parseInt(lineStr, 10),
      column:   parseInt(colStr, 10),
      internal: file.startsWith('node:') || file.includes('node_modules'),
    });
    return acc;
  }, []);
  return { frames, original: raw, message: msg.trim() };
}

export function extractFirstUserFrame(parsed: ParsedStackTrace): StackFrame | undefined {
  return parsed.frames.find((f) => !f.internal);
}

export function isNodeInternalFrame(frame: StackFrame): boolean {
  return frame.internal;
}
