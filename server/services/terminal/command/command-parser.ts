/**
 * server/services/terminal/command/command-parser.ts
 *
 * Parses a raw shell command string into structured parts.
 * Handles basic quoting (single/double) and arg splitting.
 */

export interface ParsedCommand {
  raw:        string;
  executable: string;
  args:       string[];
  env:        Record<string, string>;
}

export class CommandParseError extends Error {
  constructor(message: string) {
    super(`[command-parser] ${message}`);
    this.name = 'CommandParseError';
  }
}

function splitArgs(raw: string): string[] {
  const tokens: string[] = [];
  let   current          = '';
  let   inSingle         = false;
  let   inDouble         = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (ch === "'" && !inDouble) { inSingle = !inSingle; continue; }
    if (ch === '"' && !inSingle) { inDouble = !inDouble; continue; }

    if (ch === ' ' && !inSingle && !inDouble) {
      if (current) { tokens.push(current); current = ''; }
      continue;
    }

    current += ch;
  }

  if (current) tokens.push(current);
  return tokens;
}

function extractInlineEnv(tokens: string[]): { env: Record<string, string>; rest: string[] } {
  const env:  Record<string, string> = {};
  let   idx = 0;

  while (idx < tokens.length && /^[A-Z_][A-Z0-9_]*=/.test(tokens[idx])) {
    const eqPos = tokens[idx].indexOf('=');
    env[tokens[idx].slice(0, eqPos)] = tokens[idx].slice(eqPos + 1);
    idx++;
  }

  return { env, rest: tokens.slice(idx) };
}

export const commandParser = {
  parse(raw: string): ParsedCommand {
    const trimmed = raw.trim();
    if (!trimmed) throw new CommandParseError('Command string is empty.');

    const tokens         = splitArgs(trimmed);
    const { env, rest }  = extractInlineEnv(tokens);

    if (!rest.length) throw new CommandParseError('No executable found after environment variables.');

    return {
      raw:        trimmed,
      executable: rest[0],
      args:       rest.slice(1),
      env,
    };
  },

  stringify(parsed: ParsedCommand): string {
    const envPart  = Object.entries(parsed.env).map(([k, v]) => `${k}=${v}`).join(' ');
    const cmdPart  = [parsed.executable, ...parsed.args].join(' ');
    return envPart ? `${envPart} ${cmdPart}` : cmdPart;
  },
};
