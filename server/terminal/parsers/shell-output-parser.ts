/**
 * server/terminal/parsers/shell-output-parser.ts
 *
 * Generic shell output parser — detects success/error, extracts paths and URLs.
 */

import { ansiParser } from './ansi-parser.ts';

const URL_RE   = /https?:\/\/[^\s)>"]+/g;
const PATH_RE  = /(?:^|\s)(\.{0,2}\/[^\s:,;'"]+)/gm;
const PORT_RE  = /(?:port|listening on)[:\s]+(\d{2,5})/i;

export interface ShellParseResult {
  clean:     string;
  urls:      string[];
  paths:     string[];
  port:      number | null;
  hasError:  boolean;
  isEmpty:   boolean;
}

export const shellOutputParser = {
  parse(raw: string): ShellParseResult {
    const clean    = ansiParser.strip(raw);
    const urls     = [...clean.matchAll(URL_RE)].map(m => m[0]);
    const paths    = [...clean.matchAll(PATH_RE)].map(m => m[1]);
    const portMatch = PORT_RE.exec(clean);
    const port     = portMatch ? parseInt(portMatch[1], 10) : null;

    return {
      clean,
      urls,
      paths,
      port,
      hasError: /\b(error|err:|fail(?:ed)?|exception)\b/i.test(clean),
      isEmpty:  !clean.trim(),
    };
  },

  parseMany(lines: string[]): ShellParseResult[] {
    return lines.map(l => this.parse(l));
  },

  extractPort(output: string): number | null {
    const m = PORT_RE.exec(ansiParser.strip(output));
    return m ? parseInt(m[1], 10) : null;
  },
};
