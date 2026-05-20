import type { CodeFile } from "../types.js";
import { ENTRY_POINT_PATTERNS } from "../types.js";

export interface PatternMatch {
  readonly pattern: string;
  readonly line:    number | null;
  readonly column:  number | null;
  readonly snippet: string;
}

export function matchAllPatterns(
  content:  string,
  patterns: readonly RegExp[],
): PatternMatch[] {
  const results: PatternMatch[] = [];
  const lines   = content.split("\n");

  for (const rx of patterns) {
    const fresh = new RegExp(rx.source, rx.flags.includes("g") ? rx.flags : rx.flags + "g");
    let match: RegExpExecArray | null;

    while ((match = fresh.exec(content)) !== null) {
      const beforeMatch = content.slice(0, match.index);
      const lineNum     = beforeMatch.split("\n").length;
      const lastNl      = beforeMatch.lastIndexOf("\n");
      const col         = match.index - (lastNl === -1 ? 0 : lastNl + 1);

      results.push(Object.freeze({
        pattern: rx.source,
        line:    lineNum,
        column:  col,
        snippet: (lines[lineNum - 1] ?? "").trim().slice(0, 120),
      }));
    }
  }

  return results;
}

export function hasAnyPattern(
  content:  string,
  patterns: readonly RegExp[],
): boolean {
  return patterns.some((rx) => {
    const fresh = new RegExp(rx.source, rx.flags);
    return fresh.test(content);
  });
}

export function countPatternMatches(
  content:  string,
  patterns: readonly RegExp[],
): number {
  let total = 0;
  for (const rx of patterns) {
    const fresh = new RegExp(rx.source, rx.flags.includes("g") ? rx.flags : rx.flags + "g");
    const m = content.match(fresh);
    if (m) total += m.length;
  }
  return total;
}

export function isEntryPoint(file: CodeFile): boolean {
  return ENTRY_POINT_PATTERNS.some((rx) => {
    const fresh = new RegExp(rx.source, rx.flags);
    return fresh.test(file.path);
  });
}

export function isDeclarationFile(file: CodeFile): boolean {
  return file.path.endsWith(".d.ts");
}

export function isTypeScriptOrJs(file: CodeFile): boolean {
  return /\.(ts|js|tsx|jsx)$/.test(file.path) && !isDeclarationFile(file);
}

export function isTestFile(file: CodeFile): boolean {
  return /\.(test|spec)\.(ts|js|tsx|jsx)$/i.test(file.path) ||
         /__tests__\//i.test(file.path);
}

export function extractFileStem(filePath: string): string {
  return filePath.split("/").pop()?.replace(/\.(ts|js|tsx|jsx)$/, "") ?? "";
}

export function resolveImportPath(
  importSpec: string,
  fromFile:   string,
): string {
  if (!importSpec.startsWith(".")) return importSpec;
  const dir   = fromFile.split("/").slice(0, -1).join("/");
  const parts = `${dir}/${importSpec}`.split("/");
  const resolved: string[] = [];

  for (const p of parts) {
    if (p === "..") resolved.pop();
    else if (p !== ".") resolved.push(p);
  }

  return resolved.join("/");
}

export function extractAllImportedPaths(content: string): readonly string[] {
  const paths  = new Set<string>();
  const specRe = /(?:import|export)\s+(?:\{[^}]*\}|\w+|\*\s+as\s+\w+)\s+from\s+['"`]([^'"`]+)['"`]/g;
  const reqRe  = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  const reExRe = /export\s+\*\s+from\s+['"`]([^'"`]+)['"`]/g;

  let m: RegExpExecArray | null;

  for (const rx of [specRe, reqRe, reExRe]) {
    const fresh = new RegExp(rx.source, rx.flags.includes("g") ? rx.flags : rx.flags + "g");
    while ((m = fresh.exec(content)) !== null) {
      if (m[1]) paths.add(m[1]);
    }
  }

  return Object.freeze([...paths]);
}

export function extractNamedExports(content: string): readonly string[] {
  const names = new Set<string>();

  const blockRe = /^\s*export\s*\{([^}]+)\}/gm;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(content)) !== null) {
    for (const part of (m[1] ?? "").split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name && /^\w+$/.test(name)) names.add(name);
    }
  }

  const inlineRe = /^\s*export\s+(?:async\s+)?(?:function|class|const|let|var|interface|type|enum|abstract\s+class)\s+(\w+)/gm;
  while ((m = inlineRe.exec(content)) !== null) {
    if (m[1]) names.add(m[1]);
  }

  return Object.freeze([...names]);
}
