import { validatePath, validateRelativePath } from '../validation/path-validator.ts';
import { hasTraversal } from '../utils/traversal-utils.ts';
import { normalizePath, joinPath } from '../utils/path-utils.ts';
import type { StructureSpec, FolderSpec, FileSpec } from './structure-builder.ts';

export interface StructureValidationIssue {
  path: string;
  issue: string;
  severity: 'error' | 'warning';
}

export interface StructureValidationResult {
  valid: boolean;
  issues: StructureValidationIssue[];
}

function collectPaths(spec: FolderSpec, prefix: string, paths: string[]): void {
  const folderPath = joinPath(prefix, spec.path);
  paths.push(folderPath);

  for (const file of spec.files ?? []) {
    paths.push(joinPath(folderPath, file.path));
  }

  for (const sub of spec.subfolders ?? []) {
    collectPaths(sub, folderPath, paths);
  }
}

function findDuplicates(paths: string[]): string[] {
  const normalized = paths.map(p => normalizePath(p));
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const p of normalized) {
    if (seen.has(p)) dupes.push(p);
    else seen.add(p);
  }
  return dupes;
}

function validateSpec(
  files: FileSpec[],
  folders: FolderSpec[],
  prefix: string,
  issues: StructureValidationIssue[],
): void {
  for (const file of files) {
    const fullPath = joinPath(prefix, file.path);
    const pathResult = validateRelativePath(fullPath);
    if (!pathResult.valid) {
      issues.push({ path: fullPath, issue: pathResult.error!, severity: 'error' });
    }
    if (hasTraversal(file.path)) {
      issues.push({ path: fullPath, issue: 'Path contains traversal sequence (..)', severity: 'error' });
    }
    if (!file.content && file.content !== '') {
      issues.push({ path: fullPath, issue: 'File content is undefined', severity: 'warning' });
    }
  }

  for (const folder of folders) {
    const fullPath = joinPath(prefix, folder.path);
    const pathResult = validateRelativePath(fullPath);
    if (!pathResult.valid) {
      issues.push({ path: fullPath, issue: pathResult.error!, severity: 'error' });
    }
    if (hasTraversal(folder.path)) {
      issues.push({ path: fullPath, issue: 'Path contains traversal sequence (..)', severity: 'error' });
    }
    validateSpec(folder.files ?? [], folder.subfolders ?? [], fullPath, issues);
  }
}

export function validateStructure(spec: StructureSpec): StructureValidationResult {
  const issues: StructureValidationIssue[] = [];

  const rootResult = validateRelativePath(spec.rootPath);
  if (!rootResult.valid) {
    issues.push({ path: spec.rootPath, issue: rootResult.error!, severity: 'error' });
  }

  validateSpec(spec.files ?? [], spec.folders ?? [], spec.rootPath, issues);

  const allPaths: string[] = [spec.rootPath];
  for (const folder of spec.folders ?? []) collectPaths(folder, spec.rootPath, allPaths);
  for (const file of spec.files ?? []) allPaths.push(joinPath(spec.rootPath, file.path));

  const dupes = findDuplicates(allPaths);
  for (const dupe of dupes) {
    issues.push({ path: dupe, issue: 'Duplicate path in structure spec', severity: 'error' });
  }

  return { valid: issues.filter(i => i.severity === 'error').length === 0, issues };
}
