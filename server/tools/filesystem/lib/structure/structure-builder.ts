import { createFolder } from '../folders/folder-creator.ts';
import { writeFile } from '../files/file-writer.ts';
import { assertRelativePath } from '../validation/path-validator.ts';
import { joinPath } from '../utils/path-utils.ts';

export interface FileSpec {
  path: string;
  content: string;
}

export interface FolderSpec {
  path: string;
  files?: FileSpec[];
  subfolders?: FolderSpec[];
}

export interface StructureSpec {
  rootPath: string;
  folders?: FolderSpec[];
  files?: FileSpec[];
}

export interface BuildResult {
  created: string[];
  errors: Array<{ path: string; error: string }>;
}

async function buildFolder(
  sandboxRoot: string,
  spec: FolderSpec,
  result: BuildResult,
): Promise<void> {
  try {
    await createFolder({ sandboxRoot, path: spec.path, recursive: true });
    result.created.push(spec.path + '/');
  } catch (err) {
    result.errors.push({ path: spec.path, error: (err as Error).message });
    return;
  }

  for (const file of spec.files ?? []) {
    try {
      const filePath = joinPath(spec.path, file.path);
      await writeFile({ sandboxRoot, path: filePath, content: file.content });
      result.created.push(filePath);
    } catch (err) {
      result.errors.push({ path: joinPath(spec.path, file.path), error: (err as Error).message });
    }
  }

  for (const sub of spec.subfolders ?? []) {
    const nested: FolderSpec = { ...sub, path: joinPath(spec.path, sub.path) };
    await buildFolder(sandboxRoot, nested, result);
  }
}

export async function buildStructure(
  sandboxRoot: string,
  spec: StructureSpec,
): Promise<BuildResult> {
  assertRelativePath(spec.rootPath);
  const result: BuildResult = { created: [], errors: [] };

  await createFolder({ sandboxRoot, path: spec.rootPath, recursive: true });

  for (const file of spec.files ?? []) {
    try {
      const filePath = joinPath(spec.rootPath, file.path);
      await writeFile({ sandboxRoot, path: filePath, content: file.content });
      result.created.push(filePath);
    } catch (err) {
      result.errors.push({ path: file.path, error: (err as Error).message });
    }
  }

  for (const folder of spec.folders ?? []) {
    const nested: FolderSpec = { ...folder, path: joinPath(spec.rootPath, folder.path) };
    await buildFolder(sandboxRoot, nested, result);
  }

  return result;
}
