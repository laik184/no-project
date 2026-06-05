/**
 * server/terminal/parsers/pnpm-parser.ts
 *
 * Parses pnpm command output.
 */

import { ansiParser } from './ansi-parser.ts';

export interface PnpmParseResult {
  action:   'install' | 'remove' | 'update' | 'unknown';
  packages: string[];
  warnings: string[];
  errors:   string[];
}

const ADDED_RE   = /Packages:\s+\+(\d+)/;
const REMOVED_RE = /Packages:\s+-(\d+)/;
const WARN_RE    = /^\s*WARN\s+/i;
const ERR_RE     = /^\s*ERR(?:OR)?\s+/i;

export const pnpmParser = {
  parse(output: string): PnpmParseResult {
    const clean    = ansiParser.strip(output);
    const lines    = clean.split('\n');
    const packages: string[] = [];
    const warnings: string[] = [];
    const errors:   string[] = [];

    lines.forEach(line => {
      if (WARN_RE.test(line)) warnings.push(line.replace(WARN_RE, '').trim());
      else if (ERR_RE.test(line)) errors.push(line.trim());
    });

    const addedMatch   = ADDED_RE.exec(clean);
    const removedMatch = REMOVED_RE.exec(clean);

    let action: PnpmParseResult['action'] = 'unknown';
    if (addedMatch)   action = 'install';
    if (removedMatch) action = 'remove';

    return { action, packages, warnings, errors };
  },
};
