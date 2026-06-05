/**
 * server/terminal/parsers/ansi-parser.ts
 *
 * Strips and inspects ANSI escape sequences from terminal output.
 */

const ANSI_ESCAPE_RE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const ANSI_HYPERLINK_RE = /\x1B]8;;.*?\x07(.*?)\x1B]8;;\x07/g;

export interface AnsiResult {
  raw:     string;
  clean:   string;
  hasAnsi: boolean;
}

export const ansiParser = {
  strip(raw: string): string {
    return raw
      .replace(ANSI_HYPERLINK_RE, '$1')
      .replace(ANSI_ESCAPE_RE, '');
  },

  parse(raw: string): AnsiResult {
    const clean = this.strip(raw);
    return { raw, clean, hasAnsi: clean !== raw };
  },

  stripMany(lines: string[]): string[] {
    return lines.map(l => this.strip(l));
  },

  hasColor(raw: string): boolean {
    return /\x1B\[\d+(;\d+)*m/.test(raw);
  },

  hasCursor(raw: string): boolean {
    return /\x1B\[[\d;]*[ABCDHEF]/.test(raw);
  },
};
