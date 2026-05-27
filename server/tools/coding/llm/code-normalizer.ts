/**
 * server/tools/coding/llm/code-normalizer.ts
 *
 * Post-processes LLM-generated code for consistency.
 * Pure functions — no side effects, no I/O.
 */

/**
 * Strip markdown code fences from a single file's content.
 */
export function stripCodeFences(code: string): string {
  return code
    .replace(/^```[\w]*\r?\n?/, '')
    .replace(/\r?\n?```$/, '')
    .trim();
}

/**
 * Remove duplicate blank lines (collapse 3+ blank lines → 2).
 */
export function collapseBlankLines(code: string): string {
  return code.replace(/\n{3,}/g, '\n\n');
}

/**
 * Ensure file ends with a single newline.
 */
export function ensureTrailingNewline(code: string): string {
  return code.trimEnd() + '\n';
}

/**
 * Remove duplicate import lines from TypeScript/JS code.
 */
export function deduplicateImports(code: string): string {
  const lines  = code.split('\n');
  const seen   = new Set<string>();
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('import ') && seen.has(trimmed)) continue;
    if (trimmed.startsWith('import ')) seen.add(trimmed);
    result.push(line);
  }

  return result.join('\n');
}

/**
 * Replace Windows CRLF line endings with Unix LF.
 */
export function normalizeLineEndings(code: string): string {
  return code.replace(/\r\n/g, '\n');
}

/**
 * Apply full normalization pipeline to a single file's content.
 */
export function normalizeFile(code: string): string {
  return ensureTrailingNewline(
    collapseBlankLines(
      deduplicateImports(
        normalizeLineEndings(
          stripCodeFences(code),
        ),
      ),
    ),
  );
}

/**
 * Apply full normalization to all files in a generation result.
 */
export function normalizeFiles(
  files: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    out[path] = normalizeFile(content);
  }
  return out;
}
