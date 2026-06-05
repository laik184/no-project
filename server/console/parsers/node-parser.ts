/**
 * server/console/parsers/node-parser.ts
 *
 * Detects Node.js error patterns and extracts structured NodeMeta.
 */

import type { NodeMeta } from '../../shared/console/types.ts';

const RE_STACK_TRACE   = /^\s+at\s+.+\(?.+:\d+:\d+\)?/;
const RE_UNCAUGHT      = /^uncaughtException:|^UnhandledPromiseRejection/i;
const RE_UNHANDLED     = /^UnhandledPromiseRejectionWarning:|unhandledRejection/i;
const RE_STARTUP_ERR   = /^(Error:|TypeError:|ReferenceError:|SyntaxError:)\s/;
const RE_SYNTAX_ERR    = /^SyntaxError:/;
const RE_FILE_LOC      = /\((.+):(\d+):(\d+)\)$|at\s+\S+\s+\((.+):(\d+):(\d+)\)/;

function extractLocation(line: string): Pick<NodeMeta, 'file' | 'line' | 'column'> {
  const m = RE_FILE_LOC.exec(line);
  if (!m) return {};
  const file   = m[1] ?? m[4];
  const lineNo = parseInt(m[2] ?? m[5], 10);
  const col    = parseInt(m[3] ?? m[6], 10);
  return {
    file:   isNaN(lineNo) ? undefined : file,
    line:   isNaN(lineNo) ? undefined : lineNo,
    column: isNaN(col)    ? undefined : col,
  };
}

export function parseNode(line: string): NodeMeta | null {
  if (RE_SYNTAX_ERR.test(line)) {
    return { type: 'syntax-error', message: line, ...extractLocation(line) };
  }

  if (RE_UNCAUGHT.test(line)) {
    return { type: 'uncaught', message: line };
  }

  if (RE_UNHANDLED.test(line)) {
    return { type: 'unhandled', message: line };
  }

  if (RE_STACK_TRACE.test(line)) {
    return { type: 'stack-trace', ...extractLocation(line) };
  }

  if (RE_STARTUP_ERR.test(line)) {
    return { type: 'startup-error', message: line };
  }

  return null;
}

export function isNodeErrorLine(line: string): boolean {
  return RE_STACK_TRACE.test(line) || RE_UNCAUGHT.test(line) || RE_UNHANDLED.test(line);
}
