/**
 * server/ast/parsers/ast-parser.ts
 * Structural TypeScript/JavaScript file parser.
 * Uses regex-free approach: reads file → identifies symbols, imports, exports.
 * Single responsibility: produce ASTParseResult. No filesystem mutations.
 */

import fs   from "fs/promises";
import path from "path";
import type { ASTParseResult, ImportRecord, ExportRecord, SideEffectKind } from "../types.ts";

// ── Language detection ────────────────────────────────────────────────────────

function detectLanguage(filePath: string): ASTParseResult["language"] {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".tsx") return "tsx";
  if (ext === ".jsx") return "jsx";
  if (ext === ".ts")  return "typescript";
  return "javascript";
}

// ── Import extraction ─────────────────────────────────────────────────────────

function extractImports(content: string): ImportRecord[] {
  const imports: ImportRecord[] = [];

  // Static imports: import X from 'y' / import { A, B } from 'y'
  const staticRe = /import\s+(?:([\w*]+|\{[^}]+\})\s+from\s+)?['"]([^'"]+)['"]/g;
  for (const m of content.matchAll(staticRe)) {
    const specPart  = m[1] ?? "";
    const source    = m[2]!;
    const isDefault = !!specPart && !specPart.startsWith("{") && !specPart.startsWith("*");
    const named     = specPart.startsWith("{")
      ? specPart.replace(/[{}]/g, "").split(",").map(s => s.trim()).filter(Boolean)
      : [];
    imports.push({ source, specifiers: named, isDefault, isDynamic: false });
  }

  // Dynamic imports: await import('y') / require('y')
  const dynRe = /(?:await\s+import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const m of content.matchAll(dynRe)) {
    imports.push({ source: m[1]!, specifiers: [], isDefault: false, isDynamic: true });
  }

  return imports;
}

// ── Export extraction ─────────────────────────────────────────────────────────

function extractExports(content: string): ExportRecord[] {
  const exports: ExportRecord[] = [];

  const namedRe = /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
  for (const m of content.matchAll(namedRe)) {
    exports.push({ name: m[1]!, kind: "variable", isDefault: false, isReexport: false });
  }

  if (/export\s+default/.test(content)) {
    exports.push({ name: "default", kind: "variable", isDefault: true, isReexport: false });
  }

  const reexportRe = /export\s+\{[^}]+\}\s+from\s+['"][^'"]+['"]/g;
  for (const m of content.matchAll(reexportRe)) {
    exports.push({ name: m[0].slice(0, 40), kind: "export", isDefault: false, isReexport: true });
  }

  return exports;
}

// ── Side effect detection ─────────────────────────────────────────────────────

function detectSideEffects(content: string): SideEffectKind[] {
  const effects: SideEffectKind[] = [];
  if (/global\s*\[/.test(content) || /globalThis\s*\./.test(content)) effects.push("globalMutation");
  if (/process\.env/.test(content)) effects.push("envRead");
  if (/process\.exit/.test(content)) effects.push("processExit");
  if (/fs\.(write|append|unlink|mkdir|rm)/.test(content)) effects.push("fileWrite");
  if (/fetch\(|axios\.|http\.request|https\.request/.test(content)) effects.push("networkCall");
  return [...new Set(effects)];
}

// ── Top-level symbol names ────────────────────────────────────────────────────

function extractSymbols(content: string): string[] {
  const symbolRe = /^(?:export\s+)?(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/gm;
  return [...new Set([...content.matchAll(symbolRe)].map(m => m[1]!))];
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function parseFile(filePath: string): Promise<ASTParseResult> {
  try {
    const content  = await fs.readFile(filePath, "utf8");
    const language = detectLanguage(filePath);
    return {
      filePath,
      language,
      imports:     extractImports(content),
      exports:     extractExports(content),
      symbols:     extractSymbols(content),
      sideEffects: detectSideEffects(content),
    };
  } catch (e) {
    return {
      filePath, language: "typescript",
      imports: [], exports: [], symbols: [], sideEffects: [],
      parseError: (e as Error).message,
    };
  }
}

export async function parseFiles(filePaths: string[]): Promise<ASTParseResult[]> {
  return Promise.all(filePaths.map(parseFile));
}
