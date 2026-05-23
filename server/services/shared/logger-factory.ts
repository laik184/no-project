/**
 * server/services/shared/logger-factory.ts
 *
 * Logger interface + createLogger / createScopedLogger factories.
 * Single responsibility: logger object creation only.
 */

import { _ts } from "./logger-primitives.ts";

// ── Logger interface ──────────────────────────────────────────────────────────

export interface Logger {
  info:    (message: string, ...args: unknown[]) => string;
  warn:    (message: string, ...args: unknown[]) => string;
  error:   (message: string, ...args: unknown[]) => string;
  debug:   (message: string, ...args: unknown[]) => string;
  log:     (message: string, ...args: unknown[]) => string;
  getLogs: () => string[];
  entries: string[];
  history: string[];
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createLogger(name: string = "agent"): Logger {
  const tag      = `[${name}]`;
  const _entries: string[] = [];
  const fmt      = (level: string, message: string) => `[${_ts()}] ${tag} ${level}: ${message}`;
  const record   = (line: string): string => { _entries.push(line); return line; };

  return {
    info:  (m, ...a) => { const l = fmt("INFO",  m); console.log(l, ...a);   return record(l); },
    warn:  (m, ...a) => { const l = fmt("WARN",  m); console.warn(l, ...a);  return record(l); },
    error: (m, ...a) => { const l = fmt("ERROR", m); console.error(l, ...a); return record(l); },
    debug: (m, ...a) => {
      const l = fmt("DEBUG", m);
      if (process.env.DEBUG) console.debug(l, ...a);
      return record(l);
    },
    log: (m, ...a) => { const l = fmt("INFO", m); console.log(l, ...a); return record(l); },
    getLogs:  () => [..._entries],
    get entries() { return _entries; },
    get history()  { return _entries; },
  };
}

export function createScopedLogger(scope: string): Logger {
  return createLogger(scope);
}
