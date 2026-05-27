import { readFile } from './file-reader.ts';
import { writeFile } from './file-writer.ts';
import { assertSingleReplacement, assertReplacement } from '../validation/replacement-validator.ts';
import { permissionManager } from '../permissions.ts';
import { lineDiff, type DiffResult } from '../utils/diff-utils.ts';

export interface PatchOptions {
  sandboxRoot: string;
  path: string;
  oldString: string;
  newString: string;
}

export interface PatchResult {
  path: string;
  occurrences: number;
  diff: DiffResult;
}

export async function patchFile(opts: PatchOptions): Promise<PatchResult> {
  permissionManager.assertWrite(opts.path);

  const content = await readFile({ sandboxRoot: opts.sandboxRoot, path: opts.path });

  assertSingleReplacement(content, opts.oldString, opts.newString);

  const patched = content.replace(opts.oldString, opts.newString);
  const diff = lineDiff(content, patched);

  await writeFile({ sandboxRoot: opts.sandboxRoot, path: opts.path, content: patched });

  return { path: opts.path, occurrences: 1, diff };
}

export async function patchFileAll(opts: PatchOptions): Promise<PatchResult> {
  permissionManager.assertWrite(opts.path);

  const content = await readFile({ sandboxRoot: opts.sandboxRoot, path: opts.path });

  const occurrences = assertReplacement(content, opts.oldString, opts.newString);

  const patched = content.split(opts.oldString).join(opts.newString);
  const diff = lineDiff(content, patched);

  await writeFile({ sandboxRoot: opts.sandboxRoot, path: opts.path, content: patched });

  return { path: opts.path, occurrences, diff };
}
