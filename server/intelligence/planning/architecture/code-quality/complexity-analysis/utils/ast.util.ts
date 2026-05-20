import type { CodeFile, FunctionInfo } from "../types.js";

export function countNonEmptyLines(content: string): number {
  return content.split("\n").filter((l) => l.trim().length > 0).length;
}

export function getLineAt(content: string, lineNumber: number): string {
  return content.split("\n")[lineNumber - 1] ?? "";
}

export function isTypeScriptOrJs(file: CodeFile): boolean {
  return /\.(ts|js|tsx|jsx)$/.test(file.path) && !file.path.endsWith(".d.ts");
}

export function isTestFile(file: CodeFile): boolean {
  return /\.(test|spec)\.(ts|js|tsx|jsx)$/i.test(file.path) ||
         /__tests__\//i.test(file.path);
}

export function stripStringLiterals(content: string): string {
  return content
    .replace(/`[^`]*`/g, '``')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");
}

export function stripComments(content: string): string {
  return content
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

export function extractFunctions(content: string): FunctionInfo[] {
  const functions: FunctionInfo[] = [];
  const lines   = content.split("\n");
  const cleaned = stripComments(stripStringLiterals(content));
  const cleanedLines = cleaned.split("\n");

  const functionStartRe = new RegExp(
    [
      /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*(\w+)\s*\(/,
      /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/,
      /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\w+\s*=>/,
      /^\s*(?:public|private|protected|static|override|\s)*(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[\w<>[\]|&]+\s*)?\{/,
      /^\s*(?:get|set)\s+(\w+)\s*\(/,
      /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?\(\s*[^)]*\)\s*=>/,
    ]
      .map((r) => r.source)
      .join("|"),
    "m",
  );

  for (let i = 0; i < lines.length; i++) {
    const line    = cleanedLines[i] ?? "";
    const trimmed = line.trim();

    let name: string | null = null;

    const namedFn   = trimmed.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*(\w+)\s*\(/);
    const constFn   = trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\(|[\w]+\s*=>)/);
    const methodFn  = trimmed.match(/^(?:(?:public|private|protected|static|override|async)\s+)*(\w+)\s*\([^)]*\)\s*(?::\s*[\w<>[\]|&, ]+\s*)?\{/);
    const accessorFn = trimmed.match(/^(?:get|set)\s+(\w+)\s*\(/);

    if (namedFn?.[1]) name = namedFn[1];
    else if (constFn?.[1]) name = constFn[1];
    else if (accessorFn?.[1]) name = `${trimmed.startsWith("get") ? "get" : "set"}_${accessorFn[1]}`;
    else if (methodFn?.[1] && !["if", "for", "while", "switch", "catch", "else", "do", "return", "const", "let", "var", "import", "export"].includes(methodFn[1])) {
      name = methodFn[1];
    }

    if (!name) continue;

    let braceDepth = 0;
    let started    = false;
    let endLine    = i;

    for (let j = i; j < Math.min(i + 300, lines.length); j++) {
      const cl = cleanedLines[j] ?? "";
      for (const ch of cl) {
        if (ch === "{") { braceDepth++; started = true; }
        if (ch === "}") { braceDepth--; }
      }
      if (started && braceDepth === 0) {
        endLine = j;
        break;
      }
    }

    if (!started || endLine <= i) continue;

    const lineCount = endLine - i + 1;
    if (lineCount < 2) continue;

    const bodyLines = lines.slice(i, endLine + 1);
    const nonEmpty  = bodyLines.filter((l) => l.trim().length > 0).length;
    if (nonEmpty < 2) continue;

    functions.push(Object.freeze({
      name,
      startLine: i + 1,
      endLine:   endLine + 1,
      lineCount,
      body:      bodyLines.join("\n"),
    }));

    i = Math.min(i + Math.floor(lineCount / 2), endLine);
  }

  return functions;
}

export function measureCurrentNestingDepth(lines: readonly string[]): number {
  let depth    = 0;
  let maxDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

    for (const ch of line) {
      if (ch === "{") { depth++; maxDepth = Math.max(maxDepth, depth); }
      if (ch === "}") { depth = Math.max(0, depth - 1); }
    }
  }

  return maxDepth;
}

export function countPatternInContent(
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
