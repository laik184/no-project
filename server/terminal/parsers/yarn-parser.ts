/**
 * server/terminal/parsers/yarn-parser.ts
 *
 * Parses yarn add/remove/upgrade command output.
 */

import { ansiParser } from './ansi-parser.ts';

export interface YarnParseResult {
  action:   'add' | 'remove' | 'upgrade' | 'unknown';
  packages: string[];
  warnings: string[];
  errors:   string[];
  resolved: string[];
}

const SUCCESS_RE  = /success\s+(.*)/i;
const WARNING_RE  = /warning\s+(.*)/i;
const ERR_RE      = /error\s+(.*)/i;
const RESOLVED_RE = /Resolved\s+"([^"]+)"/g;

export const yarnParser = {
  parse(output: string): YarnParseResult {
    const clean    = ansiParser.strip(output);
    const packages: string[] = [];
    const warnings: string[] = [];
    const errors:   string[] = [];
    const resolved: string[] = [];

    clean.split('\n').forEach(line => {
      if (SUCCESS_RE.test(line)) packages.push(SUCCESS_RE.exec(line)?.[1]?.trim() ?? '');
      else if (WARNING_RE.test(line)) warnings.push(WARNING_RE.exec(line)?.[1]?.trim() ?? '');
      else if (ERR_RE.test(line)) errors.push(ERR_RE.exec(line)?.[1]?.trim() ?? '');
    });

    for (const m of clean.matchAll(RESOLVED_RE)) resolved.push(m[1]);

    let action: YarnParseResult['action'] = 'unknown';
    if (/yarn add/.test(clean))    action = 'add';
    if (/yarn remove/.test(clean)) action = 'remove';
    if (/yarn upgrade/.test(clean)) action = 'upgrade';

    return { action, packages, warnings, errors, resolved };
  },
};
