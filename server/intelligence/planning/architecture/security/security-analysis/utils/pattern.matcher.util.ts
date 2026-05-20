import type { CodeFile } from "../types.js";

export interface SecurityMatch {
  readonly line:    number | null;
  readonly column:  number | null;
  readonly snippet: string | null;
  readonly matched: string;
}

export function matchPattern(
  content: string,
  pattern: RegExp,
): readonly SecurityMatch[] {
  const matches: SecurityMatch[] = [];
  const lines   = content.split("\n");
  const flags   = pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g";
  const safeRx  = new RegExp(pattern.source, flags);

  let match: RegExpExecArray | null;
  while ((match = safeRx.exec(content)) !== null) {
    const before = content.slice(0, match.index);
    const line   = before.split("\n").length;
    const column = before.split("\n").pop()?.length ?? 0;
    const snippet = (lines[line - 1] ?? "").trim().slice(0, 120) || null;

    matches.push(Object.freeze({
      line,
      column,
      snippet,
      matched: match[0].slice(0, 100),
    }));

    if (matches.length >= 30) break;
  }

  return Object.freeze(matches);
}

export function hasPattern(content: string, pattern: RegExp): boolean {
  const flags  = pattern.flags.replace("g", "") + "g";
  const safeRx = new RegExp(pattern.source, flags);
  return safeRx.test(content);
}

export function countPatternHits(content: string, pattern: RegExp): number {
  const flags  = pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g";
  const safeRx = new RegExp(pattern.source, flags);
  return (content.match(safeRx) ?? []).length;
}

export function isTestFile(filePath: string): boolean {
  return (
    filePath.includes(".test.") ||
    filePath.includes(".spec.") ||
    filePath.includes("__tests__") ||
    filePath.includes("/__mocks__/") ||
    filePath.includes("/fixtures/")
  );
}

export function isTypeFile(filePath: string): boolean {
  return filePath.endsWith(".d.ts") ||
    filePath.endsWith("types.ts") ||
    filePath.endsWith("types.js");
}

export function isConfigFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.endsWith(".env.example") ||
    lower.endsWith(".env.sample") ||
    lower.includes("example") ||
    lower.includes("sample") ||
    lower.includes("template")
  );
}

export function isRouteFile(filePath: string): boolean {
  return (
    filePath.includes("/routes/") ||
    filePath.includes("/router/") ||
    filePath.includes(".route.") ||
    filePath.includes(".router.") ||
    filePath.includes("/controllers/") ||
    filePath.includes("/handlers/")
  );
}

export function isControllerFile(filePath: string): boolean {
  return (
    filePath.includes("/controllers/") ||
    filePath.includes(".controller.") ||
    filePath.includes("/handlers/") ||
    filePath.includes(".handler.")
  );
}

export function extractLineSnippet(content: string, lineNumber: number): string | null {
  const lines = content.split("\n");
  return (lines[lineNumber - 1] ?? "").trim().slice(0, 120) || null;
}
