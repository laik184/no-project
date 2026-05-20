/**
 * stack-trace-extractor.ts
 *
 * Extract structured stack frames and error messages from raw log lines.
 *
 * Pure function — no I/O, no bus, no state.
 * Used to pre-process logs before feeding them to the LLM recovery agent,
 * reducing token waste and improving root-cause accuracy.
 *
 * Ownership: autonomous-debug/analyzers — single responsibility: extraction.
 */

import type { ExtractedError, StackFrame } from "../types/debug-types.ts";

// ─── Patterns ─────────────────────────────────────────────────────────────────

// Node.js stack frame: "    at functionName (file.ts:12:5)"
const FRAME_AT = /^\s+at\s+(?:(.+?)\s+\()?(.+?):(\d+)(?::(\d+))?\)?$/;

// Vite/esbuild style: "file.ts:12:5: error: ..."
const VITE_ERROR = /^([^:]+\.(?:ts|tsx|js|jsx|mjs|cjs)):(\d+):(\d+):\s*(error|warning):\s*(.+)$/i;

// Missing module: "Cannot find module 'X'"
const MISSING_MODULE = /cannot find module ['"]([^'"]+)['"]/i;

// Syntax error header: "SyntaxError: Unexpected token ..."
const SYNTAX_ERROR = /^(SyntaxError|TypeError|ReferenceError|RangeError|Error):\s*(.+)$/;

// TS error: "error TS2345: ..."
const TS_ERROR = /error (TS\d+):\s*(.+)/i;

// ─── Frame parser ─────────────────────────────────────────────────────────────

function parseFrame(line: string): StackFrame | null {
  const m = FRAME_AT.exec(line);
  if (!m) return null;
  return {
    symbol: m[1] || undefined,
    file:   m[2],
    line:   m[3] ? parseInt(m[3], 10) : undefined,
    col:    m[4] ? parseInt(m[4], 10) : undefined,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract all structured errors from a set of raw log lines.
 * Returns one ExtractedError per distinct error message found.
 */
export function extractErrors(lines: string[]): ExtractedError[] {
  const errors: ExtractedError[] = [];
  let   currentMessage = "";
  let   currentType    = "runtime_error";
  let   currentFrames: StackFrame[] = [];
  let   rawBlock: string[] = [];

  function flush(): void {
    if (!currentMessage) return;
    errors.push({
      message:  currentMessage,
      type:     currentType,
      frames:   [...currentFrames],
      rawLines: [...rawBlock],
    });
    currentMessage = "";
    currentType    = "runtime_error";
    currentFrames  = [];
    rawBlock       = [];
  }

  for (const line of lines) {
    // Vite/esbuild compilation error
    const vite = VITE_ERROR.exec(line);
    if (vite) {
      flush();
      currentType    = "compile_error";
      currentMessage = `${vite[4]}: ${vite[5]}`;
      currentFrames  = [{ file: vite[1], line: parseInt(vite[2], 10), col: parseInt(vite[3], 10) }];
      rawBlock       = [line];
      continue;
    }

    // Missing module
    const mod = MISSING_MODULE.exec(line);
    if (mod) {
      flush();
      currentType    = "missing_module";
      currentMessage = `Cannot find module '${mod[1]}'`;
      currentFrames  = [];
      rawBlock       = [line];
      flush();
      continue;
    }

    // TS compilation error
    const ts = TS_ERROR.exec(line);
    if (ts) {
      flush();
      currentType    = "compile_error";
      currentMessage = `${ts[1]}: ${ts[2]}`;
      rawBlock       = [line];
      continue;
    }

    // Syntax/Type/Reference error header
    const syn = SYNTAX_ERROR.exec(line);
    if (syn) {
      flush();
      currentType    = syn[1].toLowerCase().replace("error", "_error");
      currentMessage = `${syn[1]}: ${syn[2]}`;
      rawBlock       = [line];
      continue;
    }

    // Stack frame continuation
    const frame = parseFrame(line);
    if (frame && currentMessage) {
      currentFrames.push(frame);
      rawBlock.push(line);
      continue;
    }

    // Empty line signals end of current error block
    if (line.trim() === "" && currentMessage) {
      flush();
    }
  }

  flush();
  return errors;
}

/** Extract only the distinct file paths mentioned in stack frames. */
export function extractAffectedFiles(errors: ExtractedError[]): string[] {
  const seen = new Set<string>();
  for (const err of errors) {
    for (const frame of err.frames) {
      // Skip node_modules and internal Node paths
      if (!frame.file.includes("node_modules") && !frame.file.startsWith("node:")) {
        seen.add(frame.file);
      }
    }
  }
  return [...seen];
}
