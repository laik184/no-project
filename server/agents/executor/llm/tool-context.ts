/**
 * tool-context.ts
 * Gathers context about the project for LLM prompt construction.
 */

import { fileSearch } from '../filesystem/file-search.ts';
import { fileReader }  from '../filesystem/file-reader.ts';
import type { PlanTask } from '../types/executor.types.ts';

const MAX_CONTEXT_FILES = 4;
const MAX_FILE_CHARS    = 800;

export interface ToolContext {
  projectFiles:  string[];
  existingCode:  Record<string, string>;
}

/** Collect file list + relevant code snippets for the given task. */
export async function buildToolContext(
  projectId: string,
  task:      PlanTask,
): Promise<ToolContext> {
  let projectFiles: string[] = [];

  try {
    projectFiles = await fileSearch.listDir(projectId, '.', true);
  } catch {
    projectFiles = [];
  }

  const existingCode = await gatherRelevantSnippets(
    projectId,
    task,
    projectFiles,
  );

  return { projectFiles, existingCode };
}

async function gatherRelevantSnippets(
  projectId: string,
  task:      PlanTask,
  files:     string[],
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const keywords = extractKeywords(task);

  // Score each file by keyword relevance
  const scored = files
    .filter((f) => !f.includes('node_modules') && !f.endsWith('.lock'))
    .map((f) => ({ file: f, score: scoreFile(f, keywords) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CONTEXT_FILES);

  for (const { file } of scored) {
    try {
      const content = await fileReader.read(projectId, file);
      result[file] = content.slice(0, MAX_FILE_CHARS);
    } catch { /* skip unreadable */ }
  }

  return result;
}

function extractKeywords(task: PlanTask): string[] {
  const words = `${task.title} ${task.description} ${task.category}`
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);
  return [...new Set(words)];
}

function scoreFile(filePath: string, keywords: string[]): number {
  const lower = filePath.toLowerCase();
  return keywords.reduce((score, kw) => score + (lower.includes(kw) ? 1 : 0), 0);
}
