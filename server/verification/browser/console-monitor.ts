/**
 * console-monitor.ts
 *
 * Detects JavaScript runtime errors embedded in HTML output and
 * identifies common error patterns from server logs.
 * Works without a headless browser.
 */

import type { ConsoleError } from "./verification-types.ts";

// ── Error patterns found in HTML/inline scripts ───────────────────────────────

const JS_ERROR_PATTERNS: Array<{ pattern: RegExp; level: "error" | "warning" }> = [
  { pattern: /ReferenceError:\s*([^\n<"]+)/g,       level: "error" },
  { pattern: /TypeError:\s*([^\n<"]+)/g,             level: "error" },
  { pattern: /SyntaxError:\s*([^\n<"]+)/g,           level: "error" },
  { pattern: /Uncaught\s+(?:Error|Exception):\s*([^\n<"]+)/g, level: "error" },
  { pattern: /Cannot read propert(?:y|ies)\s+([^\n<"]+)/g, level: "error" },
  { pattern: /is not a function/g,                   level: "error" },
  { pattern: /Warning:\s*Each child in a list/g,     level: "warning" },
  { pattern: /Warning:\s*React does not recognize/g, level: "warning" },
  { pattern: /Failed to load resource/g,             level: "warning" },
  { pattern: /net::ERR_/g,                           level: "error" },
  { pattern: /ChunkLoadError/g,                      level: "error" },
  { pattern: /Loading chunk \d+ failed/g,            level: "error" },
];

// ── Console log patterns from server stdout ───────────────────────────────────

const SERVER_ERROR_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /SyntaxError/i,           message: "JavaScript syntax error in bundle" },
  { pattern: /Cannot find module/i,    message: "Missing module import" },
  { pattern: /ENOENT/i,                message: "File not found" },
  { pattern: /ECONNREFUSED/i,          message: "Connection refused — server may not be running" },
  { pattern: /heap out of memory/i,    message: "Node.js out of memory" },
  { pattern: /TypeError/i,             message: "Type error in server code" },
  { pattern: /UnhandledPromiseRejection/i, message: "Unhandled promise rejection" },
];

// ── Extractors ─────────────────────────────────────────────────────────────────

export function extractConsoleErrorsFromHtml(html: string): ConsoleError[] {
  const errors: ConsoleError[] = [];

  for (const { pattern, level } of JS_ERROR_PATTERNS) {
    const re = new RegExp(pattern.source, "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null) {
      const message = match[0].slice(0, 150).replace(/<[^>]+>/g, "").trim();
      if (message && !errors.some(e => e.message === message)) {
        errors.push({ level, message, source: "html-inline" });
      }
    }
  }

  return errors;
}

export function extractConsoleErrorsFromLogs(logs: string[]): ConsoleError[] {
  const errors: ConsoleError[] = [];

  for (const line of logs) {
    for (const { pattern, message } of SERVER_ERROR_PATTERNS) {
      if (pattern.test(line)) {
        const err: ConsoleError = {
          level:   "error",
          message: `${message}: ${line.slice(0, 100)}`,
          source:  "server-log",
        };
        if (!errors.some(e => e.message === err.message)) {
          errors.push(err);
        }
      }
    }
  }

  return errors;
}

/** Severity score: 0 = no errors, 100 = critical JS crash. */
export function scoreConsoleErrors(errors: ConsoleError[]): number {
  const errorCount   = errors.filter(e => e.level === "error").length;
  const warningCount = errors.filter(e => e.level === "warning").length;
  const penalty = errorCount * 20 + warningCount * 5;
  return Math.min(100, penalty);
}
