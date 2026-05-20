import type { CodeFile } from "../types.js";

export interface FunctionBlock {
  readonly name:       string | null;
  readonly isAsync:    boolean;
  readonly startLine:  number;
  readonly endLine:    number;
  readonly body:       string;
}

export interface LoopBlock {
  readonly kind:      "for" | "forEach" | "map" | "filter" | "reduce" | "while" | "for-of" | "for-in";
  readonly startLine: number;
  readonly body:      string;
  readonly hasAwait:  boolean;
}

export function isAsyncFunction(content: string, offset: number): boolean {
  const before = content.slice(Math.max(0, offset - 200), offset);
  return /async\s+(function|\(|[a-zA-Z_$])/.test(before);
}

export function extractAsyncFunctions(content: string): readonly FunctionBlock[] {
  const blocks: FunctionBlock[] = [];
  const lines   = content.split("\n");

  const patterns = [
    /async\s+function\s+(\w+)\s*\(/g,
    /async\s+(\w+)\s*\([^)]*\)\s*[:{=>]/g,
    /(\w+)\s*=\s*async\s*\(/g,
    /async\s*\(/g,
  ];

  for (const pattern of patterns) {
    const safeRx = new RegExp(pattern.source, "g");
    let match: RegExpExecArray | null;
    while ((match = safeRx.exec(content)) !== null) {
      const before    = content.slice(0, match.index);
      const startLine = before.split("\n").length;
      const name      = match[1] ?? null;

      const afterMatch = content.slice(match.index);
      const bodyEnd    = findBlockEnd(afterMatch);
      const body       = afterMatch.slice(0, bodyEnd);
      const endLine    = startLine + body.split("\n").length - 1;

      blocks.push(Object.freeze({ name, isAsync: true, startLine, endLine, body }));
    }
  }

  return Object.freeze(blocks);
}

export function extractLoopBlocks(content: string): readonly LoopBlock[] {
  const blocks: LoopBlock[] = [];
  const lines   = content.split("\n");

  const loopPatterns: Array<{ kind: LoopBlock["kind"]; rx: RegExp }> = [
    { kind: "for-of",   rx: /for\s*\(\s*(const|let|var)\s+\w+\s+of\s+/g },
    { kind: "for-in",   rx: /for\s*\(\s*(const|let|var)\s+\w+\s+in\s+/g },
    { kind: "for",      rx: /for\s*\(\s*(const|let|var)\s+\w+\s*=\s*0/g },
    { kind: "while",    rx: /while\s*\(/g },
    { kind: "forEach",  rx: /\.forEach\s*\(/g },
    { kind: "map",      rx: /\.map\s*\(/g },
    { kind: "filter",   rx: /\.filter\s*\(/g },
    { kind: "reduce",   rx: /\.reduce\s*\(/g },
  ];

  for (const { kind, rx } of loopPatterns) {
    const safeRx = new RegExp(rx.source, "g");
    let match: RegExpExecArray | null;
    while ((match = safeRx.exec(content)) !== null) {
      const before    = content.slice(0, match.index);
      const startLine = before.split("\n").length;
      const afterMatch = content.slice(match.index);
      const bodyEnd    = findBlockEnd(afterMatch);
      const body       = afterMatch.slice(0, Math.min(bodyEnd, 2000));
      const hasAwait   = /\bawait\b/.test(body);

      blocks.push(Object.freeze({ kind, startLine, body, hasAwait }));
      if (blocks.length >= 200) break;
    }
  }

  return Object.freeze(blocks);
}

export function findBlockEnd(content: string): number {
  let depth = 0;
  let inStr: string | null = null;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inStr) {
      if (ch === inStr && content[i - 1] !== "\\") inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { inStr = ch; continue; }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return content.length;
}

export function containsDbCall(body: string): boolean {
  const dbCallRx = /\bawait\b[^;]*\.(find|findOne|findById|findAll|query|execute|save|create|update|delete|remove|where|prisma|knex|db|pool|connection|mongoose|sequelize)\b/;
  return dbCallRx.test(body);
}

export function countAwaitCalls(content: string): number {
  const matches = content.match(/\bawait\b/g);
  return matches ? matches.length : 0;
}

export function hasEventListenerWithoutCleanup(content: string): boolean {
  const addCount    = (content.match(/addEventListener\s*\(/g) ?? []).length;
  const removeCount = (content.match(/removeEventListener\s*\(/g) ?? []).length;
  return addCount > removeCount && addCount > 0;
}

export function hasIntervalWithoutClear(content: string): boolean {
  const setCount   = (content.match(/\bsetInterval\s*\(/g) ?? []).length;
  const clearCount = (content.match(/\bclearInterval\s*\(/g) ?? []).length;
  return setCount > clearCount && setCount > 0;
}

export function hasConnectionWithoutClose(content: string): boolean {
  const openPatterns  = [/\.connect\s*\(/g, /createConnection\s*\(/g, /createPool\s*\(/g];
  const closePatterns = [/\.end\s*\(/g,     /\.close\s*\(/g,          /\.destroy\s*\(/g];

  let opened = 0;
  let closed = 0;
  for (const rx of openPatterns)  { const m = content.match(rx);  opened += m ? m.length : 0; }
  for (const rx of closePatterns) { const m = content.match(rx);  closed += m ? m.length : 0; }

  return opened > closed && opened > 0;
}

export function extractFileDomain(filePath: string): string {
  const parts = filePath.replace(/\\/g, "/").split("/");
  return parts.find((p) => p !== "src" && p !== "server" && p !== "client" && p.length > 2) ?? "unknown";
}
