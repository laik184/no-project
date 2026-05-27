import type { ParsedLine } from '../types/stream.types.ts';

export class LineParser {
  private buffer = '';

  flush(chunk: string): ParsedLine[] {
    this.buffer += chunk;
    const parts  = this.buffer.split('\n');
    this.buffer  = parts.pop() ?? '';
    return parts.map((raw) => this.parseLine(raw));
  }

  drain(): ParsedLine[] {
    if (!this.buffer) return [];
    const line     = this.parseLine(this.buffer);
    this.buffer    = '';
    return [line];
  }

  private parseLine(raw: string): ParsedLine {
    return {
      raw,
      trimmed:   raw.trim(),
      isEmpty:   raw.trim().length === 0,
      timestamp: new Date(),
    };
  }

  reset(): void {
    this.buffer = '';
  }
}

export function splitToLines(chunk: string): string[] {
  return chunk.split('\n').filter((l) => l.trim().length > 0);
}
