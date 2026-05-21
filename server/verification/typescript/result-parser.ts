/**
 * server/verification/typescript/result-parser.ts
 *
 * VerificationResultParser — converts raw tsc stdout/stderr into typed,
 * immutable TSDiagnostic objects.
 * Never touches the filesystem. Stateless. Pure transformation.
 */

import type { TSDiagnostic, DiagnosticSeverity } from "./types.ts";

// ─── tsc output formats ───────────────────────────────────────────────────────
//
// Canonical:  path/to/file.ts(line,col): error TS2304: message
// Alternate:  path/to/file.ts:line:col - error TS2304: message
// Global:     error TS6059: message  (no position)

const DIAGNOSTIC_CANONICAL =
  /^(.+)\((\d+),(\d+)\):\s+(error|warning|message)\s+TS(\d+):\s+(.+)$/;

const DIAGNOSTIC_COLON =
  /^(.+):(\d+):(\d+)\s+-\s+(error|warning|message)\s+TS(\d+):\s+(.+)$/;

const DIAGNOSTIC_GLOBAL =
  /^(error|warning|message)\s+TS(\d+):\s+(.+)$/;

export interface ParseResult {
  readonly diagnostics: readonly TSDiagnostic[];
  readonly parseErrors: readonly string[];
  readonly rawLineCount: number;
}

export class VerificationResultParser {
  parse(stdout: string, stderr: string): ParseResult {
    const combined = [stdout, stderr]
      .filter(Boolean)
      .join("\n");

    const lines = combined.split("\n");
    const diagnostics: TSDiagnostic[] = [];
    const parseErrors: string[] = [];

    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line) continue;

      const d =
        this._tryCanonical(line) ??
        this._tryColon(line) ??
        this._tryGlobal(line);

      if (d) {
        diagnostics.push(d);
      } else if (this._looksLikeDiagnostic(line)) {
        parseErrors.push(line);
      }
    }

    return {
      diagnostics: Object.freeze(diagnostics),
      parseErrors: Object.freeze(parseErrors),
      rawLineCount: lines.length,
    };
  }

  private _tryCanonical(line: string): TSDiagnostic | null {
    const m = DIAGNOSTIC_CANONICAL.exec(line);
    if (!m) return null;
    return this._build(m[1], +m[2], +m[3], m[4] as DiagnosticSeverity, +m[5], m[6]);
  }

  private _tryColon(line: string): TSDiagnostic | null {
    const m = DIAGNOSTIC_COLON.exec(line);
    if (!m) return null;
    return this._build(m[1], +m[2], +m[3], m[4] as DiagnosticSeverity, +m[5], m[6]);
  }

  private _tryGlobal(line: string): TSDiagnostic | null {
    const m = DIAGNOSTIC_GLOBAL.exec(line);
    if (!m) return null;
    return this._build("<global>", 0, 0, m[1] as DiagnosticSeverity, +m[2], m[3]);
  }

  private _build(
    filePath: string,
    line: number,
    column: number,
    severity: DiagnosticSeverity,
    code: number,
    message: string
  ): TSDiagnostic {
    return Object.freeze({
      filePath: filePath.trim(),
      line,
      column,
      severity,
      code,
      message: message.trim(),
      category: this._categorise(code),
    });
  }

  private _categorise(code: number): string {
    if (code >= 1000 && code < 2000) return "syntax";
    if (code >= 2000 && code < 3000) return "semantic";
    if (code >= 4000 && code < 5000) return "declaration";
    if (code >= 5000 && code < 6000) return "compiler-option";
    if (code >= 6000 && code < 7000) return "command-line";
    if (code >= 7000 && code < 8000) return "strict-mode";
    if (code >= 90000) return "suggestion";
    return "other";
  }

  private _looksLikeDiagnostic(line: string): boolean {
    return /TS\d{4}/.test(line) || / error | warning /.test(line);
  }

  summarise(diagnostics: readonly TSDiagnostic[], maxLines = 10): string {
    const errors = diagnostics.filter((d) => d.severity === "error");
    const shown = errors.slice(0, maxLines);
    const lines = shown.map(
      (d) =>
        `${d.filePath}(${d.line},${d.column}): TS${d.code} ${d.message}`
    );
    if (errors.length > maxLines) {
      lines.push(`... and ${errors.length - maxLines} more error(s)`);
    }
    return lines.join("\n");
  }
}
