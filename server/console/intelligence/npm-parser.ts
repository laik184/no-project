/**
 * IQ 2000 — Console · Intelligence · npm Parser
 *
 * Parses npm install/ci output into structured metadata.
 * Returns null for lines that are not npm-related.
 */

import type { NpmMeta } from '../types.ts';

// Strip ANSI before matching
const ANSI_RE = /\x1b\[[0-9;]*[mGKHF]/g;
function strip(s: string): string { return s.replace(ANSI_RE, '').trim(); }

// Spinner chars emitted by npm's listr output
const SPINNER_RE = /^[⠙⠸⠼⠴⠦⠧⠇⠏⠋⠛⠟⠯⠷⣿]/;

// "added 47 packages, and audited 48 packages in 3s"
const ADDED_RE = /added (\d+) packages?/i;
// "X vulnerabilities (Y moderate)"
const VULN_RE = /(\d+) (critical|high|moderate|low) vulnerabilit/i;
// "npm warn deprecated"
const WARN_RE = /^npm\s+warn/i;
// "npm error"
const ERR_RE = /^npm\s+(err|error)/i;
// "Downloading ..." or "Fetching..."
const DL_RE = /^(Downloading|Fetching|Resolving|Linking|Auditing|Preparing)/i;

export function parseNpm(raw: string): NpmMeta | null {
  const text = strip(raw);

  if (ERR_RE.test(text)) return { type: 'install-error' };
  if (WARN_RE.test(text)) return { type: 'install-warning' };

  const addedMatch = ADDED_RE.exec(text);
  if (addedMatch) {
    const vulnMatch = VULN_RE.exec(text);
    return {
      type:            'install-done',
      packages:        parseInt(addedMatch[1], 10),
      vulnerabilities: vulnMatch ? parseInt(vulnMatch[1], 10) : 0,
    };
  }

  if (VULN_RE.test(text)) {
    const m = VULN_RE.exec(text)!;
    return { type: 'install-done', vulnerabilities: parseInt(m[1], 10) };
  }

  if (SPINNER_RE.test(text) || DL_RE.test(text)) {
    return { type: 'install-progress' };
  }

  // "npm install" or "npm ci" appearing in command echo
  if (/^npm (install|ci|i)\b/.test(text)) return { type: 'install-start' };

  return null;
}
