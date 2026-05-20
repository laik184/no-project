import type { PatternAnalysisInput } from "../types.js";

const IMPORT_PATTERN = /from\s+["']([^"']+)["']|import\s+["']([^"']+)["']/g;

function normalizeImport(target: string): string {
  return target.replaceAll("\\", "/").trim();
}

function buildFromContent(contents: Readonly<Record<string, string>>): Readonly<Record<string, readonly string[]>> {
  const graph: Record<string, string[]> = {};
  const fileEntries = Object.entries(contents).sort(([a], [b]) => a.localeCompare(b));

  for (const [file, content] of fileEntries) {
    const dependencies = new Set<string>();
    for (const match of content.matchAll(IMPORT_PATTERN)) {
      const raw = match[1] ?? match[2];
      if (!raw) continue;
      dependencies.add(normalizeImport(raw));
    }
    graph[file] = Array.from(dependencies).sort((a, b) => a.localeCompare(b));
  }

  return Object.freeze(
    Object.fromEntries(Object.entries(graph).map(([k, v]) => [k, Object.freeze(v)])),
  );
}

function buildFallback(files: readonly string[]): Readonly<Record<string, readonly string[]>> {
  const sortedFiles = [...files].sort((a, b) => a.localeCompare(b));
  const graph: Record<string, readonly string[]> = {};
  for (const file of sortedFiles) {
    graph[file] = Object.freeze([]);
  }
  return Object.freeze(graph);
}

export function buildImportGraph(input: PatternAnalysisInput): Readonly<Record<string, readonly string[]>> {
  if (input.fileContents && Object.keys(input.fileContents).length > 0) {
    return buildFromContent(input.fileContents);
  }
  return buildFallback(input.files);
}
