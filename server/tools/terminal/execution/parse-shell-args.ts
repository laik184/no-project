/**
 * server/tools/terminal/execution/parse-shell-args.ts
 *
 * Production-grade shell argument tokenizer.
 * Replaces the naive `command.split(/\s+/)` pattern (Fix #13).
 *
 * Handles:
 *   - Single-quoted arguments: 'hello world'
 *   - Double-quoted arguments: "hello world"
 *   - Escaped spaces:         hello\ world
 *   - Empty input:            returns []
 *   - Unterminated quotes:    treated as end-of-string (graceful)
 */

export function parseShellArgs(command: string): string[] {
  const args: string[]  = [];
  let   current         = '';
  let   inSingle        = false;
  let   inDouble        = false;
  let   escaped         = false;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];

    if (escaped) {
      current += ch;
      escaped  = false;
      continue;
    }

    if (ch === '\\' && !inSingle) {
      escaped = true;
      continue;
    }

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }

    if ((ch === ' ' || ch === '\t') && !inSingle && !inDouble) {
      if (current.length > 0) {
        args.push(current);
        current = '';
      }
      continue;
    }

    current += ch;
  }

  if (current.length > 0) args.push(current);
  return args;
}

/**
 * Split a command string into [executable, ...args].
 * Returns empty array if command is blank.
 */
export function splitCommand(command: string): [string, ...string[]] | [] {
  const parts = parseShellArgs(command.trim());
  if (parts.length === 0) return [];
  return parts as [string, ...string[]];
}
