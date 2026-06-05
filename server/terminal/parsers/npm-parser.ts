/**
 * server/terminal/parsers/npm-parser.ts
 *
 * Parses npm install/uninstall/update command output.
 */

import { ansiParser } from './ansi-parser.ts';

export interface NpmParseResult {
  action:     'install' | 'uninstall' | 'update' | 'unknown';
  packages:   string[];
  warnings:   string[];
  errors:     string[];
  audited:    number | null;
  vulnerabilities: number | null;
}

const ADDED_RE    = /added\s+(\d+)\s+package/i;
const REMOVED_RE  = /removed\s+(\d+)\s+package/i;
const CHANGED_RE  = /changed\s+(\d+)\s+package/i;
const AUDITED_RE  = /audited\s+(\d+)\s+package/i;
const VULN_RE     = /found\s+(\d+)\s+(?:low|moderate|high|critical)/i;
const WARN_RE     = /^npm\s+warn\s+/i;
const ERR_RE      = /^npm\s+err(?:or)?[!:?\s]/i;

export const npmParser = {
  parse(output: string): NpmParseResult {
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
    const changedMatch = CHANGED_RE.exec(clean);
    const auditedMatch = AUDITED_RE.exec(clean);
    const vulnMatch    = VULN_RE.exec(clean);

    let action: NpmParseResult['action'] = 'unknown';
    if (addedMatch)   { action = 'install'; }
    if (removedMatch) { action = 'uninstall'; }
    if (changedMatch) { action = 'update'; }

    return {
      action,
      packages,
      warnings,
      errors,
      audited:         auditedMatch ? parseInt(auditedMatch[1], 10) : null,
      vulnerabilities: vulnMatch    ? parseInt(vulnMatch[1], 10)    : null,
    };
  },
};
