import type { ParsedStackTrace, StackFrame } from '../types/diagnostics.types.ts';
import { parseLines } from '../utils/parser-utils.ts';

const FRAME_PATTERN  = /at (?:(.+?) \()?(.+?):(\d+)(?::(\d+))?\)?$/;
const ERROR_PATTERN  = /^(\w+(?:Error|Exception)?): (.+)$/;

export function parseStackTrace(raw: string): ParsedStackTrace {
  const lines     = parseLines(raw);
  const frames:   StackFrame[] = [];
  let message     = 'Unknown error';
  let errorType   = 'Error';

  for (const line of lines) {
    const errorMatch = line.match(ERROR_PATTERN);
    if (errorMatch && frames.length === 0) {
      errorType = errorMatch[1];
      message   = errorMatch[2];
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed.startsWith('at ')) continue;

    const frameMatch = trimmed.match(FRAME_PATTERN);
    if (!frameMatch) continue;

    frames.push({
      functionName: frameMatch[1] ?? undefined,
      file:         frameMatch[2],
      line:         parseInt(frameMatch[3], 10),
      column:       frameMatch[4] ? parseInt(frameMatch[4], 10) : undefined,
    });
  }

  return { message, errorType, frames, raw };
}

export function extractFirstUserFrame(trace: ParsedStackTrace): StackFrame | undefined {
  return trace.frames.find(
    (f) => !f.file.includes('node_modules') && !f.file.startsWith('node:'),
  );
}

export function isNodeInternalFrame(frame: StackFrame): boolean {
  return frame.file.startsWith('node:') || frame.file.includes('node_modules');
}
