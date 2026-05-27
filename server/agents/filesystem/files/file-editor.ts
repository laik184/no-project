import { readFile } from './file-reader.ts';
import { writeFile } from './file-writer.ts';
import { permissionManager } from '../permissions.ts';
import { assertWriteOperation } from '../validation/file-validator.ts';

export interface EditorOptions {
  sandboxRoot: string;
  path: string;
}

export interface AppendOptions extends EditorOptions {
  content: string;
  newline?: boolean;
}

export interface ReplaceLineOptions extends EditorOptions {
  lineNumber: number;
  newContent: string;
}

export interface InsertAtOptions extends EditorOptions {
  lineNumber: number;
  content: string;
}

export interface ReplaceAllOptions extends EditorOptions {
  search: string;
  replacement: string;
}

export async function appendToFile(opts: AppendOptions): Promise<void> {
  permissionManager.assertWrite(opts.path);
  await assertWriteOperation({ sandboxRoot: opts.sandboxRoot, relativePath: opts.path });

  const existing = await readFile({ sandboxRoot: opts.sandboxRoot, path: opts.path });
  const separator = opts.newline !== false && !existing.endsWith('\n') ? '\n' : '';
  const updated = existing + separator + opts.content;

  await writeFile({ sandboxRoot: opts.sandboxRoot, path: opts.path, content: updated });
}

export async function replaceLine(opts: ReplaceLineOptions): Promise<void> {
  permissionManager.assertWrite(opts.path);

  const content = await readFile({ sandboxRoot: opts.sandboxRoot, path: opts.path });
  const lines = content.split('\n');

  if (opts.lineNumber < 1 || opts.lineNumber > lines.length) {
    throw new RangeError(`Line number ${opts.lineNumber} is out of range (file has ${lines.length} lines)`);
  }

  lines[opts.lineNumber - 1] = opts.newContent;
  await writeFile({ sandboxRoot: opts.sandboxRoot, path: opts.path, content: lines.join('\n') });
}

export async function insertAt(opts: InsertAtOptions): Promise<void> {
  permissionManager.assertWrite(opts.path);

  const content = await readFile({ sandboxRoot: opts.sandboxRoot, path: opts.path });
  const lines = content.split('\n');

  if (opts.lineNumber < 1 || opts.lineNumber > lines.length + 1) {
    throw new RangeError(`Insert position ${opts.lineNumber} is out of range (file has ${lines.length} lines)`);
  }

  lines.splice(opts.lineNumber - 1, 0, opts.content);
  await writeFile({ sandboxRoot: opts.sandboxRoot, path: opts.path, content: lines.join('\n') });
}

export async function replaceAll(opts: ReplaceAllOptions): Promise<number> {
  permissionManager.assertWrite(opts.path);

  const content = await readFile({ sandboxRoot: opts.sandboxRoot, path: opts.path });

  if (!content.includes(opts.search)) {
    throw new Error(`Text "${opts.search.slice(0, 50)}" not found in file "${opts.path}"`);
  }

  const count = content.split(opts.search).length - 1;
  const updated = content.split(opts.search).join(opts.replacement);
  await writeFile({ sandboxRoot: opts.sandboxRoot, path: opts.path, content: updated });
  return count;
}
