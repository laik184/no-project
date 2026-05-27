import { promises as fs, constants as fsConstants } from 'node:fs';
import { joinPath, dirname } from './path-utils.ts';

export interface FileStat {
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  createdAt: Date;
  modifiedAt: Date;
}

export async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function isFile(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isFile();
  } catch {
    return false;
  }
}

export async function isDirectory(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function getFileStat(p: string): Promise<FileStat> {
  const stat = await fs.stat(p);
  return {
    size: stat.size,
    isFile: stat.isFile(),
    isDirectory: stat.isDirectory(),
    createdAt: stat.birthtime,
    modifiedAt: stat.mtime,
  };
}

export async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true });
}

export async function ensureParentDir(filePath: string): Promise<void> {
  await ensureDir(dirname(filePath));
}

export async function readTextFile(p: string): Promise<string> {
  return fs.readFile(p, 'utf-8');
}

export async function writeTextFile(p: string, content: string): Promise<void> {
  await ensureParentDir(p);
  await fs.writeFile(p, content, 'utf-8');
}

export async function deleteFile(p: string): Promise<void> {
  await fs.unlink(p);
}

export async function deleteDir(p: string): Promise<void> {
  await fs.rm(p, { recursive: true, force: true });
}

export async function copyFile(src: string, dest: string): Promise<void> {
  await ensureParentDir(dest);
  await fs.copyFile(src, dest);
}

export async function moveFile(src: string, dest: string): Promise<void> {
  await ensureParentDir(dest);
  await fs.rename(src, dest);
}

export async function listDir(p: string): Promise<string[]> {
  const entries = await fs.readdir(p, { withFileTypes: true });
  return entries.map(e => joinPath(p, e.name));
}

export async function listDirEntries(p: string): Promise<import('node:fs').Dirent[]> {
  return fs.readdir(p, { withFileTypes: true });
}

export async function copyDir(src: string, dest: string): Promise<void> {
  await ensureDir(dest);
  const entries = await fs.readdir(src, { withFileTypes: true });
  await Promise.all(entries.map(async entry => {
    const srcPath = joinPath(src, entry.name);
    const destPath = joinPath(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }));
}
