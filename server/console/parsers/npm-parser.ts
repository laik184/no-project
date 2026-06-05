/**
 * server/console/parsers/npm-parser.ts
 *
 * Detects npm install log patterns and extracts structured NpmMeta.
 */

import type { NpmMeta } from '../../shared/console/types.ts';

const RE_INSTALL_START  = /^(npm warn|added \d+|npm install|installing packages)/i;
const RE_INSTALL_DONE   = /^added\s+(\d+)\s+package/i;
const RE_VULN           = /(\d+)\s+(low|moderate|high|critical)\s+severity/i;
const RE_PROGRESS       = /^npm warn/i;
const RE_WARN           = /^npm warn\s+(EBADENGINE|deprecated|peer dep|old lockfile)/i;
const RE_ERR            = /^npm error/i;
const RE_PKG_NAME       = /^npm install\s+([\w@/.-]+)/i;

export function parseNpm(line: string): NpmMeta | null {
  if (RE_ERR.test(line)) {
    return { type: 'install-error' };
  }

  const doneMatch = RE_INSTALL_DONE.exec(line);
  if (doneMatch) {
    const packages = parseInt(doneMatch[1], 10);
    const vulnMatch = RE_VULN.exec(line);
    return {
      type: 'install-done',
      packages,
      vulnerabilities: vulnMatch ? parseInt(vulnMatch[1], 10) : 0,
    };
  }

  if (RE_WARN.test(line)) {
    return { type: 'install-warning' };
  }

  if (RE_PROGRESS.test(line)) {
    return { type: 'install-progress' };
  }

  if (RE_INSTALL_START.test(line)) {
    const pkgMatch = RE_PKG_NAME.exec(line);
    return { type: 'install-start', packageName: pkgMatch?.[1] };
  }

  return null;
}

export function isNpmLine(line: string): boolean {
  return /^npm\s/i.test(line) || /^added\s+\d+/i.test(line);
}
