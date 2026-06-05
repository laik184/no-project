/**
 * server/console/parsers/log-parser.ts
 *
 * Orchestrates npm/vite/node parsers to enrich raw log lines with metadata.
 * Determines log kind (stdout/stderr/error) and attaches ConsoleLineMeta.
 */

import type { LogLine, LogKind, ConsoleLineMeta } from '../types/index.ts';
import { makeLogLine }    from '../domain/log-line.ts';
import { parseNpm, isNpmLine }       from './npm-parser.ts';
import { parseVite, isViteLine }     from './vite-parser.ts';
import { parseNode, isNodeErrorLine } from './node-parser.ts';

export interface RawLogInput {
  line:   string;
  stream: 'stdout' | 'stderr';
}

/**
 * Parse a raw stdout/stderr line into a rich LogLine.
 * Attaches metadata and upgrades kind when the line signals an error.
 */
export function parseLogLine(input: RawLogInput): LogLine {
  const { line, stream } = input;

  let kind: LogKind    = stream === 'stderr' ? 'stderr' : 'stdout';
  const meta: ConsoleLineMeta = {};
  let upgraded = false;

  // npm patterns
  if (isNpmLine(line)) {
    const npm = parseNpm(line);
    if (npm) {
      meta.npm = npm;
      if (npm.type === 'install-error') { kind = 'error'; upgraded = true; }
    }
  }

  // vite patterns
  if (!upgraded && isViteLine(line)) {
    const vite = parseVite(line);
    if (vite) {
      meta.vite = vite;
      if (vite.type === 'compile-error') { kind = 'error'; upgraded = true; }
    }
  }

  // node error patterns (run on both stdout and stderr)
  if (!upgraded && isNodeErrorLine(line)) {
    const node = parseNode(line);
    if (node) {
      meta.node = node;
      if (node.type !== 'stack-trace') { kind = 'error'; }
    }
  } else if (!upgraded && stream === 'stderr') {
    const node = parseNode(line);
    if (node) meta.node = node;
  }

  const hasMeta = Object.keys(meta).length > 0;
  return makeLogLine(kind, line, hasMeta ? meta : undefined);
}
