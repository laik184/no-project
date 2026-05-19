/**
 * IQ 2000 — Console · Intelligence · Node Parser
 *
 * Detects Node.js runtime errors, uncaught exceptions, and stack traces.
 * Returns null for normal output lines.
 */

import type { NodeMeta } from '../types.ts';

const ANSI_RE = /\x1b\[[0-9;]*[mGKHF]/g;
function strip(s: string): string { return s.replace(ANSI_RE, '').trim(); }

// "    at Object.<anonymous> (/path/to/file.js:10:5)"
const STACK_RE   = /^\s+at\s+.+\((.+):(\d+):(\d+)\)/;
// "at async ..."
const STACK_RE2  = /^\s+at\s+async\s+.+\((.+):(\d+):(\d+)\)/;
// "UnhandledPromiseRejectionWarning: Error: ..."
const UNHANDLED_RE = /UnhandledPromiseRejection/i;
// "SyntaxError: ..."
const SYNTAX_RE  = /^SyntaxError:/;
// "Error [ERR_...]: ..."
const ERR_CODE_RE = /^Error \[ERR_/;
// "Uncaught Error:"
const UNCAUGHT_RE = /^Uncaught\s+(TypeError|Error|ReferenceError|RangeError)/;

export function parseNode(raw: string): NodeMeta | null {
  const text = strip(raw);

  if (UNHANDLED_RE.test(text)) return { type: 'unhandled', message: text };
  if (UNCAUGHT_RE.test(text))  return { type: 'uncaught',  message: text };
  if (SYNTAX_RE.test(text))    return { type: 'syntax-error', message: text };
  if (ERR_CODE_RE.test(text))  return { type: 'startup-error', message: text };

  const m = STACK_RE.exec(text) || STACK_RE2.exec(text);
  if (m) {
    return {
      type:   'stack-trace',
      file:   m[1],
      line:   parseInt(m[2], 10),
      column: parseInt(m[3], 10),
    };
  }

  return null;
}
