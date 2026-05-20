import type { CodeFile, DeadCodeIssue, OrphanDetectionResult } from "../types.js";
import {
  extractAllImportedPaths,
  resolveImportPath,
  isTypeScriptOrJs,
  isEntryPoint,
  isTestFile,
  extractFileStem,
} from "../utils/pattern.matcher.util.js";

let _issueCounter = 0;
function nextId(): string {
  _issueCounter += 1;
  return `dead-orphan-${Date.now()}-${String(_issueCounter).padStart(4, "0")}`;
}

function buildReferencedPathSet(files: readonly CodeFile[]): Set<string> {
  const referenced = new Set<string>();

  for (const file of files) {
    if (!isTypeScriptOrJs(file)) continue;

    for (const spec of extractAllImportedPaths(file.content)) {
      if (!spec.startsWith(".")) continue;

      const resolved = resolveImportPath(spec, file.path);
      referenced.add(resolved);
      referenced.add(`${resolved}.ts`);
      referenced.add(`${resolved}.tsx`);
      referenced.add(`${resolved}.js`);
      referenced.add(`${resolved}.jsx`);
      referenced.add(`${resolved}/index.ts`);
      referenced.add(`${resolved}/index.js`);
      referenced.add(`${resolved}/index.tsx`);
      referenced.add(`${resolved}/index.jsx`);
    }
  }

  return referenced;
}

function isReferencedByBarrelExport(
  file:  CodeFile,
  files: readonly CodeFile[],
): boolean {
  const fileStem = extractFileStem(file.path);
  const dir      = file.path.split("/").slice(0, -1).join("/");

  return files.some((f) => {
    if (!f.path.includes("/index.")) return false;
    const indexDir = f.path.split("/").slice(0, -1).join("/");
    if (indexDir !== dir) return false;
    return f.content.includes(fileStem) && /export\s+\*?\s*(?:\{[^}]*\})?\s*from/.test(f.content);
  });
}

function isConfigOrDeclaration(file: CodeFile): boolean {
  const p = file.path.toLowerCase();
  return (
    p.endsWith(".d.ts")          ||
    p.endsWith(".config.ts")     ||
    p.endsWith(".config.js")     ||
    p.includes("vite.config")    ||
    p.includes("jest.config")    ||
    p.includes("tsconfig")       ||
    p.includes(".eslintrc")      ||
    p.includes("webpack.config") ||
    p.includes("rollup.config")
  );
}

function isFileReferenced(file: CodeFile, referenced: Set<string>): boolean {
  const normalized = file.path.replace(/\.(ts|js|tsx|jsx)$/, "");
  return (
    referenced.has(file.path)          ||
    referenced.has(normalized)          ||
    referenced.has(`${normalized}.ts`)  ||
    referenced.has(`${normalized}.tsx`) ||
    referenced.has(`${normalized}.js`)  ||
    referenced.has(`${normalized}.jsx`)
  );
}

function scanForOrphanFiles(
  files:      readonly CodeFile[],
  referenced: Set<string>,
): readonly DeadCodeIssue[] {
  const issues: DeadCodeIssue[] = [];

  for (const file of files) {
    if (!isTypeScriptOrJs(file))     continue;
    if (isEntryPoint(file))          continue;
    if (isTestFile(file))            continue;
    if (isConfigOrDeclaration(file)) continue;
    if (isFileReferenced(file, referenced)) continue;
    if (isReferencedByBarrelExport(file, files)) continue;

    const hasExports = /\bexport\b/.test(file.content);
    const severity   = hasExports ? "HIGH" : "CRITICAL";

    issues.push(
      Object.freeze<DeadCodeIssue>({
        id:         nextId(),
        type:       "ORPHAN_FILE",
        severity,
        filePath:   file.path,
        line:       null,
        column:     null,
        message:    "File is never imported by any other module — completely unreachable from any entry point. It is pure dead code that grows the repository without adding value.",
        rule:       "DEAD-ORPHAN-001",
        suggestion: "Delete this file if it is no longer needed. If recently created, verify the import path is correctly referenced by a consumer. If a standalone script, annotate it explicitly.",
        snippet:    null,
      }),
    );
  }

  return Object.freeze(issues.slice(0, 30));
}

function buildOrphanPathSet(
  files:      readonly CodeFile[],
  referenced: Set<string>,
): Set<string> {
  const orphanPaths = new Set<string>();

  for (const file of files) {
    if (!isTypeScriptOrJs(file))     continue;
    if (isEntryPoint(file))          continue;
    if (isTestFile(file))            continue;
    if (isConfigOrDeclaration(file)) continue;
    if (isFileReferenced(file, referenced)) continue;
    orphanPaths.add(file.path);
  }

  return orphanPaths;
}

function scanForDeadImportChains(
  files:       readonly CodeFile[],
  orphanPaths: Set<string>,
): readonly DeadCodeIssue[] {
  const issues: DeadCodeIssue[] = [];

  for (const file of files) {
    if (!isTypeScriptOrJs(file) || isEntryPoint(file) || isTestFile(file)) continue;
    if (orphanPaths.has(file.path)) continue;

    const importedPaths = extractAllImportedPaths(file.content);
    const deadImports   = importedPaths.filter((spec) => {
      if (!spec.startsWith(".")) return false;
      const resolved = resolveImportPath(spec, file.path);
      return (
        orphanPaths.has(`${resolved}.ts`)  ||
        orphanPaths.has(`${resolved}.tsx`) ||
        orphanPaths.has(`${resolved}.js`)  ||
        orphanPaths.has(`${resolved}.jsx`) ||
        orphanPaths.has(resolved)
      );
    });

    for (const dead of deadImports.slice(0, 3)) {
      issues.push(
        Object.freeze<DeadCodeIssue>({
          id:         nextId(),
          type:       "DEAD_IMPORT_CHAIN",
          severity:   "MEDIUM",
          filePath:   file.path,
          line:       null,
          column:     null,
          message:    `Imports from "${dead}" which resolves to an orphan/dead module. This import is part of an unreachable dependency chain.`,
          rule:       "DEAD-ORPHAN-002",
          suggestion: `Remove the import of "${dead}" and clean up the chain. Trace back to the root orphan file and delete or reconnect it to an entry point.`,
          snippet:    null,
        }),
      );
    }
  }

  return Object.freeze(issues.slice(0, 20));
}

export function detectOrphanFiles(
  files: readonly CodeFile[],
): OrphanDetectionResult {
  const referenced    = buildReferencedPathSet(files);
  const orphanIssues  = scanForOrphanFiles(files, referenced);
  const orphanPaths   = buildOrphanPathSet(files, referenced);
  const chainIssues   = scanForDeadImportChains(files, orphanPaths);

  return Object.freeze({
    issues:          Object.freeze([...orphanIssues, ...chainIssues]),
    filesScanned:    files.filter((f) => isTypeScriptOrJs(f)).length,
    orphanFileCount: orphanIssues.length,
  });
}
