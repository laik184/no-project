/**
 * patch-file.ts
 * Surgical string-replacement file editing.
 * Replaces the broken append-only edit_file behaviour.
 */

import { fileReader }     from './file-reader.ts';
import { fileWriter }     from './file-writer.ts';
import { validatePatch }  from './replacement-validator.ts';

export interface PatchResult {
  ok:           boolean;
  replacements: number;
  error?:       string;
}

/**
 * Replace the first occurrence of `oldString` with `newString` in the file.
 * Returns an error if oldString is not found or the patch is unsafe.
 */
export async function patchFile(
  projectId: string,
  relativePath: string,
  oldString: string,
  newString: string,
): Promise<PatchResult> {
  const validation = validatePatch(relativePath, oldString, newString);
  if (!validation.valid) {
    return { ok: false, replacements: 0, error: validation.reason };
  }

  let content: string;
  try {
    content = await fileReader.read(projectId, relativePath);
  } catch (e) {
    return { ok: false, replacements: 0, error: `Cannot read file: ${(e as Error).message}` };
  }

  if (!content.includes(oldString)) {
    return {
      ok:           false,
      replacements: 0,
      error:        `old_string not found in ${relativePath}. ` +
                    `Hint: read the file first and copy the exact text.`,
    };
  }

  // Replace first occurrence only (intentional — surgical edit)
  const patched = content.replace(oldString, () => newString);
  const count   = patched === content ? 0 : 1;

  try {
    await fileWriter.write(projectId, relativePath, patched);
  } catch (e) {
    return { ok: false, replacements: 0, error: `Write failed: ${(e as Error).message}` };
  }

  return { ok: true, replacements: count };
}

/**
 * Replace ALL occurrences of `oldString` with `newString`.
 * Use only when you're certain you want every instance replaced.
 */
export async function patchFileAll(
  projectId: string,
  relativePath: string,
  oldString: string,
  newString: string,
): Promise<PatchResult> {
  const validation = validatePatch(relativePath, oldString, newString);
  if (!validation.valid) {
    return { ok: false, replacements: 0, error: validation.reason };
  }

  let content: string;
  try {
    content = await fileReader.read(projectId, relativePath);
  } catch (e) {
    return { ok: false, replacements: 0, error: `Cannot read file: ${(e as Error).message}` };
  }

  let count = 0;
  const patched = content.split(oldString).join(
    (() => { count++; return newString; })(),
  );

  // Recount properly
  count = (content.split(oldString).length - 1);
  if (count === 0) {
    return { ok: false, replacements: 0, error: `old_string not found in ${relativePath}` };
  }

  await fileWriter.write(projectId, relativePath, patched);
  return { ok: true, replacements: count };
}
