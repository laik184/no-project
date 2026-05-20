import type { CodeFile, DeadCodeIssue, UnusedExportsResult } from "../types.js";
import { DEFAULT_EXPORT_PATTERNS, NAMED_EXPORT_BLOCK_PATTERN } from "../types.js";
import {
  hasAnyPattern,
  extractNamedExports,
  extractAllImportedPaths,
  resolveImportPath,
  isTypeScriptOrJs,
  isEntryPoint,
  isTestFile,
} from "../utils/pattern.matcher.util.js";

let _issueCounter = 0;
function nextId(): string {
  _issueCounter += 1;
  return `dead-exp-${Date.now()}-${String(_issueCounter).padStart(4, "0")}`;
}

interface ExportEntry {
  readonly name:     string;
  readonly filePath: string;
  readonly line:     number | null;
}

function buildExportMap(files: readonly CodeFile[]): Map<string, ExportEntry[]> {
  const map = new Map<string, ExportEntry[]>();

  for (const file of files) {
    if (!isTypeScriptOrJs(file) || isEntryPoint(file) || isTestFile(file)) continue;

    const names = extractNamedExports(file.content);
    const lines = file.content.split("\n");

    for (const name of names) {
      const lineIdx = lines.findIndex((l) =>
        new RegExp(`\\bexport\\b[^\\n]*\\b${name}\\b`).test(l),
      );

      const entry: ExportEntry = Object.freeze({
        name,
        filePath: file.path,
        line:     lineIdx >= 0 ? lineIdx + 1 : null,
      });

      const existing = map.get(name) ?? [];
      existing.push(entry);
      map.set(name, existing);
    }
  }

  return map;
}

function buildImportedSymbolSet(files: readonly CodeFile[]): Set<string> {
  const imported = new Set<string>();

  for (const file of files) {
    if (!isTypeScriptOrJs(file)) continue;

    const namedImportRe = /import\s+\{([^}]+)\}\s+from\s+['"`][^'"`]+['"`]/g;
    let m: RegExpExecArray | null;
    while ((m = namedImportRe.exec(file.content)) !== null) {
      for (const part of (m[1] ?? "").split(",")) {
        const sym = part.trim().split(/\s+as\s+/)[0]?.trim();
        if (sym && /^\w+$/.test(sym)) imported.add(sym);
      }
    }

    const defaultImportRe = /import\s+(\w+)\s+from\s+['"`][^'"`]+['"`]/g;
    const freshDefault     = new RegExp(defaultImportRe.source, "g");
    while ((m = freshDefault.exec(file.content)) !== null) {
      if (m[1]) imported.add(m[1]);
    }

    const wildcardRe = /import\s+\*\s+as\s+(\w+)\s+from\s+['"`][^'"`]+['"`]/g;
    while ((m = wildcardRe.exec(file.content)) !== null) {
      if (m[1]) imported.add(m[1]);
    }
  }

  return imported;
}

function buildImportedFileSet(files: readonly CodeFile[]): Set<string> {
  const importedPaths = new Set<string>();

  for (const file of files) {
    if (!isTypeScriptOrJs(file)) continue;
    for (const spec of extractAllImportedPaths(file.content)) {
      if (!spec.startsWith(".")) continue;
      const resolved = resolveImportPath(spec, file.path);
      importedPaths.add(resolved);
      importedPaths.add(`${resolved}.ts`);
      importedPaths.add(`${resolved}.js`);
      importedPaths.add(`${resolved}/index.ts`);
      importedPaths.add(`${resolved}/index.js`);
    }
  }

  return importedPaths;
}

function detectUnusedNamedExports(
  exportMap:     Map<string, ExportEntry[]>,
  importedSyms:  Set<string>,
): readonly DeadCodeIssue[] {
  const issues: DeadCodeIssue[] = [];

  for (const [name, entries] of exportMap.entries()) {
    if (importedSyms.has(name)) continue;

    const commonGeneric = /^(default|index|handler|main|init|setup|config|types?|interfaces?|helpers?|utils?|constants?)$/i;
    if (commonGeneric.test(name)) continue;

    for (const entry of entries.slice(0, 3)) {
      issues.push(
        Object.freeze<DeadCodeIssue>({
          id:         nextId(),
          type:       "UNUSED_EXPORT",
          severity:   "MEDIUM",
          filePath:   entry.filePath,
          line:       entry.line,
          column:     null,
          message:    `"${name}" is exported but never imported anywhere in the codebase. It contributes to bundle size and cognitive load with no benefit.`,
          rule:       "DEAD-EXP-001",
          suggestion: `Remove the export keyword from "${name}", or delete the symbol entirely if it is no longer needed. If it is a public API boundary, document it explicitly.`,
          snippet:    null,
        }),
      );
    }
  }

  return Object.freeze(issues.slice(0, 40));
}

function detectUnusedDefaultExports(
  files:          readonly CodeFile[],
  importedFiles:  Set<string>,
): readonly DeadCodeIssue[] {
  const issues: DeadCodeIssue[] = [];

  for (const file of files) {
    if (!isTypeScriptOrJs(file) || isEntryPoint(file) || isTestFile(file)) continue;

    const hasDefault = hasAnyPattern(file.content, DEFAULT_EXPORT_PATTERNS);
    if (!hasDefault) continue;

    const normalized = file.path.replace(/\.(ts|js|tsx|jsx)$/, "");
    const isImported = importedFiles.has(file.path) ||
                       importedFiles.has(normalized)  ||
                       importedFiles.has(`${normalized}.ts`) ||
                       importedFiles.has(`${normalized}.js`);

    if (isImported) continue;

    issues.push(
      Object.freeze<DeadCodeIssue>({
        id:         nextId(),
        type:       "UNUSED_DEFAULT_EXPORT",
        severity:   "HIGH",
        filePath:   file.path,
        line:       null,
        column:     null,
        message:    `File has a default export but is never imported by any other module. The entire module is dead weight.`,
        rule:       "DEAD-EXP-002",
        suggestion: "Delete the file if it is no longer used, or verify you intended this module to be a standalone entry point. If it is library code, verify it is imported by consumers.",
        snippet:    null,
      }),
    );
  }

  return Object.freeze(issues.slice(0, 20));
}

export function detectUnusedExports(
  files: readonly CodeFile[],
): UnusedExportsResult {
  const exportMap      = buildExportMap(files);
  const importedSyms   = buildImportedSymbolSet(files);
  const importedFiles  = buildImportedFileSet(files);

  const namedIssues    = detectUnusedNamedExports(exportMap, importedSyms);
  const defaultIssues  = detectUnusedDefaultExports(files, importedFiles);

  const allIssues = [...namedIssues, ...defaultIssues];
  const orphanedSymbols = namedIssues.map((i) =>
    i.message.match(/"(\w+)" is exported/)?.[1] ?? "",
  ).filter(Boolean);

  return Object.freeze({
    issues:            Object.freeze(allIssues),
    filesScanned:      files.filter((f) => isTypeScriptOrJs(f)).length,
    unusedExportCount: allIssues.length,
    orphanedSymbols:   Object.freeze(orphanedSymbols),
  });
}
