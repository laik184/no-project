import type { CodeFile } from "../types.js";
import { MIGRATION_FILE_PATTERNS, MODEL_FILE_PATTERNS } from "../types.js";

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

export function isMigrationFile(file: CodeFile): boolean {
  return MIGRATION_FILE_PATTERNS.some((rx) => {
    const fresh = new RegExp(rx.source, rx.flags);
    return fresh.test(file.path);
  });
}

export function isModelFile(file: CodeFile): boolean {
  return MODEL_FILE_PATTERNS.some((rx) => {
    const fresh = new RegExp(rx.source, rx.flags);
    return fresh.test(file.path);
  });
}

export function isSchemaFile(file: CodeFile): boolean {
  const p = file.path.toLowerCase();
  return (
    p.endsWith(".sql") ||
    p.includes("schema") ||
    p.includes("migration") ||
    p.includes("migrate") ||
    isModelFile(file)
  );
}

export function isOrmFile(file: CodeFile): boolean {
  const p = file.path.toLowerCase();
  return (
    p.includes("repository") ||
    p.includes("service")    ||
    p.includes("dao")        ||
    p.includes("model")      ||
    p.includes("entity")     ||
    p.endsWith(".service.ts") ||
    p.endsWith(".agent.js") ||
    p.endsWith(".repository.ts") ||
    p.endsWith(".repository.js")
  );
}

export function extractMigrationVersion(filePath: string): string | null {
  const fileName = filePath.split("/").pop() ?? "";
  const tsMatch  = fileName.match(/^(\d{13,})/);
  if (tsMatch?.[1]) return tsMatch[1];
  const dateMatch = fileName.match(/^(\d{4}_\d{2}_\d{2})/);
  if (dateMatch?.[1]) return dateMatch[1];
  const flywayMatch = fileName.match(/^V(\d+(?:\.\d+)?)__/i);
  if (flywayMatch?.[1]) return flywayMatch[1];
  return null;
}
