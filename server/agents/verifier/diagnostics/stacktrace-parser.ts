/**
 * diagnostics/stacktrace-parser.ts
 * Parses stack traces into structured StackFrame objects.
 * Called by server/tools/verifier/diagnostics/stacktrace-parser.ts.
 */

import type { StackFrame, ParsedStackTrace } from '../types/diagnostics.types.ts';

const FRAME_RE        = /\s+at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/;
const FRAME_SIMPLE_RE = /\s+at\s+(.+?):(\d+):(\d+)/;
const NODE_INTERNAL   = /^(node:|internal\/)|(Node\.js|node_modules\/)/;

export function parseFrame(line: string): StackFrame | null {
  let m = FRAME_RE.exec(line);
  if (m) return { fn: m[1], file: m[2], line: parseInt(m[3], 10), col: parseInt(m[4], 10) };
  m = FRAME_SIMPLE_RE.exec(line);
  if (m) return { fn: '<anonymous>', file: m[1], line: parseInt(m[2], 10), col: parseInt(m[3], 10) };
  return null;
}

export function parseStackTrace(raw: string): ParsedStackTrace {
  const lines  = raw.split('\n');
  const frames: StackFrame[] = [];
  let message  = '';

  for (const line of lines) {
    if (!message && !line.trimStart().startsWith('at ')) {
      message = line.trim();
      continue;
    }
    const frame = parseFrame(line);
    if (frame) frames.push(frame);
  }

  return { message, frames, raw };
}

export function extractFirstUserFrame(parsed: ParsedStackTrace): StackFrame | undefined {
  return parsed.frames.find((f) => !isNodeInternalFrame(f));
}

export function isNodeInternalFrame(frame: StackFrame): boolean {
  return NODE_INTERNAL.test(frame.file);
}
