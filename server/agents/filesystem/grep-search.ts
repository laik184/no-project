import { promises as fs }    from 'node:fs';
import path                  from 'node:path';
import { getWorkspaceRoot }  from '../terminal/workspace/runtime-workspace.ts';

export interface GrepMatch {
  relativePath: string;
  lineNumber:   number;
  lineContent:  string;
}

export interface GrepResult {
  matches: GrepMatch[];
  query:   string;
}

export async function grepLiteral(
  projectId: string,
  query:     string,
  searchDir: string = '.',
): Promise<GrepResult> {
  const sandboxRoot = getWorkspaceRoot(projectId);
  const absDir      = path.resolve(sandboxRoot, searchDir);
  const matches: GrepMatch[] = [];

  async function scan(dir: string): Promise<void> {
    let entries: { name: string; isDirectory(): boolean; isFile(): boolean }[] = [];
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }

    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.isFile() && /\.(ts|tsx|js|jsx|json|md|css|html)$/.test(entry.name)) {
        try {
          const content = await fs.readFile(fullPath, 'utf8');
          const lines   = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(query)) {
              matches.push({
                relativePath: path.relative(sandboxRoot, fullPath),
                lineNumber:   i + 1,
                lineContent:  lines[i],
              });
              if (matches.length >= 50) return;
            }
          }
        } catch { /* skip unreadable files */ }
      }
    }
  }

  await scan(absDir);
  return { matches, query };
}
